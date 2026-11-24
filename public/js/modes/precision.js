import { BaseMode } from './base.js';
import { minimumTargetCenterDistance } from '../config.js';
import { distance, drawTarget, integer, percent, random } from '../utils.js';

export class PrecisionMode extends BaseMode {
  constructor(difficulty, audio, reducedMotion) {
    super(difficulty, audio, reducedMotion, 'guardian');
    this.radius = { easy: 40, normal: 32, hard: 25 }[difficulty];
    this.targets = [];
    for (let i = 0; i < 3; i += 1) this.targets.push(this.spawnTarget());
  }

  spawnTarget() {
    const margin = this.radius + 55;
    const minDistance = minimumTargetCenterDistance(this.radius);
    const isClear = (x, y) => !this.targets || this.targets.every((other) => Math.hypot(x - other.x, y - other.y) >= minDistance);
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const x = random(margin, this.width - margin);
      const y = random(margin + 20, this.height - margin - 45);
      if (isClear(x, y)) return { x, y, radius: this.radius };
    }
    for (let y = margin + 20; y <= this.height - margin - 45; y += minDistance) {
      for (let x = margin; x <= this.width - margin; x += minDistance) {
        if (isClear(x, y)) return { x, y, radius: this.radius };
      }
    }
    throw new Error('Unable to place targets with the required minimum spacing');
  }

  onPointerDown() {
    const point = this.getAimPoint();
    if (!this.tryFire()) return;
    const index = this.targets.findIndex((target) => distance(point, target) <= target.radius);
    if (index === -1) {
      this.registerMiss();
      return;
    }
    const points = 100 + Math.min(this.combo, 10) * 5;
    this.registerHit(this.targets[index], points);
    this.targets[index] = this.spawnTarget();
  }

  update(dt, input, realDt = dt) {
    super.update(dt, input, realDt);
  }

  render(ctx) {
    this.drawBackground(ctx);
    this.targets.forEach((target, index) => {
      drawTarget(ctx, target, { color: this.targetColor });
      ctx.fillStyle = 'rgba(121,242,202,.38)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`0${index + 1}`, target.x, target.y + target.radius + 18);
    });
    this.renderEffects(ctx);
    this.renderCrosshair(ctx);
    this.renderWeaponState(ctx);
  }

  getResults() {
    return {
      score: Math.round(this.score), unit: '得分',
      stats: [
        { label: '命中 / 射击', value: `${this.hits} / ${this.shots}` },
        { label: '命中率', value: percent(this.hits, this.shots) },
        { label: '每秒命中', value: (this.hits / Math.max(this.elapsed, 0.01)).toFixed(2) },
        { label: '最高连击', value: integer(this.bestCombo) },
      ],
    };
  }
}
