export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const random = (min, max) => min + Math.random() * (max - min);
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const percent = (part, total) => total > 0 ? `${((part / total) * 100).toFixed(1)}%` : '—';
export const integer = (value) => Math.round(value).toLocaleString('zh-CN');

export function drawTarget(ctx, target, options = {}) {
  const { x, y, radius: r } = target;
  const color = options.color || '#79f2ca';
  const hot = options.hot || '#d8fff1';
  ctx.save();
  ctx.translate(x, y);
  if (options.rotation) ctx.rotate(options.rotation);
  if (options.scaleY) ctx.scale(1, options.scaleY);
  ctx.shadowColor = color;
  ctx.shadowBlur = options.glow === false ? 0 : 18;
  ctx.fillStyle = `${color}18`;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `${color}90`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.67, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.37, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = hot;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(2.5, r * 0.09), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawCrosshair(ctx, point, options = {}) {
  const color = options.color || '#d8fff1';
  const gap = options.gap || 7;
  const length = options.length || 11;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = options.width || 1.5;
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 3;
  if (options.style === 'dot') {
    ctx.beginPath();
    ctx.arc(0, 0, options.radius || 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(-gap - length, 0); ctx.lineTo(-gap, 0);
  ctx.moveTo(gap, 0); ctx.lineTo(gap + length, 0);
  ctx.moveTo(0, -gap - length); ctx.lineTo(0, -gap);
  ctx.moveTo(0, gap); ctx.lineTo(0, gap + length);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawLabel(ctx, text, x, y, options = {}) {
  ctx.save();
  ctx.fillStyle = options.color || '#6c888a';
  ctx.font = options.font || '10px monospace';
  ctx.textAlign = options.align || 'left';
  ctx.fillText(text, x, y);
  ctx.restore();
}
