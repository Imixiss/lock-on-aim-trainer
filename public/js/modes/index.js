import { PrecisionMode } from './precision.js';
import { ReactionMode } from './reaction.js';
import { TrackingMode } from './tracking.js';
import { SniperMode } from './sniper.js';
import { GridMode } from './recoil.js';
import { ClayMode } from './clay.js';

const constructors = {
  precision: PrecisionMode,
  reaction: ReactionMode,
  tracking: TrackingMode,
  sniper: SniperMode,
  grid: GridMode,
  clay: ClayMode,
};

export function createMode(id, difficulty, audio, reducedMotion) {
  const Mode = constructors[id] || PrecisionMode;
  return new Mode(difficulty, audio, reducedMotion);
}
