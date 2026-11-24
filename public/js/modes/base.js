import { WEAPONS, WORLD_HEIGHT, WORLD_WIDTH } from '../config.js';
import { clamp, drawCrosshair, drawLabel, integer, percent, random } from '../utils.js';

export class BaseMode {
  constructor(difficulty, audio, reducedMotion, weaponId) {
    this.difficulty = difficulty;
    this.audio = audio;
    this.reducedMotion = reducedMotion;
    this.weapon = WEAPONS[weaponId];
    this.width = WORLD_WIDTH;
    this.height = WORLD_HEIGHT;
    this.elapsed = 0;
    this.score = 0;
    this.shots = 0;
    this.hits = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.lastShotAt = -Infinity;
    this.theme = 'dark';
    this.targetColor = '#79f2ca';
    this.crosshairColor = '#d8fff1';
    this.pointer = { x: this.width / 2, y: this.height / 2, visible: true };
    this.effects = [];
    this.particles = [];
  }

  get accuracy() {
    return this.shots > 0 ? this.hits / this.shots : 0;
  }

  get fireInterval() {
    return 1 / this.weapon.fireRate;
  }

  getAimPoint() {
    return this.pointer;
  }

  onPointerMove(point) {
    this.pointer.x = point.x;
    this.pointer.y = point.y;
    this.pointer.visible = true;
  }

  onPointerDown() {}
  onPointerUp() {}

  tryFire(ignoreCadence = false) {
    if (!ignoreCadence && this.elapsed - this.lastShotAt + 0.00001 < this.fireInterval) return false;
    this.lastShotAt = this.elapsed;
    this.shots += 1;
    this.audio.shoot(this.weapon.automatic);
    return true;
  }

  registerHit(point, points, label = `+${points}`, color = this.targetColor) {
    this.hits += 1;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.score += points;
    this.audio.hit();
    this.addHitEffect(point, label, color);
  }

  registerMiss(withSound = true) {
    this.combo = 0;
    if (withSound) this.audio.miss();
  }

  addHitEffect(point, label, color) {
    this.effects.push({ x: point.x, y: point.y, text: label, color, life: 0.65, maxLife: 0.65 });
    if (this.reducedMotion) return;
    for (let i = 0; i < 9; i += 1) {
      const angle = random(0, Math.PI * 2);
      const speed = random(45, 155);
      this.particles.push({
        x: point.x, y: point.y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        color, life: random(0.18, 0.42), maxLife: 0.42,
      });
    }
  }

  update(dt, input, realDt = dt) {
    this.elapsed += realDt;
    this.effects.forEach((effect) => { effect.life -= realDt; });
    this.effects = this.effects.filter((effect) => effect.life > 0);
    this.particles.forEach((particle) => {
      particle.life -= realDt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.96;
      particle.vy *= 0.96;
    });
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  drawBackground(ctx, variant = 'range') {
    const light = this.theme === 'light';
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, light ? (variant === 'clay' ? '#e4eef2' : '#edf4f3') : (variant === 'clay' ? '#101e27' : '#0b1519'));
    gradient.addColorStop(0.7, light ? '#dce8e8' : '#0a1216');
    gradient.addColorStop(1, light ? '#c7d9da' : '#070c0f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    if (variant === 'sniper') {
      ctx.fillStyle = light ? '#bfd2d4' : '#101d21';
      const buildings = [[0,300,150,250],[130,390,180,160],[280,260,140,290],[410,355,190,195],[570,285,170,265],[725,365,140,185],[845,240,175,310],[1000,330,120,220],[1100,275,180,275]];
      buildings.forEach(([x,y,w,h]) => ctx.fillRect(x,y,w,h));
      ctx.fillStyle = light ? 'rgba(24,104,82,.14)' : 'rgba(121,242,202,.08)';
      for (let x = 30; x < this.width; x += 83) ctx.fillRect(x, 420 - (x % 4) * 23, 3, 3);
    }

    ctx.strokeStyle = light ? 'rgba(36,85,78,.10)' : 'rgba(121,242,202,.045)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.width; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke();
    }
    for (let y = 0; y <= this.height; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke();
    }
    ctx.strokeStyle = light ? 'rgba(36,85,78,.18)' : 'rgba(121,242,202,.09)';
    ctx.beginPath(); ctx.moveTo(0, 570); ctx.lineTo(this.width, 570); ctx.stroke();
    for (let x = -320; x <= this.width + 320; x += 160) {
      ctx.beginPath(); ctx.moveTo(this.width / 2, 570); ctx.lineTo(x, this.height); ctx.stroke();
    }
    drawLabel(ctx, 'LOCK/ON  //  LIVE RANGE', 26, 32, { color: light ? 'rgba(24,84,70,.68)' : 'rgba(121,242,202,.55)' });
    drawLabel(ctx, `${this.weapon.english}  //  ${this.weapon.fireRate.toFixed(2)} RPS`, this.width - 26, 32, { align: 'right', color: light ? 'rgba(24,84,70,.68)' : '#6c888a' });
  }

  renderEffects(ctx) {
    this.particles.forEach((particle) => {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    });
    this.effects.forEach((effect) => {
      const progress = 1 - effect.life / effect.maxLife;
      ctx.globalAlpha = clamp(effect.life / effect.maxLife, 0, 1);
      ctx.fillStyle = effect.color;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(effect.text, effect.x, effect.y - (this.reducedMotion ? 18 : 18 + progress * 28));
    });
    ctx.globalAlpha = 1;
  }

  renderCrosshair(ctx, options = {}) {
    const point = this.getAimPoint();
    if (point.visible !== false) drawCrosshair(ctx, point, { ...options, color: options.color || this.crosshairColor, style: this.crosshairStyle });
  }

  renderWeaponState(ctx) {
    drawLabel(ctx, `${this.weapon.name}  //  ∞`, this.width - 30, this.height - 32, {
      align: 'right', color: this.theme === 'light' ? 'rgba(24,64,54,.7)' : 'rgba(200,225,220,.55)', font: '12px monospace',
    });
  }

  getWeaponHud() {
    return {
      name: this.weapon.name,
      english: this.weapon.english,
      infinite: true,
    };
  }

  getHud() {
    return {
      primary: { label: '得分', value: integer(this.score) },
      secondary: { label: '命中率', value: percent(this.hits, this.shots) },
      tertiary: { label: '当前连击', value: String(this.combo) },
    };
  }

  getResults() {
    return {
      score: Math.round(this.score),
      unit: '得分',
      stats: [
        { label: '命中 / 射击', value: `${this.hits} / ${this.shots}` },
        { label: '命中率', value: percent(this.hits, this.shots) },
        { label: '最高连击', value: String(this.bestCombo) },
        { label: '射击次数', value: String(this.shots) },
      ],
    };
  }
}
