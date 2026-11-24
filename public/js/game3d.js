import * as THREE from '/vendor/three.module.js';
import { getModeDefinition, ROUND_RESTART_DELAY_MS } from './config.js';
import { Range3D } from './range3d.js';
import { FirstPersonViewModel } from './view-model.js';
import { clamp } from './utils.js';
import { lookScale } from './sensitivity.js';
import { TimerCues } from './timer-cues.js';

export class Game3D {
  constructor(canvas, audio, callbacks = {}) {
    this.canvas = canvas;
    this.audio = audio;
    this.callbacks = callbacks;
    this.active = false;
    this.state = 'idle';
    this.definition = null;
    this.mode = null;
    this.settings = { difficulty: 'normal', duration: 30, reducedMotion: false, sensitivity: 1 };
    this.input = { breath: false };
    this.remaining = 30;
    this.countdownRemaining = 3;
    this.lastCountdownNumber = 3;
    this.pausedFrom = 'running';
    this.pointerLockFallback = false;
    this.lastClient = null;
    this.lastFrame = 0;
    this.frameId = 0;
    this.timerCues = new TimerCues();
    this.yaw = 0;
    this.pitch = 0;
    this.targets = [];
    this.targetMeshes = [];
    this.impacts = [];
    this.gridGuide = null;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x071015);
    this.scene.fog = new THREE.Fog(0x071015, 20, 70);
    this.camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.1, 120);
    this.camera.position.set(0, 2.2, 8);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.raycaster = new THREE.Raycaster();
    this.centerScreen = new THREE.Vector2(0, 0);
    this.targetGeometry = new THREE.SphereGeometry(1, 28, 18);
    this.clayGeometry = new THREE.CylinderGeometry(1, 1, 0.2, 32);
    this.ringGeometry = new THREE.TorusGeometry(1.15, 0.035, 8, 48);
    this.impactGeometry = new THREE.SphereGeometry(0.055, 8, 6);
    this.buildRange();
    this.viewModel = new FirstPersonViewModel(this.camera);

    this.canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
    this.canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('pointerup', (event) => this.onPointerUp(event));
    window.addEventListener('pointercancel', (event) => this.onPointerUp(event));
    window.addEventListener('keydown', (event) => this.onKeyDown(event));
    window.addEventListener('keyup', (event) => this.onKeyUp(event));
    window.addEventListener('blur', () => this.onInterruption());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.onInterruption();
    });
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    document.addEventListener('pointerlockerror', () => {
      if (!this.active || this.state === 'idle' || this.state === 'finished' || this.state === 'paused') return;
      this.pointerLockFallback = true;
      this.lastClient = null;
      this.callbacks.onNotice?.('鼠标锁定不可用，3D 视角已切换为移动控制。');
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
  }

  buildRange() {
    const hemisphere = new THREE.HemisphereLight(0xa8fff0, 0x071015, 1.35);
    this.scene.add(hemisphere);
    const keyLight = new THREE.DirectionalLight(0xe4fff5, 2.1);
    keyLight.position.set(5, 11, 7);
    this.scene.add(keyLight);
    const rangeLight = new THREE.PointLight(0x79f2ca, 38, 36, 2);
    rangeLight.position.set(0, 5.5, -10);
    this.scene.add(rangeLight);
    const warmLight = new THREE.PointLight(0xffb86b, 24, 28, 2);
    warmLight.position.set(-7, 3, -18);
    this.scene.add(warmLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 100),
      new THREE.MeshStandardMaterial({ color: 0x0b1418, roughness: 0.92, metalness: 0.12 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -20;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(100, 100, 0x397565, 0x17332f);
    grid.position.set(0, 0.015, -20);
    grid.material.transparent = true;
    grid.material.opacity = 0.42;
    this.scene.add(grid);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x101d22, roughness: 0.78, metalness: 0.22 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(25, 9, 0.4), wallMaterial);
    backWall.position.set(0, 4.5, -34);
    this.scene.add(backWall);
    [-12, 12].forEach((x) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 72), wallMaterial);
      wall.position.set(x, 4.5, -12);
      this.scene.add(wall);
    });

    const beamMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2a2e, roughness: 0.55, metalness: 0.55 });
    for (let z = 4; z >= -32; z -= 8) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(24, 0.22, 0.35), beamMaterial);
      beam.position.set(0, 7.2, z);
      this.scene.add(beam);
      [-8, 8].forEach((x) => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 7.2, 0.35), beamMaterial);
        pillar.position.set(x, 3.6, z);
        this.scene.add(pillar);
      });
    }

    const laneMaterial = new THREE.MeshBasicMaterial({ color: 0x4bc7a7, transparent: true, opacity: 0.42 });
    [-6, 0, 6].forEach((x) => {
      const lane = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 66), laneMaterial);
      lane.position.set(x, 0.035, -18);
      this.scene.add(lane);
    });
    for (let z = 2; z >= -30; z -= 4) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(12, 0.02, 0.035), laneMaterial);
      marker.position.set(0, 0.04, z);
      this.scene.add(marker);
    }

    const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x12272a, emissive: 0x0b3530, emissiveIntensity: 0.35 });
    [-8.5, 8.5].forEach((x) => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.5, 0.35), panelMaterial);
      panel.position.set(x, 2.3, -30);
      this.scene.add(panel);
    });
    this.rangeMaterials = { floor: floor.material, wall: wallMaterial, beam: beamMaterial, lane: laneMaterial, panel: panelMaterial };
  }

  setTheme(theme) {
    const light = theme === 'light';
    this.scene.background.set(light ? 0xe2edef : 0x071015);
    this.scene.fog.color.set(light ? 0xe2edef : 0x071015);
    this.rangeMaterials.floor.color.set(light ? 0xb9cbce : 0x0b1418);
    this.rangeMaterials.wall.color.set(light ? 0x9eb8bd : 0x101d22);
    this.rangeMaterials.beam.color.set(light ? 0x79989e : 0x1a2a2e);
    this.rangeMaterials.lane.color.set(light ? 0x238a70 : 0x4bc7a7);
    this.rangeMaterials.panel.color.set(light ? 0x7fb3a3 : 0x12272a);
    this.rangeMaterials.panel.emissive.set(light ? 0x285f50 : 0x0b3530);
    this.renderer.toneMappingExposure = light ? 1.18 : 1.12;
    if (this.gridGuide) this.gridGuide.material.color.set(light ? 0x238a70 : 0x79f2ca);
    this.targets.forEach((target) => this.applyTargetTheme(target));
  }

  applyTargetTheme(target) {
    if (target.userData.baseColor !== '#79f2ca') return;
    const color = this.settings.theme === 'light' ? '#0b8f70' : '#79f2ca';
    target.userData.materials.forEach((material) => {
      material.color.set(color);
      if (material.emissive) material.emissive.set(color);
    });
  }

  isSpawnPositionClear(position, radius, targets, minDistance) {
    const point = new THREE.Vector3(...position);
    const direction = point.clone().sub(this.camera.position);
    const depth = direction.length();
    const angularRadius = Math.asin(Math.min(0.99, radius / depth));
    const normalized = direction.normalize();
    return targets.every((target) => {
      if (point.distanceTo(target.position) < minDistance) return false;
      const otherDirection = target.position.clone().sub(this.camera.position);
      const otherAngularRadius = Math.asin(Math.min(0.99, target.userData.radius / otherDirection.length()));
      const angle = normalized.angleTo(otherDirection.normalize());
      return angle >= 2 * (angularRadius + otherAngularRadius);
    });
  }

  createTarget(radius, color = '#79f2ca', kind = 'sphere') {
    const group = new THREE.Group();
    const displayColor = color === '#79f2ca' && this.settings.theme === 'light' ? '#0b8f70' : color;
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: displayColor,
      emissive: displayColor,
      emissiveIntensity: 0.65,
      roughness: 0.3,
      metalness: 0.25,
    });
    const core = new THREE.Mesh(kind === 'clay' ? this.clayGeometry : this.targetGeometry, coreMaterial);
    if (kind === 'clay') core.rotation.x = Math.PI / 2;
    core.scale.setScalar(radius);
    core.userData.target = group;
    group.add(core);

    const ringMaterial = new THREE.MeshBasicMaterial({ color: displayColor, transparent: true, opacity: 0.82 });
    const ring = new THREE.Mesh(this.ringGeometry, ringMaterial);
    ring.scale.setScalar(radius);
    group.add(ring);
    if (kind === 'sniper' || kind === 'tracking') {
      const ringScales = kind === 'tracking' ? [0.7, 0.45, 0.2] : [0.66, 0.33];
      ringScales.forEach((scale) => {
        const inner = new THREE.Mesh(this.ringGeometry, ringMaterial);
        inner.scale.setScalar(radius * scale);
        group.add(inner);
      });
    }
    group.userData.radius = radius;
    group.userData.baseColor = color;
    group.userData.core = core;
    group.userData.flash = 0;
    group.userData.materials = [coreMaterial, ringMaterial];
    this.scene.add(group);
    this.targets.push(group);
    this.targetMeshes.push(core);
    return group;
  }

  removeTarget(target) {
    if (!target) return;
    this.scene.remove(target);
    this.targets = this.targets.filter((item) => item !== target);
    this.targetMeshes = this.targetMeshes.filter((mesh) => mesh !== target.userData.core);
    target.userData.materials.forEach((material) => material.dispose());
  }

  clearTargets() {
    [...this.targets].forEach((target) => this.removeTarget(target));
    this.impacts.forEach((impact) => {
      this.scene.remove(impact);
      impact.material.dispose();
    });
    this.impacts = [];
    this.clearGridGuide();
  }

  clearGridGuide() {
    if (!this.gridGuide) return;
    this.scene.remove(this.gridGuide);
    this.gridGuide.geometry.dispose();
    this.gridGuide.material.dispose();
    this.gridGuide = null;
  }

  createGridGuide(xLines, yLines, z) {
    this.clearGridGuide();
    const minY = Math.min(...yLines);
    const maxY = Math.max(...yLines);
    const minX = Math.min(...xLines);
    const maxX = Math.max(...xLines);
    const vertices = [];
    xLines.forEach((x) => vertices.push(x, minY, z, x, maxY, z));
    yLines.forEach((y) => vertices.push(minX, y, z, maxX, y, z));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.LineBasicMaterial({
      color: this.settings.theme === 'light' ? 0x238a70 : 0x79f2ca,
      transparent: true,
      opacity: 0.32,
    });
    this.gridGuide = new THREE.LineSegments(geometry, material);
    this.scene.add(this.gridGuide);
  }

  raycast(targets) {
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.centerScreen, this.camera);
    const meshes = targets.filter(Boolean).map((target) => target.userData.core);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    return hit ? { target: hit.object.userData.target, point: hit.point } : null;
  }

  rayDistance(target) {
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.centerScreen, this.camera);
    return this.raycaster.ray.distanceToPoint(target.position);
  }

  flashTarget(target) {
    if (target) target.userData.flash = 1;
  }

  addImpact(point, hit) {
    if (!point) return;
    const material = new THREE.MeshBasicMaterial({ color: hit ? 0x071015 : 0xff6f7d });
    const impact = new THREE.Mesh(this.impactGeometry, material);
    impact.position.copy(point);
    this.scene.add(impact);
    this.impacts.push(impact);
    if (this.impacts.length > 70) {
      const oldest = this.impacts.shift();
      this.scene.remove(oldest);
      oldest.material.dispose();
    }
  }

  kick() {
    this.viewModel.kick();
  }

  setupSession(id) {
    this.clearTargets();
    this.definition = getModeDefinition(id);
    this.viewModel.setWeapon(this.definition.weapon);
    this.viewModel.resetEffects();
    this.yaw = 0;
    this.pitch = 0;
    this.camera.rotation.set(0, 0, 0);
    this.camera.position.set(0, 2.2, 8);
    this.mode = new Range3D(id, this.settings.difficulty, this.audio, this.settings.reducedMotion, this);
    this.remaining = this.settings.duration;
    this.timerCues.reset();
    this.countdownRemaining = 3;
    this.lastCountdownNumber = 3;
    this.input.breath = false;
    this.lastClient = null;
  }

  load(id, settings) {
    this.releasePointerLock();
    this.active = true;
    this.pointerLockFallback = false;
    this.settings = { ...this.settings, ...settings };
    this.setupSession(id);
    this.state = 'idle';
    this.lastFrame = performance.now();
    this.resize();
    this.emitState();
    this.emitTick();
    cancelAnimationFrame(this.frameId);
    this.frameId = requestAnimationFrame((time) => this.frame(time));
  }

  unload() {
    this.active = false;
    this.input.breath = false;
    this.mode?.onPointerUp();
    this.releasePointerLock();
    this.clearTargets();
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  async start() {
    if (!this.active || !this.definition) return false;
    const cooldown = Math.max(0, (this.restartAvailableAt || 0) - performance.now());
    if (cooldown > 0) {
      this.callbacks.onNotice?.(`训练刚结束，请等待 ${(cooldown / 1000).toFixed(1)} 秒后再开始下一轮。`);
      return false;
    }
    this.restartAvailableAt = 0;
    this.audio.unlock();
    this.releasePointerLock();
    this.setupSession(this.definition.id);
    this.pointerLockFallback = false;
    this.state = 'idle';
    const locked = await this.requestPointerLock();
    this.pointerLockFallback = !locked;
    if (!locked) this.callbacks.onNotice?.('当前环境未锁定鼠标，移动鼠标即可控制 3D 视角。');
    this.state = 'countdown';
    this.lastFrame = performance.now();
    this.audio.countdown(this.lastCountdownNumber);
    this.canvas.focus({ preventScroll: true });
    this.emitState();
    this.emitTick();
    return true;
  }

  pause() {
    if (this.state !== 'running' && this.state !== 'countdown') return;
    this.pausedFrom = this.state;
    this.state = 'paused';
    this.input.breath = false;
    this.mode.onPointerUp();
    this.releasePointerLock();
    this.emitState();
  }

  async resume() {
    if (this.state !== 'paused') return false;
    this.audio.unlock();
    const locked = await this.requestPointerLock();
    this.pointerLockFallback = !locked;
    this.lastClient = null;
    if (!locked) this.callbacks.onNotice?.('继续使用移动鼠标控制 3D 视角。');
    this.state = this.pausedFrom;
    this.lastFrame = performance.now();
    this.emitState();
    return true;
  }

  finish() {
    if (this.state !== 'running') return;
    this.state = 'finished';
    this.restartAvailableAt = performance.now() + ROUND_RESTART_DELAY_MS;
    this.input.breath = false;
    this.mode.onPointerUp();
    this.releasePointerLock();
    this.audio.finish();
    const result = this.mode.getResults();
    this.emitState();
    this.callbacks.onFinish?.(result);
  }

  onInterruption() {
    this.input.breath = false;
    this.mode?.onPointerUp();
    if (this.state === 'running' || this.state === 'countdown') this.pause();
  }

  onPointerMove(event) {
    if (!this.active || !this.mode || (this.state !== 'running' && this.state !== 'countdown')) return;
    let dx = 0;
    let dy = 0;
    if (!this.pointerLockFallback && document.pointerLockElement === this.canvas) {
      dx = event.movementX;
      dy = event.movementY;
    } else if (this.pointerLockFallback) {
      if (this.lastClient) {
        dx = event.clientX - this.lastClient.x;
        dy = event.clientY - this.lastClient.y;
      }
      this.lastClient = { x: event.clientX, y: event.clientY };
    } else {
      return;
    }
    const scale = lookScale(this.settings.sensitivity);
    this.yaw -= dx * scale;
    this.pitch = clamp(this.pitch - dy * scale, -1.15, 1.15);
  }

  onPointerDown(event) {
    if (!this.active || event.button !== 0 || this.state !== 'running') return;
    event.preventDefault();
    this.audio.unlock();
    this.canvas.focus({ preventScroll: true });
    this.lastClient = { x: event.clientX, y: event.clientY };
    if (document.pointerLockElement !== this.canvas && event.pointerId !== undefined) {
      try { this.canvas.setPointerCapture(event.pointerId); } catch {}
    }
    this.render(0);
    this.mode.onPointerDown();
  }

  onPointerUp(event) {
    if (!this.active || !this.mode || event.button !== 0) return;
    this.mode.onPointerUp();
  }

  onKeyDown(event) {
    if (!this.active || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      this.input.breath = this.state === 'running';
      return;
    }
    if (event.repeat) return;
    if (event.code === 'KeyR') {
      if (this.state === 'finished' || this.state === 'paused') {
        event.preventDefault();
        this.start();
      }
      return;
    }
    if (event.code === 'Escape') {
      if (this.state === 'running' || this.state === 'countdown') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  onKeyUp(event) {
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.input.breath = false;
  }

  onPointerLockChange() {
    if (!this.active || this.pointerLockFallback) return;
    if (document.pointerLockElement !== this.canvas && (this.state === 'running' || this.state === 'countdown')) {
      this.pause();
      this.callbacks.onNotice?.('鼠标已释放，3D 训练同步暂停。');
    }
  }

  requestPointerLock() {
    if (document.pointerLockElement === this.canvas) return Promise.resolve(true);
    if (!this.canvas.requestPointerLock) return Promise.resolve(false);
    return new Promise((resolve) => {
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        document.removeEventListener('pointerlockchange', check);
        resolve(result);
      };
      const check = () => {
        if (document.pointerLockElement === this.canvas) done(true);
      };
      const timeout = setTimeout(() => done(document.pointerLockElement === this.canvas), 900);
      document.addEventListener('pointerlockchange', check);
      try {
        const request = this.canvas.requestPointerLock();
        if (request?.catch) request.catch(() => done(false));
        if (document.pointerLockElement === this.canvas) done(true);
      } catch {
        done(false);
      }
    });
  }

  releasePointerLock() {
    if (document.pointerLockElement === this.canvas && document.exitPointerLock) document.exitPointerLock();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height, false);
  }

  frame(time) {
    if (!this.active) return;
    const realDt = Math.max(0, (time - this.lastFrame) / 1000);
    this.lastFrame = time;
    if (this.state === 'countdown') {
      this.countdownRemaining -= realDt;
      const number = Math.max(1, Math.ceil(this.countdownRemaining));
      if (number !== this.lastCountdownNumber && this.countdownRemaining > 0) {
        this.lastCountdownNumber = number;
        this.audio.countdown(this.lastCountdownNumber);
      }
      if (this.countdownRemaining <= 0) {
        this.state = 'running';
        this.audio.countdown(0);
        this.emitState();
      }
    } else if (this.state === 'running') {
      const activeDt = Math.min(realDt, this.remaining);
      this.remaining = Math.max(0, this.remaining - activeDt);
      this.timerCues.update(this.remaining, this.audio);
      this.mode.update(Math.min(activeDt, 0.05), this.input, activeDt);
      if (this.remaining <= 0) this.finish();
    }
    this.render(Math.min(realDt, 0.05));
    this.emitTick();
    this.frameId = requestAnimationFrame((nextTime) => this.frame(nextTime));
  }

  render(dt) {
    if (!this.mode) return;
    let swayPitch = 0;
    let swayYaw = 0;
    if (this.mode.id === 'sniper') {
      const steadiness = this.mode.breathing ? 0.08 : 1;
      const amount = this.mode.swayAmount * steadiness;
      swayPitch = Math.cos(this.mode.elapsed * 1.45) * amount;
      swayYaw = Math.sin(this.mode.elapsed * 1.75) * amount;
    }
    this.camera.rotation.set(this.pitch + swayPitch, this.yaw + swayYaw, 0);
    this.targets.forEach((target) => {
      target.userData.flash = Math.max(0, target.userData.flash - dt * 5);
      target.userData.core.material.emissiveIntensity = 0.65 + target.userData.flash * 2.5;
    });
    this.viewModel.update(dt, this.mode.elapsed, this.settings.reducedMotion);
    this.renderer.render(this.scene, this.camera);
  }

  emitState() {
    this.callbacks.onStateChange?.(this.state);
  }

  emitTick() {
    if (!this.mode) return;
    this.callbacks.onTick?.({
      state: this.state,
      remaining: this.remaining,
      countdown: Math.max(1, Math.ceil(this.countdownRemaining)),
      pointerLockFallback: this.pointerLockFallback,
      dimension: '3d',
      yaw: this.yaw,
      pitch: this.pitch,
      hud: this.mode.getHud(),
      weapon: this.mode.getWeaponHud(),
    });
  }
}
