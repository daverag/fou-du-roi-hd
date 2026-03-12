import type { TuningDefinition } from './types';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 960;
export const WORLD_GRID_SIZE = 3;

export const TUNING: TuningDefinition = {
  tileSize: 32,
  playerSpeed: 216,
  enemySpeed: 156,
  vulnerableEnemySpeed: 127,
  respawnEnemySpeed: 219,
  enemyDecisionMistakeChance: 0.18,
  swordDurationMs: 47150,
  lifeDrainPerSecond: 1.25,
  lightDrainPerSecond: 2.1,
  swordDrainPerSecond: 9,
  appleRestore: 36,
  torchRestore: 50,
  swordRestore: 100,
  scatterDurationMs: 4000,
  chaseDurationMs: 9000,
  enemyRespawnDelayMs: 2200,
  score: {
    keyPickup: 150,
    powerUpPickup: 90,
    superPowerUpPickup: 450,
    enemyCaptured: 300,
    cageOpened: 500,
    worldComplete: 3000,
  },
};

export const MAX_GAUGE = 100;
export const INITIAL_LIVES = 3;
export const INITIAL_GAUGES = {
  life: 100,
  light: 100,
  sword: 0,
};
