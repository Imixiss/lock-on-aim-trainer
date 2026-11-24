export function scoreKey(dimension, modeId, duration) {
  return `${dimension}:${modeId}:${duration}`;
}

export function isDurationScoreKey(key) {
  const parts = key.split(':');
  return parts.length === 3
    && ['2d', '3d'].includes(parts[0])
    && ['30', '60', '90'].includes(parts[2]);
}

export function prependHistory(history, record, limit = 20) {
  return [record, ...history].slice(0, limit);
}

export function parseScoreKey(key) {
  const [dimension, modeId, duration] = key.split(':');
  return { dimension, modeId, duration: Number(duration) };
}
