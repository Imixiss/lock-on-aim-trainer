import * as THREE from '/vendor/three.module.js';

function viewMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.58,
    metalness: options.metalness ?? 0.28,
    emissive: options.emissive || 0x000000,
    emissiveIntensity: options.emissiveIntensity || 0,
    flatShading: true,
    depthTest: false,
    depthWrite: false,
  });
}

function prepare(mesh) {
  mesh.renderOrder = 1000;
  mesh.frustumCulled = false;
  return mesh;
}

function chamferedBoxGeometry(width, height, depth, cut) {
  const x = width / 2;
  const y = height / 2;
  const c = Math.min(cut, x * 0.65, y * 0.65);
  const shape = new THREE.Shape();
  shape.moveTo(-x + c, -y);
  shape.lineTo(x - c, -y);
  shape.lineTo(x, -y + c);
  shape.lineTo(x, y - c);
  shape.lineTo(x - c, y);
  shape.lineTo(-x + c, y);
  shape.lineTo(-x, y - c);
  shape.lineTo(-x, -y + c);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function taperedBoxGeometry(width, height, depth, frontScale = 0.75, frontDrop = 0) {
  const x = width / 2;
  const y = height / 2;
  const z = depth / 2;
  const frontX = x * frontScale;
  const frontY = y * frontScale;
  const positions = new Float32Array([
    -x, -y, z, x, -y, z, x, y, z, -x, y, z,
    -frontX, -frontY - frontDrop, -z, frontX, -frontY - frontDrop, -z,
    frontX, frontY - frontDrop, -z, -frontX, frontY - frontDrop, -z,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex([
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7,
  ]);
  geometry.computeVertexNormals();
  return geometry;
}

function addBox(parent, size, position, material, rotation = null) {
  const geometry = chamferedBoxGeometry(...size, Math.min(...size) * 0.22);
  const mesh = prepare(new THREE.Mesh(geometry, material));
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function addTaperedBox(parent, size, position, material, frontScale = 0.75, frontDrop = 0, rotation = null) {
  const mesh = prepare(new THREE.Mesh(taperedBoxGeometry(...size, frontScale, frontDrop), material));
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function addAccent(parent, size, position, material, rotation = null) {
  const mesh = addBox(parent, size, position, material, rotation);
  mesh.renderOrder = 1002;
  return mesh;
}

function addCylinder(parent, radius, length, position, material, rotation = null) {
  const mesh = prepare(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), material));
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function addLimb(parent, start, end, radius, material) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const length = direction.length();
  const mesh = prepare(new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.02, length - radius * 2), 5, 10), material));
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  parent.add(mesh);
  return mesh;
}

function addHand(parent, position, materials, mirrored = false) {
  const hand = new THREE.Group();
  hand.position.set(...position);
  if (mirrored) hand.scale.x = -1;
  const palm = prepare(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), materials.glove));
  palm.scale.set(0.85, 0.65, 1.15);
  hand.add(palm);
  for (let i = 0; i < 4; i += 1) {
    const finger = prepare(new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.065, 3, 6), materials.glove));
    finger.rotation.x = Math.PI / 2;
    finger.position.set(-0.045 + i * 0.028, 0.025, -0.065);
    hand.add(finger);
  }
  const thumb = prepare(new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.055, 3, 6), materials.glove));
  thumb.rotation.z = -0.65;
  thumb.position.set(0.075, -0.005, -0.005);
  hand.add(thumb);
  hand.traverse((object) => { if (object.isMesh) object.renderOrder = 1001; });
  parent.add(hand);
}

export class FirstPersonViewModel {
  constructor(camera) {
    this.camera = camera;
    this.rig = new THREE.Group();
    this.basePosition = new THREE.Vector3(0.38, -0.4, -0.72);
    this.rig.position.copy(this.basePosition);
    this.rig.rotation.set(-0.03, -0.05, -0.02);
    this.camera.add(this.rig);
    this.weaponId = null;
    this.rifle = null;
    this.kickAmount = 0;
    this.flashTime = 0;
    this.muzzleFlash = null;
    this.shells = [];
    this.shellGeometry = new THREE.CylinderGeometry(0.012, 0.012, 0.055, 10);
    this.shellMaterial = viewMaterial(0xc9a24f, { roughness: 0.22, metalness: 0.88 });
    this.buildArms();
  }

  buildArms() {
    const sleeve = viewMaterial(0x172a32, { roughness: 0.82, metalness: 0.05 });
    const cuff = viewMaterial(0x29434a, { roughness: 0.65, metalness: 0.15 });
    const glove = viewMaterial(0x3a474e, { roughness: 0.76, metalness: 0.08 });
    this.armMaterials = { sleeve, cuff, glove };
    addLimb(this.rig, [0.13, -0.18, -0.16], [0.37, -0.66, 0.34], 0.065, sleeve);
    addLimb(this.rig, [-0.12, -0.13, -0.65], [-0.37, -0.57, 0.08], 0.068, sleeve);
    addLimb(this.rig, [0.13, -0.18, -0.16], [0.18, -0.29, -0.02], 0.073, cuff);
    addLimb(this.rig, [-0.12, -0.13, -0.65], [-0.18, -0.23, -0.49], 0.075, cuff);
    addHand(this.rig, [0.13, -0.18, -0.16], this.armMaterials);
    addHand(this.rig, [-0.12, -0.13, -0.65], this.armMaterials, true);
  }

  setWeapon(id) {
    if (id === this.weaponId) return;
    this.weaponId = id;
    if (this.rifle) {
      this.rig.remove(this.rifle);
      this.rifle.traverse((object) => {
        object.geometry?.dispose();
        if (object.material) object.material.dispose();
      });
    }
    this.rifle = id === 'guardian' ? this.buildGuardian() : this.buildVandal();
    this.rig.add(this.rifle);
  }

  buildVandal() {
    const rifle = new THREE.Group();
    const metal = viewMaterial(0x20282e, { roughness: 0.52, metalness: 0.52 });
    const secondary = viewMaterial(0x46535a, { roughness: 0.6, metalness: 0.38 });
    const black = viewMaterial(0x080c0f, { roughness: 0.68, metalness: 0.18 });
    const accent = viewMaterial(0xffb86b, {
      roughness: 0.36, metalness: 0.15, emissive: 0xff9d45, emissiveIntensity: 0.24,
    });

    // Thick, short receiver and a single sloped front shell.
    addTaperedBox(rifle, [0.19, 0.17, 0.72], [0, 0, -0.28], metal, 0.9, 0.01);
    addTaperedBox(rifle, [0.18, 0.145, 0.7], [0, 0.015, -0.91], metal, 0.64, 0.035);
    addBox(rifle, [0.155, 0.075, 0.62], [0, 0.115, -0.37], secondary);
    addTaperedBox(rifle, [0.12, 0.09, 0.38], [0, 0.045, -1.39], black, 0.82, 0.008);
    addBox(rifle, [0.135, 0.105, 0.075], [0, 0.025, -1.6], secondary);
    addCylinder(rifle, 0.027, 0.012, [0, 0.025, -1.644], black, [Math.PI / 2, 0, 0]);

    // Open geometric stock keeps the silhouette light.
    addTaperedBox(rifle, [0.16, 0.14, 0.42], [0, 0.015, 0.28], metal, 0.9);
    addBox(rifle, [0.14, 0.065, 0.48], [0, 0.055, 0.52], secondary);
    addBox(rifle, [0.11, 0.055, 0.42], [0, -0.09, 0.51], metal, [0.2, 0, 0]);
    addTaperedBox(rifle, [0.19, 0.22, 0.08], [0, -0.025, 0.76], secondary, 0.86);

    addBox(rifle, [0.12, 0.28, 0.15], [0, -0.2, 0.08], black, [-0.26, 0, 0]);
    addBox(rifle, [0.135, 0.33, 0.19], [0, -0.245, -0.28], secondary, [0.06, 0, 0]);
    addBox(rifle, [0.14, 0.035, 0.2], [0, -0.418, -0.29], black, [0.06, 0, 0]);
    addBox(rifle, [0.035, 0.018, 0.13], [0, -0.115, -0.035], black);
    addBox(rifle, [0.035, 0.085, 0.018], [0, -0.15, 0.025], black);
    addBox(rifle, [0.035, 0.07, 0.018], [0, -0.15, -0.1], black, [0.25, 0, 0]);

    // Low sights and three restrained vent cuts.
    addBox(rifle, [0.09, 0.035, 0.15], [0, 0.17, -0.3], black);
    addBox(rifle, [0.04, 0.045, 0.035], [0, 0.2, -0.3], secondary);
    addBox(rifle, [0.07, 0.05, 0.035], [0, 0.135, -1.13], black);
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 3; i += 1) {
        addBox(rifle, [0.008, 0.022, 0.09], [side * 0.092, 0.08, -0.72 - i * 0.13], black);
      }
    });
    addAccent(rifle, [0.008, 0.026, 0.3], [-0.101, 0.005, -0.39], accent, [0.68, 0, 0]);

    this.addMuzzleFlash(rifle, [0, 0.025, -1.68]);
    return rifle;
  }

  buildGuardian() {
    const rifle = new THREE.Group();
    const metal = viewMaterial(0x202a30, { roughness: 0.5, metalness: 0.55 });
    const secondary = viewMaterial(0x52636a, { roughness: 0.58, metalness: 0.4 });
    const black = viewMaterial(0x070c0f, { roughness: 0.68, metalness: 0.18 });
    const accent = viewMaterial(0x79f2ca, {
      roughness: 0.34, metalness: 0.15, emissive: 0x4ad5b1, emissiveIntensity: 0.22,
    });

    // Long horizontal shell with a restrained tapered muzzle.
    addTaperedBox(rifle, [0.17, 0.15, 0.88], [0, 0, -0.33], metal, 0.93, 0.005);
    addBox(rifle, [0.145, 0.075, 1.14], [0, 0.105, -0.49], secondary);
    addTaperedBox(rifle, [0.13, 0.1, 0.62], [0, 0.035, -1.1], metal, 0.68, 0.022);
    addBox(rifle, [0.09, 0.07, 0.4], [0, 0.035, -1.51], black);
    addTaperedBox(rifle, [0.12, 0.095, 0.085], [0, 0.035, -1.735], secondary, 0.82);
    addCylinder(rifle, 0.026, 0.012, [0, 0.035, -1.783], black, [Math.PI / 2, 0, 0]);

    // Slim open stock and squared single-shot magazine.
    addBox(rifle, [0.15, 0.12, 0.36], [0, -0.005, 0.29], metal);
    addBox(rifle, [0.13, 0.065, 0.5], [0, 0.055, 0.57], secondary);
    addBox(rifle, [0.105, 0.05, 0.43], [0, -0.095, 0.56], metal, [0.18, 0, 0]);
    addTaperedBox(rifle, [0.18, 0.22, 0.075], [0, -0.025, 0.84], secondary, 0.86);
    addBox(rifle, [0.105, 0.28, 0.135], [0, -0.2, 0.08], black, [-0.26, 0, 0]);
    addBox(rifle, [0.115, 0.32, 0.17], [0, -0.235, -0.32], secondary, [0.035, 0, 0]);
    addBox(rifle, [0.12, 0.032, 0.18], [0, -0.402, -0.326], black, [0.035, 0, 0]);
    addBox(rifle, [0.032, 0.016, 0.13], [0, -0.115, 0.005], black);
    addBox(rifle, [0.032, 0.08, 0.016], [0, -0.15, 0.065], black);
    addBox(rifle, [0.032, 0.065, 0.016], [0, -0.15, -0.055], black, [0.25, 0, 0]);

    addBox(rifle, [0.08, 0.035, 0.16], [0, 0.166, -0.32], black);
    addBox(rifle, [0.035, 0.04, 0.035], [0, 0.195, -0.32], secondary);
    addBox(rifle, [0.065, 0.045, 0.035], [0, 0.145, -1.13], black);

    // One camera-facing inlay avoids showing the far-side stripe through the view model.
    addAccent(rifle, [0.008, 0.018, 0.82], [-0.088, 0.01, -0.37], accent);
    addAccent(rifle, [0.008, 0.018, 0.18], [-0.088, -0.055, 0.08], accent, [0.72, 0, 0]);
    addAccent(rifle, [0.008, 0.018, 0.12], [-0.088, -0.118, 0.17], accent);
    addAccent(rifle, [0.009, 0.028, 0.035], [-0.089, 0.035, -0.18], accent);

    this.addMuzzleFlash(rifle, [0, 0.035, -1.81]);
    return rifle;
  }

  addMuzzleFlash(rifle, position) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffe5a0,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      depthWrite: false,
    });
    const flash = prepare(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), material));
    flash.position.set(...position);
    flash.scale.set(0.8, 0.8, 2.2);
    flash.renderOrder = 1002;
    flash.visible = false;
    rifle.add(flash);
    this.muzzleFlash = flash;
  }

  resetEffects() {
    this.shells.forEach((shell) => this.rig.remove(shell));
    this.shells = [];
    this.kickAmount = 0;
    this.flashTime = 0;
    if (this.muzzleFlash) this.muzzleFlash.visible = false;
  }

  ejectShell() {
    const shell = prepare(new THREE.Mesh(this.shellGeometry, this.shellMaterial));
    shell.renderOrder = 1002;
    shell.position.set(0.115, 0.06, -0.34);
    shell.rotation.set(0, 0, Math.PI / 2);
    shell.userData.velocity = new THREE.Vector3(0.85 + Math.random() * 0.45, 0.7 + Math.random() * 0.4, 0.15 + Math.random() * 0.3);
    shell.userData.spin = new THREE.Vector3(8 + Math.random() * 6, 10 + Math.random() * 8, 7 + Math.random() * 5);
    shell.userData.life = 0.85;
    this.rig.add(shell);
    this.shells.push(shell);
    if (this.shells.length > 14) this.rig.remove(this.shells.shift());
  }

  updateShells(dt) {
    const remaining = [];
    this.shells.forEach((shell) => {
      shell.userData.life -= dt;
      if (shell.userData.life <= 0) {
        this.rig.remove(shell);
        return;
      }
      const velocity = shell.userData.velocity;
      velocity.y -= 2.8 * dt;
      shell.position.addScaledVector(velocity, dt);
      const spin = shell.userData.spin;
      shell.rotation.x += spin.x * dt;
      shell.rotation.y += spin.y * dt;
      shell.rotation.z += spin.z * dt;
      remaining.push(shell);
    });
    this.shells = remaining;
  }

  kick() {
    this.kickAmount = 1;
    this.flashTime = 0.055;
    this.ejectShell();
  }

  update(dt, elapsed, reducedMotion = false) {
    this.updateShells(dt);
    this.kickAmount = Math.max(0, this.kickAmount - dt * 8);
    this.flashTime = Math.max(0, this.flashTime - dt);
    if (this.muzzleFlash) this.muzzleFlash.visible = this.flashTime > 0;
    const idle = reducedMotion ? 0 : Math.sin(elapsed * 1.35) * 0.005;
    this.rig.position.set(
      this.basePosition.x + idle * 0.35,
      this.basePosition.y + idle - this.kickAmount * 0.018,
      this.basePosition.z + this.kickAmount * 0.085,
    );
    this.rig.rotation.x = -0.03 - this.kickAmount * 0.075;
    this.rig.rotation.y = -0.05;
    this.rig.rotation.z = -0.02 + idle * 0.3;
  }
}
