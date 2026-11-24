import { clamp } from './utils.js';

export const DEFAULT_SENSITIVITY = 0.35;

export function normalizeSensitivity(value, fallback = DEFAULT_SENSITIVITY) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clamp(Math.round(numeric * 1000) / 1000, 0.01, 1);
}

export function relativeSensitivity(sensitivity) {
  return normalizeSensitivity(sensitivity) / DEFAULT_SENSITIVITY;
}

export function lookScale(sensitivity) {
  return 0.0022 * relativeSensitivity(sensitivity);
}
