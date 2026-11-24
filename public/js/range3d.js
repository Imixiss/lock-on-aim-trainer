import { BaseMode } from './modes/base.js';
import { TrackingScore } from './tracking-score.js';
import { getModeDefinition, minimumTargetCenterDistance } from './config.js';
import { percent, random } from './utils.js';

export class Range3D extends BaseMode {
  constructor(id, difficulty, audio, reducedMotion, host) {
    const definition = getModeDefinition(id);
    super(difficulty, audio, reducedMotion, definition.weapon);
    this.id = id;
    this.host = host;
    this.targets = [];
    this.target = null;
    this.trigger = false;
    this.fireAccumulator = 0;
    this.reactions = [];
    this.deviations = [];
    this.bullseyes = 0;
    this.expired = 0;
    this.escaped = 0;
    this.stamina = 1;
    this.breathing = false;
    this.lastHitTarget = null;
    this.trackingScore = new TrackingScore();
    this.setup();
  }

  setup() {
    if (this.id === 'precision') {
      this.radius = { easy: 0.9, normal: 0.7, hard: 0.52 }[this.difficulty];
      for (let i = 0; i < 3; i += 1) {
        const target = this.spawnTarget();
        if (i === 0) target.position.set(0, 2.2, -14);
        this.targets.push(target);
      }
      return;
    }
    if (this.id === 'reaction') {
      this.radius = { easy: 1, normal: 0.78, hard: 0.58 }[this.difficulty];
      this.delays = { easy: [0.65, 1.3], normal: [0.5, 1.55], hard: [0.35, 1.75] }[this.difficulty];
      this.spawnIn = random(...this.delays);
      return;
    }
    if (this.id === 'tracking') {
      const config = {
        easy: { radius: 1.05, speed: 2.2 }, normal: { radius: 0.82, speed: 3.1 }, hard: { radius: 0.64, speed: 4.1 },
      }[this.difficulty];
      this.radius = config.radius;
      this.speed = config.speed;
      this.target = this.host.createTarget(this.radius, '#79f2ca', 'tracking');
      this.target.position.set(0, 2.2, -14);
      this.target.vx = this.speed;
      this.target.vy = 0;
      this.changeIn = 0.8;
      return;
    }
    if (this.id === 'sniper') {
      const config = {
        easy: { radius: 0.72, sway: 0.0012, exposure: 4.6 },
        normal: { radius: 0.52, sway: 0.002, exposure: 3.7 },
        hard: { radius: 0.38, sway: 0.0028, exposure: 2.9 },
      }[this.difficulty];
      this.radius = config.radius;
      this.swayAmount = config.sway;
      this.exposure = config.exposure;
      this.spawnSniperTarget(true);
      return;
    }
    if (this.id === 'grid') {
      this.radius = { easy: 0.78, normal: 0.64, hard: 0.52 }[this.difficulty];
      const xLines = [-4.2, -1.4, 1.4, 4.2];
      const yLines = [0.5, 2, 3.5, 5];
      this.host.createGridGuide(xLines, yLines, -14.15);
      this.gridCells = [];
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          this.gridCells.push([-2.8 + column * 2.8, 1.25 + row * 1.5, -14]);
        }
      }
      for (let i = 0; i < 3; i += 1) this.spawnGridTarget(this.randomFreeGridCell());
      return;
    }
    if (this.id === 'clay') {
      this.config = {
        easy: { radius: 0.72, speed: 4, interval: 1.05, maxTargets: 3 },
        normal: { radius: 0.56, speed: 5, interval: 0.78, maxTargets: 4 },
        hard: { radius: 0.43, speed: 6.2, interval: 0.56, maxTargets: 5 },
      }[this.difficulty];
      this.spawnIn = 0.2;
    }
  }

  randomFreeGridCell(excludedCell = -1) {
    const occupied = new Set(this.targets.map((target) => target.userData.gridCell));
    const available = this.gridCells
      .map((_, index) => index)
      .filter((index) => index !== excludedCell && !occupied.has(index));
    return available[Math.floor(Math.random() * available.length)];
  }

  spawnGridTarget(cellIndex) {
    const target = this.host.createTarget(this.radius);
    target.position.set(...this.gridCells[cellIndex]);
    target.userData.gridCell = cellIndex;
    this.targets.push(target);
    return target;
  }

  spawnTarget() {
    const target = this.host.createTarget(this.radius);
    target.position.set(...this.findSpawnPosition());
    return target;
  }

  findSpawnPosition() {
    const minDistance = minimumTargetCenterDistance(this.radius);
    const isClear = (x, y, z) => {
      if (this.host.isSpawnPositionClear) return this.host.isSpawnPositionClear([x, y, z], this.radius, this.targets, minDistance);
      return this.targets.every((other) => Math.hypot(x - other.position.x, y - other.position.y, z - other.position.z) >= minDistance);
    };
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const x = random(-6, 6);
      const y = random(1.2, 4.9);
      const z = random(-19, -13);
      if (isClear(x, y, z)) return [x, y, z];
    }
    for (let z = -14; z >= -22; z -= minDistance) {
      for (let y = 1.4; y <= 4.8; y += minDistance) {
        for (let x = -6; x <= 6; x += minDistance) {
          if (isClear(x, y, z)) return [x, y, z];
        }
      }
    }
    throw new Error('Unable to place 3D targets with the required minimum spacing');
  }

  spawnSniperTarget(centered = false) {
    this.target = this.host.createTarget(this.radius, '#ffb86b', 'sniper');
    if (centered) this.target.position.set(0, 2.2, -22);
    else this.target.position.set(random(-6.5, 6.5), random(1.3, 4.8), -22);
    this.expiresAt = this.elapsed + this.exposure;
  }

  spawnClay() {
    const fromLeft = Math.random() > 0.5;
    const direction = fromLeft ? 1 : -1;
    const target = this.host.createTarget(this.config.radius, '#ffb86b', 'clay');
    target.position.set(fromLeft ? -10 : 10, random(0.8, 1.3), random(-16, -12));
    target.vx = direction * this.config.speed * random(0.85, 1.18);
    target.vy = random(5.5, 6.5);
    target.gravity = random(9.2, 10.2);
    this.targets.push(target);
  }

  addHitEffect() {
    this.host.flashTarget(this.lastHitTarget);
  }

  onPointerDown() {
    if (this.id === 'tracking') {
      this.trigger = true;
      this.fireAccumulator = this.fireInterval;
      return;
    }
    this.shoot();
  }

  onPointerUp() {
    this.trigger = false;
    this.fireAccumulator = 0;
  }

  shoot() {
    if (!this.tryFire()) return;
    this.host.kick();
    if (this.id === 'precision') this.shootPrecision();
    else if (this.id === 'reaction') this.shootReaction();
    else if (this.id === 'sniper') this.shootSniper();
    else if (this.id === 'grid') this.shootGrid();
    else if (this.id === 'clay') this.shootClay();
  }

  shootPrecision() {
    const hit = this.host.raycast(this.targets);
    if (!hit) {
      this.registerMiss();
      return;
    }
    const points = 100 + Math.min(this.combo, 10) * 5;
    this.lastHitTarget = hit.target;
    this.registerHit({ x: 0, y: 0 }, points);
    const index = this.targets.indexOf(hit.target);
    this.host.removeTarget(hit.target);
    this.targets[index] = this.spawnTarget();
  }

  shootGrid() {
    const hit = this.host.raycast(this.targets);
    if (!hit) {
      this.registerMiss();
      return;
    }
    const previousCell = hit.target.userData.gridCell;
    const points = 100 + Math.min(this.combo, 10) * 5;
    this.lastHitTarget = hit.target;
    this.registerHit({ x: 0, y: 0 }, points);
    const index = this.targets.indexOf(hit.target);
    this.host.removeTarget(hit.target);
    this.targets.splice(index, 1);
    this.spawnGridTarget(this.randomFreeGridCell(previousCell));
  }

  shootReaction() {
    const hit = this.target ? this.host.raycast([this.target]) : null;
    if (!hit) {
      this.registerMiss();
      return;
    }
    const reaction = Math.max(0, (this.elapsed - this.bornAt) * 1000);
    this.reactions.push(reaction);
    const points = Math.max(100, Math.round(1100 - reaction));
    this.lastHitTarget = this.target;
    this.registerHit({ x: 0, y: 0 }, points, `${Math.round(reaction)} ms`, '#ffb86b');
    this.host.removeTarget(this.target);
    this.target = null;
    this.spawnIn = random(...this.delays);
  }

  shootSniper() {
    const deviation = this.host.rayDistance(this.target);
    this.deviations.push(deviation);
    const hit = this.host.raycast([this.target]);
    if (!hit || deviation > this.target.userData.radius) {
      this.registerMiss();
      return;
    }
    const ring = Math.max(1, Math.ceil((1 - deviation / this.target.userData.radius) * 9) + 1);
    if (ring === 10) this.bullseyes += 1;
    this.lastHitTarget = this.target;
    this.registerHit({ x: 0, y: 0 }, ring, `${ring} 环`, ring >= 9 ? '#ffb86b' : '#79f2ca');
    this.host.removeTarget(this.target);
    this.spawnSniperTarget();
  }

  shootClay() {
    const hit = this.host.raycast(this.targets);
    if (!hit) {
      this.registerMiss();
      return;
    }
    const points = 100 + Math.min(this.combo, 10) * 10;
    this.lastHitTarget = hit.target;
    this.registerHit({ x: 0, y: 0 }, points, 'BREAK', '#ffb86b');
    this.host.removeTarget(hit.target);
    this.targets = this.targets.filter((target) => target !== hit.target);
  }

  fireAutomatic() {
    if (!this.tryFire(true)) return false;
    this.host.kick();
    const hit = this.host.raycast([this.target]);
    if (hit && this.shots % 3 === 0) this.audio.hit();
    if (hit && this.shots % 4 === 0) this.host.flashTarget(this.target);
    return true;
  }

  update(dt, input, realDt = dt) {
    super.update(dt, input, realDt);
    if (this.id === 'reaction') this.updateReaction(realDt);
    else if (this.id === 'tracking') this.updateTracking(dt, realDt);
    else if (this.id === 'sniper') this.updateSniper(input, realDt);
    else if (this.id === 'clay') this.updateClay(dt, realDt);
  }

  updateReaction(realDt) {
    if (this.target) return;
    this.spawnIn -= realDt;
    if (this.spawnIn <= 0) {
      this.target = this.spawnTarget();
      this.bornAt = this.elapsed;
    }
  }

  updateTracking(dt, realDt) {
    this.changeIn -= realDt;
    if (this.changeIn <= 0) {
      const angle = Math.atan2(this.target.vy, this.target.vx) + random(-1.5, 1.5);
      const speed = this.speed * random(0.72, 1.25);
      this.target.desiredVx = Math.cos(angle) * speed;
      this.target.desiredVy = Math.sin(angle) * speed;
      this.changeIn = random(0.65, 1.35);
    }
    const smoothing = Math.min(1, dt * 4);
    this.target.vx += ((this.target.desiredVx ?? this.target.vx) - this.target.vx) * smoothing;
    this.target.vy += ((this.target.desiredVy ?? this.target.vy) - this.target.vy) * smoothing;
    this.target.position.x += this.target.vx * dt;
    this.target.position.y += this.target.vy * dt;
    if (Math.abs(this.target.position.x) > 6.3) {
      this.target.position.x = Math.sign(this.target.position.x) * 6.3;
      this.target.vx *= -1;
      this.target.desiredVx = this.target.vx;
    }
    if (this.target.position.y < 1.1 || this.target.position.y > 5) {
      this.target.position.y = Math.max(1.1, Math.min(5, this.target.position.y));
      this.target.vy *= -1;
      this.target.desiredVy = this.target.vy;
    }
    this.trackingScore.update(this.host.rayDistance(this.target) / this.target.userData.radius, realDt);
    this.updateAutomatic(dt);
  }

  updateSniper(input, realDt) {
    this.breathing = Boolean(input.breath) && this.stamina > 0.015;
    this.stamina = Math.max(0, Math.min(1, this.stamina + realDt * (this.breathing ? -0.3 : 0.2)));
    if (this.elapsed >= this.expiresAt) {
      this.expired += 1;
      this.combo = 0;
      this.host.removeTarget(this.target);
      this.spawnSniperTarget();
    }
  }

  updateAutomatic(dt) {
    if (!this.trigger) return;
    this.fireAccumulator += dt;
    while (this.fireAccumulator + 0.00001 >= this.fireInterval) {
      this.fireAccumulator -= this.fireInterval;
      if (!this.fireAutomatic()) {
        this.fireAccumulator = 0;
        break;
      }
    }
  }

  updateClay(dt, realDt) {
    this.spawnIn -= realDt;
    if (this.spawnIn <= 0 && this.targets.length < this.config.maxTargets) {
      this.spawnClay();
      this.spawnIn = this.config.interval * random(0.75, 1.25);
    }
    this.targets.forEach((target) => {
      target.vy -= target.gravity * dt;
      target.position.x += target.vx * dt;
      target.position.y += target.vy * dt;
    });
    const remaining = [];
    this.targets.forEach((target) => {
      if (target.position.y < 0 || Math.abs(target.position.x) > 12) {
        this.escaped += 1;
        this.combo = 0;
        this.host.removeTarget(target);
      } else {
        remaining.push(target);
      }
    });
    this.targets = remaining;
  }

  getAverageDeviation() {
    return this.deviations.length
      ? this.deviations.reduce((sum, value) => sum + value, 0) / this.deviations.length
      : 0;
  }

  getHud() {
    if (this.id === 'reaction') {
      const average = this.reactions.length
        ? `${Math.round(this.reactions.reduce((sum, value) => sum + value, 0) / this.reactions.length)} ms`
        : '—';
      return {
        primary: { label: '得分', value: String(Math.round(this.score)) },
        secondary: { label: '平均反应', value: average },
        tertiary: { label: '命中率', value: percent(this.hits, this.shots) },
      };
    }
    if (this.id === 'tracking') return this.trackingScore.getHud();
    if (this.id === 'sniper') {
      return {
        primary: { label: '总环数', value: String(Math.round(this.score)) },
        secondary: { label: '十环率', value: percent(this.bullseyes, this.shots) },
        tertiary: { label: '屏息体力', value: `${Math.round(this.stamina * 100)}%` },
      };
    }
    if (this.id === 'clay') {
      return {
        primary: { label: '得分', value: String(Math.round(this.score)) },
        secondary: { label: '拦截率', value: percent(this.hits, this.hits + this.escaped) },
        tertiary: { label: '当前连击', value: String(this.combo) },
      };
    }
    return super.getHud();
  }

  getResults() {
    if (this.id === 'reaction') {
      const average = this.reactions.length ? this.reactions.reduce((sum, value) => sum + value, 0) / this.reactions.length : 0;
      const best = this.reactions.length ? Math.min(...this.reactions) : 0;
      return {
        score: Math.round(this.score), unit: '得分',
        stats: [
          { label: '平均反应', value: average ? `${Math.round(average)} ms` : '—' },
          { label: '最佳反应', value: best ? `${Math.round(best)} ms` : '—' },
          { label: '命中 / 射击', value: `${this.hits} / ${this.shots}` },
          { label: '命中率', value: percent(this.hits, this.shots) },
        ],
      };
    }
    if (this.id === 'tracking') return this.trackingScore.getResults();
    if (this.id === 'sniper') {
      return {
        score: Math.round(this.score), unit: '总环数',
        stats: [
          { label: '命中 / 射击', value: `${this.hits} / ${this.shots}` },
          { label: '十环次数', value: String(this.bullseyes) },
          { label: '平均偏差', value: this.deviations.length ? `${(this.getAverageDeviation() * 100).toFixed(1)} cm` : '—' },
          { label: '超时目标', value: String(this.expired) },
        ],
      };
    }
    if (this.id === 'clay') {
      return {
        score: Math.round(this.score), unit: '得分',
        stats: [
          { label: '击碎 / 逃逸', value: `${this.hits} / ${this.escaped}` },
          { label: '拦截率', value: percent(this.hits, this.hits + this.escaped) },
          { label: '射击命中率', value: percent(this.hits, this.shots) },
          { label: '最高连击', value: String(this.bestCombo) },
        ],
      };
    }
    return {
      score: Math.round(this.score), unit: '得分',
      stats: [
        { label: '命中 / 射击', value: `${this.hits} / ${this.shots}` },
        { label: '命中率', value: percent(this.hits, this.shots) },
        { label: '每秒命中', value: (this.hits / Math.max(this.elapsed, 0.01)).toFixed(2) },
        { label: '最高连击', value: String(this.bestCombo) },
      ],
    };
  }
}
