import { BaseMode } from './base.js';
import { distance, drawLabel, drawTarget, percent, random } from '../utils.js';

export class ReactionMode extends BaseMode {
  constructor(difficulty, audio, reducedMotion) {
    super(difficulty, audio, reducedMotion, 'guardian');
    this.radius = { easy: 44, normal: 36, hard: 29 }[difficulty];
    this.delays = {
      easy: [0.65, 1.3], normal: [0.5, 1.55], hard: [0.35, 1.75],
    }[difficulty];
    this.target = null;
    this.spawnIn = random(...this.delays);
    this.bornAt = 0;
    this.reactions = [];
  }

  spawnTarget() {
    const margin = this.radius + 60;
    this.target = {
      x: random(margin, this.width - margin),
      y: random(margin + 25, this.height - margin - 50),
      radius: this.radius,
    };
    this.bornAt = this.elapsed;
  }

  onPointerDown() {
    const point = this.getAimPoint();
    if (!this.tryFire()) return;
    if (!this.target || distance(point, this.target) > this.target.radius) {
      this.registerMiss();
      return;
    }
    const reaction = Math.max(0, (this.elapsed - this.bornAt) * 1000);
    this.reactions.push(reaction);
    const points = Math.max(100, Math.round(1100 - reaction));
    this.registerHit(this.target, points, `${Math.round(reaction)} ms`, '#ffb86b');
    this.target = null;
    this.spawnIn = random(...this.delays);
  }

  update(dt, input, realDt = dt) {
    super.update(dt, input, realDt);
    if (!this.target) {
      this.spawnIn -= realDt;
      if (this.spawnIn <= 0) this.spawnTarget();
    }
  }

  render(ctx) {
    this.drawBackground(ctx);
    if (this.target) {
      drawTarget(ctx, this.target, { color: '#ffb86b', hot: '#fff0d9' });
    } else {
      drawLabel(ctx, 'WAIT FOR SIGNAL', this.width / 2, this.height / 2, {
        align: 'center', color: 'rgba(150,180,180,.24)', font: '13px monospace',
      });
    }
    this.renderEffects(ctx);
    this.renderCrosshair(ctx);
    this.renderWeaponState(ctx);
  }

  getHud() {
    const average = this.reactions.length
      ? `${Math.round(this.reactions.reduce((sum, value) => sum + value, 0) / this.reactions.length)} ms`
      : '—';
    return {
      primary: { label: '得分', value: Math.round(this.score).toLocaleString('zh-CN') },
      secondary: { label: '平均反应', value: average },
      tertiary: { label: '命中率', value: percent(this.hits, this.shots) },
    };
  }

  getResults() {
    const average = this.reactions.length
      ? this.reactions.reduce((sum, value) => sum + value, 0) / this.reactions.length
      : 0;
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
}
