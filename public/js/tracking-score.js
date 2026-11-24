import { integer } from './utils.js';

export function trackingRing(ratio) {
  if (ratio <= 0.2) return 10;
  if (ratio <= 0.45) return 8;
  if (ratio <= 0.7) return 6;
  if (ratio <= 1) return 4;
  return 0;
}

export class TrackingScore {
  constructor() {
    this.score = 0;
    this.hoverTime = 0;
    this.bullseyeTime = 0;
    this.bestStreak = 0;
    this.currentStreak = 0;
    this.ringTimeSum = 0;
    this.currentRing = 0;
  }

  update(ratio, dt) {
    const ring = trackingRing(ratio);
    this.currentRing = ring;
    if (!ring) {
      this.currentStreak = 0;
      return;
    }
    this.hoverTime += dt;
    this.currentStreak += dt;
    this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
    this.ringTimeSum += ring * dt;
    this.score += ring * 10 * dt;
    if (ring === 10) this.bullseyeTime += dt;
  }

  get averageRing() {
    return this.hoverTime > 0 ? this.ringTimeSum / this.hoverTime : 0;
  }

  getHud() {
    return {
      primary: { label: '环数积分', value: integer(this.score) },
      secondary: { label: '悬停时间', value: `${this.hoverTime.toFixed(1)} s` },
      tertiary: { label: '当前环数', value: this.currentRing ? `${this.currentRing} 环` : '脱靶' },
    };
  }

  getResults() {
    return {
      score: Math.round(this.score),
      unit: '环数积分',
      stats: [
        { label: '总悬停时间', value: `${this.hoverTime.toFixed(2)} s` },
        { label: '平均环数', value: this.hoverTime ? this.averageRing.toFixed(2) : '—' },
        { label: '十环时间', value: `${this.bullseyeTime.toFixed(2)} s` },
        { label: '最长连续悬停', value: `${this.bestStreak.toFixed(2)} s` },
      ],
    };
  }
}
