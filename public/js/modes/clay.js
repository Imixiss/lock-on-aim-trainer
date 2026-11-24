import { BaseMode } from './base.js';
import { distance, drawTarget, percent, random } from '../utils.js';

export class ClayMode extends BaseMode {
  constructor(difficulty, audio, reducedMotion) {
    super(difficulty, audio, reducedMotion, 'guardian');
    const config = {
      easy: { radius: 36, speed: 285, interval: 1.05, maxTargets: 3 },
      normal: { radius: 29, speed: 355, interval: 0.78, maxTargets: 4 },
      hard: { radius: 23, speed: 435, interval: 0.56, maxTargets: 5 },
    }[difficulty];
    this.config = config;
    this.targets = [];
    this.spawnIn = 0.2;
    this.escaped = 0;
  }

  spawnTarget() {
    const fromLeft = Math.random() > 0.5;
    const direction = fromLeft ? 1 : -1;
    this.targets.push({
      x: fromLeft ? -45 : this.width + 45,
      y: random(510, 585),
      vx: direction * this.config.speed * random(0.82, 1.2),
      vy: random(-665, -575),
      gravity: random(590, 660),
      radius: this.config.radius,
    });
  }

  onPointerDown() {
    const point = this.getAimPoint();
    if (!this.tryFire()) return;
    const index = this.targets.findIndex((target) => distance(point, target) <= target.radius);
    if (index === -1) {
      this.registerMiss();
      return;
    }
    const target = this.targets[index];
    const points = 100 + Math.min(this.combo, 10) * 10;
    this.registerHit(target, points, 'BREAK', '#ffb86b');
    this.targets.splice(index, 1);
  }

  update(dt, input, realDt = dt) {
    super.update(dt, input, realDt);
    this.spawnIn -= realDt;
    if (this.spawnIn <= 0 && this.targets.length < this.config.maxTargets) {
      this.spawnTarget();
      this.spawnIn = this.config.interval * random(0.75, 1.25);
    }
    this.targets.forEach((target) => {
      target.vy += target.gravity * dt;
      target.x += target.vx * dt;
      target.y += target.vy * dt;
    });
    const remaining = [];
    this.targets.forEach((target) => {
      if (target.y > this.height + 65 || target.x < -100 || target.x > this.width + 100) {
        this.escaped += 1;
        this.combo = 0;
      } else {
        remaining.push(target);
      }
    });
    this.targets = remaining;
  }

  render(ctx) {
    this.drawBackground(ctx, 'clay');
    ctx.fillStyle = 'rgba(255,184,107,.035)';
    ctx.beginPath(); ctx.moveTo(0, 570); ctx.lineTo(230, 490); ctx.lineTo(420, 570); ctx.lineTo(700, 475); ctx.lineTo(980, 570); ctx.lineTo(1280, 500); ctx.lineTo(1280, 720); ctx.lineTo(0, 720); ctx.fill();
    this.targets.forEach((target) => {
      drawTarget(ctx, target, { color: '#ffb86b', hot: '#fff1d9', scaleY: 0.48 });
    });
    this.renderEffects(ctx);
    this.renderCrosshair(ctx, { color: this.crosshairColor });
    this.renderWeaponState(ctx);
  }

  get interception() {
    const total = this.hits + this.escaped;
    return total ? this.hits / total : 0;
  }

  getHud() {
    return {
      primary: { label: '得分', value: Math.round(this.score).toLocaleString('zh-CN') },
      secondary: { label: '拦截率', value: percent(this.hits, this.hits + this.escaped) },
      tertiary: { label: '当前连击', value: String(this.combo) },
    };
  }

  getResults() {
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
}
