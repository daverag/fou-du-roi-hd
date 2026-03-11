import type { MazeCellValue, MazeDefinition, PickupDefinition, PowerUpType, RoomDefinition, SpawnDefinition, SuperPowerUpType, WorldDefinition } from '../types';

export const WORLD_VIRTUES = [
  'Courage',
  'Truth',
  'Honour',
  'Fidelity',
  'Discipline',
  'Hospitality',
  'Self Reliance',
  'Industriousness',
  'Perseverance',
] as const;

function parseMazeRow(row: string): MazeCellValue[] {
  return row.split('').map((cell) => {
    if (cell === '0') {
      return 0;
    }
    if (cell === '1') {
      return 1;
    }
    if (cell === 'L' || cell === 'G') {
      return cell;
    }

    throw new Error(`Unsupported maze cell "${cell}"`);
  });
}

function buildMaze(rows: string[]): MazeCellValue[][] {
  return rows.map(parseMazeRow);
}

const ROOM_LAYOUTS: MazeCellValue[][][] = [
  buildMaze([
    '1111111111111111111',
    '1000100000000010001',
    '1010101110111010101',
    '1000001000001000001',
    '1110101011101010111',
    '1000100000000010001',
    '1010111011101110101',
    '00100000LGL00000101',
    '1010111011101110101',
    '1000100000000010001',
    '1110101011101010111',
    '1000001000001000001',
    '1010101110111010101',
    '1000100000000010001',
    '1111111111111111111',
  ]),
  buildMaze([
    '1111111111111111111',
    '1000000000000000001',
    '1011111011101111101',
    '1010000000000000101',
    '1010111110111110101',
    '1010000000000000101',
    '1011101011101011101',
    '10000010LGL01000001',
    '1011101011101011101',
    '1010000000000000101',
    '1010111110111110101',
    '1010000000000000101',
    '1011111011101111101',
    '1000000000000000001',
    '1111111111111111111',
  ]),
  buildMaze([
    '1111111111111111111',
    '1000100000000010001',
    '1010101011101010101',
    '1000001000001000001',
    '1110111110111110111',
    '1000100000000010001',
    '1011101011101011101',
    '10000000LGL00000001',
    '1011101011101011101',
    '1000100000000010001',
    '1110111110111110111',
    '1000001000001000001',
    '1010101011101010101',
    '1000100000000010001',
    '1111111111111111111',
  ]),
];

const DOOR_TILES = {
  up: { tileX: 9, tileY: 0 },
  down: { tileX: 9, tileY: 14 },
  left: { tileX: 0, tileY: 7 },
  right: { tileX: 18, tileY: 7 },
} as const;

const PLAYER_SPAWNS = Array.from({ length: 9 }, () => ({ tileX: 9, tileY: 9 }));

const BONUS_POOL: Exclude<PowerUpType, 'sword'>[] = [
  'torch',
  'torch',
  'torch',
  'torch',
  'torch',
  'torch',
  'apple',
  'apple',
  'apple',
];

const SUPER_PICKUP_POOL: SuperPowerUpType[] = [
  'magicSword',
  'magicSword',
  'goldenApple',
  'goldenApple',
  'goldenTorch',
  'goldenTorch',
  'heart',
  'magicBoot',
  'magicBoot',
];

const ENEMY_SPAWNS = [
  [
    { tileX: 3, tileY: 9 },
    { tileX: 5, tileY: 9 },
    { tileX: 7, tileY: 9 },
    { tileX: 9, tileY: 9 },
  ],
  [
    { tileX: 15, tileY: 5 },
    { tileX: 17, tileY: 5 },
    { tileX: 15, tileY: 7 },
    { tileX: 17, tileY: 7 },
  ],
  [
    { tileX: 5, tileY: 1 },
    { tileX: 9, tileY: 1 },
    { tileX: 13, tileY: 1 },
    { tileX: 9, tileY: 3 },
  ],
];

function isWalkable(value: MazeCellValue): boolean {
  return value === 0 || value === 'G';
}

function createRoomMaze(x: number, y: number, layoutIndex: number): MazeDefinition {
  const cells = ROOM_LAYOUTS[layoutIndex].map((row) => [...row]);
  const doors = {
    up: y > 0,
    down: y < 2,
    left: x > 0,
    right: x < 2,
  };

  cells[DOOR_TILES.up.tileY][DOOR_TILES.up.tileX] = 1;
  cells[DOOR_TILES.down.tileY][DOOR_TILES.down.tileX] = 1;
  cells[DOOR_TILES.left.tileY][DOOR_TILES.left.tileX] = 1;
  cells[DOOR_TILES.right.tileY][DOOR_TILES.right.tileX] = 1;

  if (doors.up) {
    cells[DOOR_TILES.up.tileY][DOOR_TILES.up.tileX] = 0;
  }
  if (doors.down) {
    cells[DOOR_TILES.down.tileY][DOOR_TILES.down.tileX] = 0;
  }
  if (doors.left) {
    cells[DOOR_TILES.left.tileY][DOOR_TILES.left.tileX] = 0;
  }
  if (doors.right) {
    cells[DOOR_TILES.right.tileY][DOOR_TILES.right.tileX] = 0;
  }

  return {
    width: ROOM_LAYOUTS[layoutIndex][0].length,
    height: ROOM_LAYOUTS[layoutIndex].length,
    cells,
    doors,
  };
}

function findNearestWalkable(maze: MazeDefinition, preferred: SpawnDefinition): SpawnDefinition {
  if (isWalkable(maze.cells[preferred.tileY]?.[preferred.tileX] as MazeCellValue | undefined ?? 1)) {
    return preferred;
  }

  let best: SpawnDefinition | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let tileY = 0; tileY < maze.height; tileY += 1) {
    for (let tileX = 0; tileX < maze.width; tileX += 1) {
      if (!isWalkable(maze.cells[tileY][tileX])) {
        continue;
      }

      const distance = Math.abs(tileX - preferred.tileX) + Math.abs(tileY - preferred.tileY);
      if (distance < bestDistance) {
        best = { tileX, tileY };
        bestDistance = distance;
      }
    }
  }

  if (!best) {
    throw new Error('No walkable tile found in handcrafted room layout');
  }

  return best;
}

function listWalkableTiles(maze: MazeDefinition): SpawnDefinition[] {
  const walkable: SpawnDefinition[] = [];
  for (let tileY = 0; tileY < maze.height; tileY += 1) {
    for (let tileX = 0; tileX < maze.width; tileX += 1) {
      const isTwoByTwoCell = (tileX + 1) % 2 === 0 && (tileY + 1) % 2 === 0;
      if (isTwoByTwoCell && isWalkable(maze.cells[tileY][tileX])) {
        walkable.push({ tileX, tileY });
      }
    }
  }
  return walkable;
}

function pickRandomWalkable(maze: MazeDefinition, blocked: SpawnDefinition[]): SpawnDefinition {
  const blockedKeys = new Set(blocked.map((spawn) => `${spawn.tileX},${spawn.tileY}`));
  const candidates = listWalkableTiles(maze).filter((spawn) => {
    if (blockedKeys.has(`${spawn.tileX},${spawn.tileY}`)) {
      return false;
    }

    return maze.cells[spawn.tileY][spawn.tileX] !== 'G';
  });
  if (candidates.length === 0) {
    throw new Error('No random walkable tile available for powerup placement');
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function shuffleArray<T>(values: T[]): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function buildRooms(): RoomDefinition[] {
  const rooms: RoomDefinition[] = [];
  const bonusOrder = shuffleArray(BONUS_POOL);
  const superPickupOrder = shuffleArray(SUPER_PICKUP_POOL);

  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      const index = y * 3 + x;
      const maze = createRoomMaze(x, y, index % ROOM_LAYOUTS.length);
      const bonusType = bonusOrder[index];
      const playerSpawn = findNearestWalkable(maze, PLAYER_SPAWNS[index]);
      const keySpawn = pickRandomWalkable(maze, [playerSpawn]);
      const swordSpawn = pickRandomWalkable(maze, [playerSpawn, keySpawn]);
      const bonusSpawn = pickRandomWalkable(maze, [playerSpawn, keySpawn, swordSpawn]);
      const superPickup = {
        id: `super-${index}`,
        type: superPickupOrder[index],
        spawn: pickRandomWalkable(maze, [playerSpawn, keySpawn, swordSpawn, bonusSpawn]),
      } satisfies PickupDefinition;
      const pickups: PickupDefinition[] = [
        { id: 'key', type: 'key', spawn: keySpawn },
        { id: 'sword', type: 'sword', spawn: swordSpawn },
        { id: bonusType, type: bonusType, spawn: bonusSpawn },
      ];

      rooms.push({
        coord: { x: x as 0 | 1 | 2, y: y as 0 | 1 | 2 },
        maze,
        playerSpawn,
        enemySpawns: ENEMY_SPAWNS[index % ENEMY_SPAWNS.length].map((spawn) => findNearestWalkable(maze, spawn)),
        pickups,
        superPickup,
        cageIndex: index,
      });
    }
  }

  return rooms;
}

export function createWorldDefinition(virtueIndex: number): WorldDefinition {
  const normalizedVirtueIndex = ((virtueIndex % WORLD_VIRTUES.length) + WORLD_VIRTUES.length) % WORLD_VIRTUES.length;

  return {
    virtueName: WORLD_VIRTUES[normalizedVirtueIndex],
    rooms: buildRooms(),
  };
}

export const WORLD_DEFINITION: WorldDefinition = createWorldDefinition(0);
