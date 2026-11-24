import { BaseMode } from './base.js';
import { TrackingScore } from '../tracking-score.js';
import { distance, drawTarget, random } from '../utils.js';

export class TrackingMode extends BaseMode {
  constructor(difficulty, audio, reducedMotion) {
    super(difficulty, audio, reducedMotion, 'vandal');
    const config = {
      easy: { radius: 48, speed: 235 },
      normal: { radius: 38, speed: 305 },
      hard: { radius: 30, speed: 385 },
    }[difficulty];
    this.radius = config.radius;
    this.speed = config.speed;
    this.target = { x: this.width / 2, y: this.height / 2, radius: this.radius, vx: this.speed, vy: 0 };
    this.changeIn = 0.8;
    this.trigger = false;
    this.fireAccumulator = 0;
    this.trail = [];
    this.trackingScore = new TrackingScore();
  }

  onPointerDown() {
    this.trigger = true;
    this.fireAccumulator = this.fireInterval;
  }

  onPointerUp() {
    this.trigger = false;
    this.fireAccumulator = 0;
  }

  fireAtTarget() {
    if (!this.tryFire(true)) return false;
    if (distance(this.getAimPoint(), this.target) <= this.target.radius && this.shots % 3 === 0) this.audio.hit();
    return true;
  }

  update(dt, input, realDt = dt) {
    super.update(dt, input, realDt);
    this.changeIn -= realDt;
    if (this.changeIn <= 0) {
      const angle = Math.atan2(this.target.vy, this.target.vx) + random(-1.65, 1.65);
      const speed = this.speed * random(0.72, 1.25);
      this.target.desiredVx = Math.cos(angle) * speed;
      this.target.desiredVy = Math.sin(angle) * speed;
      this.changeIn = random(0.65, 1.35);
    }
    const smoothing = Math.min(1, dt * 4);
    this.target.vx += ((this.target.desiredVx ?? this.target.vx) - this.target.vx) * smoothing;
    this.target.vy += ((this.target.desiredVy ?? this.target.vy) - this.target.vy) * smoothing;
    this.target.x += this.target.vx * dt;
    this.target.y += this.target.vy * dt;
    const margin = this.radius + 35;
    if (this.target.x < margin || this.target.x > this.width - margin) {
      this.target.x = Math.max(margin, Math.min(this.width - margin, this.target.x));
      this.target.vx *= -1;
      this.target.desiredVx = this.target.vx;
    }
    if (this.target.y < margin + 25 || this.target.y > this.height - margin - 45) {
      this.target.y = Math.max(margin + 25, Math.min(this.height - margin - 45, this.target.y));
      this.target.vy *= -1;
      this.target.desiredVy = this.target.vy;
    }
    if (!this.reducedMotion) {
      this.trail.push({ x: this.target.x, y: this.target.y });
      if (this.trail.length > 14) this.trail.shift();
    }

    this.trackingScore.update(distance(this.getAimPoint(), this.target) / this.target.radius, realDt);
    if (this.trigger) {
      this.fireAccumulator += dt;
      while (this.fireAccumulator + 0.00001 >= this.fireInterval) {
        this.fireAccumulator -= this.fireInterval;
        if (!this.fireAtTarget()) {
          this.fireAccumulator = 0;
          break;
        }
      }
    }
  }

  render(ctx) {
    this.drawBackground(ctx);
    if (this.trail.length > 1) {
      ctx.strokeStyle = 'rgba(121,242,202,.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.trail.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.stroke();
    }
    drawTarget(ctx, this.target, { color: this.targetColor });
    ctx.strokeStyle = 'rgba(230,255,246,.38)';
    ctx.lineWidth = 0.8;
    [0.2, 0.45, 0.7].forEach((ratio) => {
      ctx.beginPath();
      ctx.arc(this.target.x, this.target.y, this.target.radius * ratio, 0, Math.PI * 2);
      ctx.stroke();
    });
    this.renderEffects(ctx);
    this.renderCrosshair(ctx, { gap: 9, length: 13 });
    this.renderWeaponState(ctx);
  }

  getHud() {
    return this.trackingScore.getHud();
  }

  getResults() {
    return this.trackingScore.getResults();
  }
}
