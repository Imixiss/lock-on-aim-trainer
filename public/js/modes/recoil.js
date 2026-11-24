import { BaseMode } from './base.js';
import { distance, drawLabel, drawTarget, percent } from '../utils.js';

export class GridMode extends BaseMode {
  constructor(difficulty, audio, reducedMotion) {
    super(difficulty, audio, reducedMotion, 'vandal');
    this.radius = { easy: 42, normal: 34, hard: 27 }[difficulty];
    this.grid = { centerX: 640, centerY: 305, columnGap: 190, rowGap: 135 };
    this.cells = [];
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        this.cells.push({
          x: this.grid.centerX + (column - 1) * this.grid.columnGap,
          y: this.grid.centerY + (row - 1) * this.grid.rowGap,
        });
      }
    }
    this.targets = [];
    for (let i = 0; i < 3; i += 1) this.spawnTarget(this.randomFreeCell());
  }

  randomFreeCell(excludedCell = -1) {
    const occupied = new Set(this.targets.map((target) => target.cellIndex));
    const available = this.cells
      .map((_, index) => index)
      .filter((index) => index !== excludedCell && !occupied.has(index));
    return available[Math.floor(Math.random() * available.length)];
  }

  spawnTarget(cellIndex) {
    const cell = this.cells[cellIndex];
    const target = { ...cell, radius: this.radius, cellIndex };
    this.targets.push(target);
    return target;
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
    const previousCell = target.cellIndex;
    const points = 100 + Math.min(this.combo, 10) * 5;
    this.registerHit(target, points);
    this.targets.splice(index, 1);
    this.spawnTarget(this.randomFreeCell(previousCell));
  }

  update(dt, input, realDt = dt) {
    super.update(dt, input, realDt);
  }

  drawGrid(ctx) {
    const { centerX, centerY, columnGap, rowGap } = this.grid;
    const left = centerX - columnGap * 1.5;
    const right = centerX + columnGap * 1.5;
    const top = centerY - rowGap * 1.5;
    const bottom = centerY + rowGap * 1.5;
    const lineColor = this.theme === 'light' ? 'rgba(36,85,78,.24)' : 'rgba(121,242,202,.2)';
    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 7]);
    for (let i = 0; i < 4; i += 1) {
      const x = left + i * columnGap;
      const y = top + i * rowGap;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    }
    ctx.setLineDash([]);
    drawLabel(ctx, 'GRID 05 // THREE TARGETS', left, top - 18, { color: lineColor });
    ctx.restore();
  }

  render(ctx) {
    this.drawBackground(ctx);
    this.drawGrid(ctx);
    this.targets.forEach((target) => drawTarget(ctx, target, { color: this.targetColor }));
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
        { label: '最高连击', value: String(this.bestCombo) },
      ],
    };
  }
}
