import { getModeDefinition, ROUND_RESTART_DELAY_MS, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import { createMode } from './modes/index.js';
import { clamp } from './utils.js';
import { relativeSensitivity } from './sensitivity.js';
import { TimerCues } from './timer-cues.js';

export class Game {
  constructor(canvas, audio, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audio;
    this.callbacks = callbacks;
    this.active = false;
    this.state = 'idle';
    this.mode = null;
    this.definition = null;
    this.settings = { difficulty: 'normal', duration: 30, reducedMotion: false };
    this.input = { breath: false };
    this.remaining = 30;
    this.countdownRemaining = 3;
    this.lastCountdownNumber = 3;
    this.pausedFrom = 'running';
    this.pointerLockFallback = false;
    this.fallbackPoint = null;
    this.lastFrame = 0;
    this.frameId = 0;
    this.timerCues = new TimerCues();

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
      if (!this.active || !this.definition?.pointerLock) return;
      if (this.state === 'running' || this.state === 'countdown') {
        this.pointerLockFallback = true;
        this.fallbackPoint = null;
        this.callbacks.onNotice?.('鼠标锁定不可用，已切换为拖拽补偿模式。');
      }
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
  }

  load(id, settings) {
    this.releasePointerLock();
    this.active = true;
    this.definition = getModeDefinition(id);
    this.settings = { ...this.settings, ...settings };
    this.mode = createMode(id, this.settings.difficulty, this.audio, this.settings.reducedMotion);
    this.remaining = this.settings.duration;
    this.timerCues.reset();
    this.countdownRemaining = 3;
    this.input.breath = false;
    this.pointerLockFallback = false;
    this.fallbackPoint = null;
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
    this.mode = createMode(this.definition.id, this.settings.difficulty, this.audio, this.settings.reducedMotion);
    this.remaining = this.settings.duration;
    this.timerCues.reset();
    this.countdownRemaining = 3;
    this.lastCountdownNumber = 3;
    this.input.breath = false;
    this.pointerLockFallback = false;
    this.fallbackPoint = null;
    this.state = 'idle';

    if (this.definition.pointerLock) {
      const locked = await this.requestPointerLock();
      this.pointerLockFallback = !locked;
      if (!locked) this.callbacks.onNotice?.('当前环境未允许鼠标锁定，已进入拖拽补偿模式；Esc 仍可暂停。');
    }

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
    if (this.definition.pointerLock) {
      const locked = await this.requestPointerLock();
      this.pointerLockFallback = !locked;
      this.fallbackPoint = null;
      if (!locked) this.callbacks.onNotice?.('鼠标锁定未恢复，继续使用拖拽补偿模式。');
    }
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
    if (!this.active || !this.mode) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const absolute = {
      x: clamp((event.clientX - rect.left) * WORLD_WIDTH / rect.width, 0, WORLD_WIDTH),
      y: clamp((event.clientY - rect.top) * WORLD_HEIGHT / rect.height, 0, WORLD_HEIGHT),
    };
    if (this.definition.pointerLock) {
      const sensitivity = relativeSensitivity(this.settings.sensitivity);
      if (this.pointerLockFallback) {
        if (this.fallbackPoint) {
          this.mode.onPointerMove({
            dx: (absolute.x - this.fallbackPoint.x) * sensitivity,
            dy: (absolute.y - this.fallbackPoint.y) * sensitivity,
          });
        }
        this.fallbackPoint = absolute;
      } else {
        if (document.pointerLockElement !== this.canvas) return;
        this.mode.onPointerMove({
          dx: event.movementX * WORLD_WIDTH / rect.width * sensitivity,
          dy: event.movementY * WORLD_HEIGHT / rect.height * sensitivity,
        });
      }
      return;
    }
    this.mode.onPointerMove(absolute);
  }

  onPointerDown(event) {
    if (!this.active || event.button !== 0 || this.state !== 'running') return;
    if (this.definition.pointerLock && !this.pointerLockFallback && document.pointerLockElement !== this.canvas) return;
    event.preventDefault();
    this.audio.unlock();
    this.canvas.focus({ preventScroll: true });
    if (!this.definition.pointerLock && event.pointerId !== undefined) {
      try { this.canvas.setPointerCapture(event.pointerId); } catch {}
    }
    this.onPointerMove(event);
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
    if (!this.active || !this.definition?.pointerLock || this.pointerLockFallback) return;
    if (document.pointerLockElement !== this.canvas && (this.state === 'running' || this.state === 'countdown')) {
      this.pause();
      this.callbacks.onNotice?.('鼠标已释放，训练同步暂停。');
    }
  }

  requestPointerLock() {
    if (document.pointerLockElement === this.canvas) return Promise.resolve(true);
    if (!this.canvas.requestPointerLock) {
      this.callbacks.onNotice?.('当前浏览器不支持鼠标锁定，请使用最新版桌面浏览器。');
      return Promise.resolve(false);
    }
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
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.render();
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

    this.render();
    this.emitTick();
    this.frameId = requestAnimationFrame((nextTime) => this.frame(nextTime));
  }

  render() {
    if (!this.mode || !this.canvas.width || !this.canvas.height) return;
    const scaleX = this.canvas.width / WORLD_WIDTH;
    const scaleY = this.canvas.height / WORLD_HEIGHT;
    this.ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    this.ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.mode.theme = this.settings.theme || 'dark';
    this.mode.targetColor = this.settings.theme === 'light' ? '#0b8f70' : '#79f2ca';
    this.mode.crosshairColor = this.settings.theme === 'light' ? '#173f38' : '#d8fff1';
    this.mode.crosshairStyle = this.settings.crosshair;
    this.mode.render(this.ctx);
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
      hud: this.mode.getHud(),
      weapon: this.mode.getWeaponHud(),
    });
  }
}
