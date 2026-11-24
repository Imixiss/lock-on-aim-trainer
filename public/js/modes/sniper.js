import { BaseMode } from './base.js';
import { clamp, distance, drawCrosshair, drawLabel, percent, random } from '../utils.js';

export class SniperMode extends BaseMode {
  constructor(difficulty, audio, reducedMotion) {
    super(difficulty, audio, reducedMotion, 'guardian');
    const config = {
      easy: { radius: 43, sway: 4, exposure: 4.6 },
      normal: { radius: 33, sway: 7, exposure: 3.7 },
      hard: { radius: 25, sway: 10, exposure: 2.9 },
    }[difficulty];
    this.radius = config.radius;
    this.swayAmount = config.sway;
    this.exposure = config.exposure;
    this.stamina = 1;
    this.breathing = false;
    this.bullseyes = 0;
    this.expired = 0;
    this.deviations = [];
    this.target = null;
    this.spawnTarget();
  }

  spawnTarget() {
    const margin = this.radius + 65;
    this.target = {
      x: random(margin, this.width - margin),
      y: random(110, this.height - 150),
      radius: this.radius,
    };
    this.expiresAt = this.elapsed + this.exposure;
  }

  getAimPoint() {
    const steadiness = this.breathing ? 0.08 : 1;
    return {
      x: this.pointer.x + (Math.sin(this.elapsed * 1.75) * 0.72 + Math.sin(this.elapsed * 3.2) * 0.28) * this.swayAmount * steadiness,
      y: this.pointer.y + (Math.cos(this.elapsed * 1.45) * 0.75 + Math.sin(this.elapsed * 2.65) * 0.25) * this.swayAmount * steadiness,
      visible: this.pointer.visible,
    };
  }

  onPointerDown() {
    const point = this.getAimPoint();
    if (!this.tryFire()) return;
    const deviation = distance(point, this.target);
    this.deviations.push(deviation);
    if (deviation > this.target.radius) {
      this.registerMiss();
      return;
    }
    const ring = Math.max(1, Math.ceil((1 - deviation / this.target.radius) * 9) + 1);
    if (ring === 10) this.bullseyes += 1;
    this.registerHit(this.target, ring, `${ring} 环`, ring >= 9 ? '#ffb86b' : '#79f2ca');
    this.spawnTarget();
  }

  update(dt, input, realDt = dt) {
    super.update(dt, input, realDt);
    this.breathing = Boolean(input.breath) && this.stamina > 0.015;
    this.stamina = clamp(this.stamina + realDt * (this.breathing ? -0.3 : 0.2), 0, 1);
    if (this.elapsed >= this.expiresAt) {
      this.expired += 1;
      this.combo = 0;
      this.spawnTarget();
    }
  }

  render(ctx) {
    this.drawBackground(ctx, 'sniper');
    const { x, y, radius } = this.target;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = '#ffb86b';
    ctx.shadowBlur = 14;
    for (let ring = 5; ring >= 1; ring -= 1) {
      ctx.beginPath();
      ctx.arc(0, 0, radius * ring / 5, 0, Math.PI * 2);
      ctx.fillStyle = ring % 2 ? 'rgba(255,184,107,.18)' : 'rgba(12,25,28,.9)';
      ctx.fill();
      ctx.strokeStyle = ring <= 2 ? '#ffb86b' : 'rgba(220,240,230,.65)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffb86b';
    ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
    const remaining = clamp((this.expiresAt - this.elapsed) / this.exposure, 0, 1);
    ctx.strokeStyle = remaining < 0.3 ? '#ff6f7d' : 'rgba(255,184,107,.65)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining); ctx.stroke();
    ctx.restore();

    const barWidth = 175;
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(30, this.height - 43, barWidth, 4);
    ctx.fillStyle = this.breathing ? '#79f2ca' : '#688b86';
    ctx.fillRect(30, this.height - 43, barWidth * this.stamina, 4);
    drawLabel(ctx, this.breathing ? 'SHIFT // HOLDING BREATH' : 'SHIFT // BREATH CONTROL', 30, this.height - 54, {
      color: this.breathing ? '#79f2ca' : 'rgba(200,225,220,.55)',
    });
    this.renderEffects(ctx);
    const aim = this.getAimPoint();
    if (aim.visible !== false) drawCrosshair(ctx, aim, { color: '#ffb86b', gap: 12, length: 18, style: this.crosshairStyle });
    this.renderWeaponState(ctx);
  }

  getHud() {
    return {
      primary: { label: '总环数', value: String(Math.round(this.score)) },
      secondary: { label: '十环率', value: percent(this.bullseyes, this.shots) },
      tertiary: { label: '屏息体力', value: `${Math.round(this.stamina * 100)}%` },
    };
  }

  getResults() {
    const average = this.deviations.length
      ? this.deviations.reduce((sum, value) => sum + value, 0) / this.deviations.length
      : 0;
    return {
      score: Math.round(this.score), unit: '总环数',
      stats: [
        { label: '命中 / 射击', value: `${this.hits} / ${this.shots}` },
        { label: '十环次数', value: String(this.bullseyes) },
        { label: '平均偏差', value: this.deviations.length ? `${average.toFixed(1)} px` : '—' },
        { label: '超时目标', value: String(this.expired) },
      ],
    };
  }
}
