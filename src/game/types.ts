export type Direction = 'up' | 'down' | 'left' | 'right';

export type PowerUpType = 'sword' | 'apple' | 'torch';
export type SuperPowerUpType = 'magicSword' | 'goldenApple' | 'goldenTorch' | 'heart' | 'magicBoot';

export type EnemyState = 'chase' | 'scatter' | 'vulnerable' | 'respawning';

export type RoomCoord = {
  x: 0 | 1 | 2;
  y: 0 | 1 | 2;
};

export type GaugeValues = {
  life: number;
  light: number;
  sword: number;
};

export type WorldProgress = {
  keysCollected: number;
  cagesOpened: number;
  goalsCollected: number;
  score: number;
  lives: number;
  hasMagicBoot: boolean;
};

export type SpawnDefinition = {
  tileX: number;
  tileY: number;
};

export type PickupDefinition = {
  id: string;
  type: 'key' | PowerUpType | SuperPowerUpType;
  spawn: SpawnDefinition;
};

export type MazeCellValue = 0 | 1 | 'L' | 'G';

export type MazeDoors = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export type MazeDefinition = {
  width: number;
  height: number;
  cells: MazeCellValue[][];
  doors: MazeDoors;
};

export type RoomDefinition = {
  coord: RoomCoord;
  maze: MazeDefinition;
  playerSpawn: SpawnDefinition;
  enemySpawns: SpawnDefinition[];
  pickups: PickupDefinition[];
  superPickup: PickupDefinition;
  cageIndex: number;
};

export type WorldDefinition = {
  rooms: RoomDefinition[];
  virtueName: string;
};

export type ScoreTuning = {
  keyPickup: number;
  powerUpPickup: number;
  superPowerUpPickup: number;
  enemyCaptured: number;
  cageOpened: number;
  worldComplete: number;
};

export type TuningDefinition = {
  tileSize: number;
  playerSpeed: number;
  enemySpeed: number;
  vulnerableEnemySpeed: number;
  respawnEnemySpeed: number;
  swordDurationMs: number;
  lifeDrainPerSecond: number;
  lightDrainPerSecond: number;
  swordDrainPerSecond: number;
  appleRestore: number;
  torchRestore: number;
  swordRestore: number;
  scatterDurationMs: number;
  chaseDurationMs: number;
  enemyRespawnDelayMs: number;
  score: ScoreTuning;
};
