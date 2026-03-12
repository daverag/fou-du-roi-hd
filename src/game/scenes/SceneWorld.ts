import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, INITIAL_GAUGES, TUNING, WORLD_GRID_SIZE } from '../constants';
import { AudioManager } from '../core/AudioManager';
import { MazeGrid } from '../core/MazeGrid';
import { createWorldDefinition, WORLD_DEFINITION, WORLD_VIRTUES } from '../data/world';
import { EnemyController } from '../entities/EnemyController';
import { EnemyDirector } from '../entities/EnemyDirector';
import { PlayerController } from '../entities/PlayerController';
import { WorldModel } from '../model/WorldModel';
import { HUDRenderer } from '../systems/HUDRenderer';
import { getActiveGamepad } from '../utils/getActiveGamepad';
import type { Direction, PickupDefinition, PowerUpType, RoomCoord, SpawnDefinition, SuperPowerUpType, TuningDefinition, WorldDefinition, WorldProgress } from '../types';

type PickupSprite = Phaser.GameObjects.Shape | Phaser.GameObjects.Container | Phaser.GameObjects.Image;

type PickupVisual = {
  id: string;
  sprite: PickupSprite;
  type: PickupDefinition['type'];
  isSuper?: boolean;
};

type RoomRenderState = {
  maze: MazeGrid;
};

type WorldPalette = {
  background: string;
  backdropFill: number;
  roomFloor: number;
  wallTint: number;
  lockedWallTint: number;
};

const REFERENCE_MAZE = new MazeGrid(WORLD_DEFINITION.rooms[0].maze, TUNING.tileSize, new Phaser.Math.Vector2(0, 0));
const ROOM_WIDTH = REFERENCE_MAZE.roomWidth;
const ROOM_HEIGHT = REFERENCE_MAZE.roomHeight;
const ROOM_ORIGIN_X = 70;
const ROOM_ORIGIN_Y = 46;
const ENEMY_COLORS = [0xb14b62, 0xc05f75, 0xb55671, 0xa8465f];
const GOAL_ICON_KEYS = [
  'virtue-shield',
  'virtue-hourglass',
  'virtue-book-feather',
  'virtue-book-gems',
  'virtue-scales-sword',
  'virtue-hands-coins',
  'virtue-lantern',
  'virtue-winged-sword-dove',
  'virtue-prayer',
] as const;

const VIRTUE_ICON_BY_NAME = Object.fromEntries(
  WORLD_VIRTUES.map((virtueName, index) => [virtueName, GOAL_ICON_KEYS[index]]),
) as Record<(typeof WORLD_VIRTUES)[number], (typeof GOAL_ICON_KEYS)[number]>;
const MAGIC_BOOT_SPEED_MULTIPLIER = 1.4;
const WORLD_PALETTES: WorldPalette[] = [
  {
    background: '#090512',
    backdropFill: 0x04010b,
    roomFloor: 0x05070b,
    wallTint: 0xffffff,
    lockedWallTint: 0xf3d7a4,
  },
  {
    background: '#081018',
    backdropFill: 0x040b12,
    roomFloor: 0x071118,
    wallTint: 0x9be2ff,
    lockedWallTint: 0xd7fbff,
  },
  {
    background: '#130b06',
    backdropFill: 0x0d0704,
    roomFloor: 0x100905,
    wallTint: 0xffbf7c,
    lockedWallTint: 0xffe0a5,
  },
  {
    background: '#0d1409',
    backdropFill: 0x091006,
    roomFloor: 0x0a1207,
    wallTint: 0xb7e07d,
    lockedWallTint: 0xe9f7b4,
  },
  {
    background: '#14080f',
    backdropFill: 0x0f060b,
    roomFloor: 0x12070d,
    wallTint: 0xffa8c9,
    lockedWallTint: 0xffd8e8,
  },
  {
    background: '#10100a',
    backdropFill: 0x0a0a05,
    roomFloor: 0x101008,
    wallTint: 0xf1e18b,
    lockedWallTint: 0xfff2be,
  },
];

export class SceneWorld extends Phaser.Scene {
  private static readonly GAMEPAD_AXIS_THRESHOLD = 0.35;
  private readonly audioManager = new AudioManager();
  private currentWorldNumber = 1;
  private currentWorldDefinition: WorldDefinition = WORLD_DEFINITION;
  private currentTuning: TuningDefinition = TUNING;
  private currentPalette: WorldPalette = WORLD_PALETTES[0];
  private worldModel = new WorldModel(WORLD_DEFINITION);
  private readonly roomStateByKey = new Map<string, RoomRenderState>();
  private readonly enemies: EnemyController[] = [];
  private enemyDirector = new EnemyDirector(TUNING.scatterDurationMs, TUNING.chaseDurationMs, TUNING.swordDurationMs);
  private backdropFill?: Phaser.GameObjects.Rectangle;
  private backdropOuterFrame?: Phaser.GameObjects.Rectangle;
  private backdropInnerFrame?: Phaser.GameObjects.Rectangle;
  private roomLayer!: Phaser.GameObjects.Container;
  private player!: PlayerController;
  private hud!: HUDRenderer;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private activeMaze!: MazeGrid;
  private activeRoomFrame?: Phaser.GameObjects.Rectangle;
  private activeGoalVisual?: Phaser.GameObjects.Container;
  private activePickups: PickupVisual[] = [];
  private transitionCooldownUntil = 0;
  private overlapRadius = 22;
  private swordExpiresAt = 0;
  private magicSwordKillsRemaining = 0;
  private lifeDrainMultiplier = 1;
  private lightDrainMultiplier = 1;
  private lastMoveToneAt = 0;
  private gameStarted = false;
  private roomTransitionInProgress = false;
  private awaitingPlayerInput = true;
  private lifePauseInProgress = false;
  private roomEntryEnemyRevealUntil = 0;
  private pausedByBlur = false;
  private lastLoggedGamepadDirection: Direction | null = null;

  constructor() {
    super('world');
  }

  preload(): void {
    this.load.image('wall-square', '/walls/wall-square.png');
    this.load.image('wall-horizontal', '/walls/wall-horizontal.png');
    this.load.image('wall-vertical', '/walls/wall-vertical.png');
    this.load.image('wall-locked', '/walls/wall-locked.png');
    this.load.image('icon-hero', '/icons/hero.png');
    this.load.image('icon-sword', '/icons/sword.png');
    this.load.image('icon-magic-sword', '/icons/magic-sword.png');
    this.load.image('icon-apple', '/icons/apple.png');
    this.load.image('icon-golden-apple', '/icons/golden-apple.png');
    this.load.image('icon-key', '/icons/key.png');
    this.load.image('icon-torch', '/icons/torch.png');
    this.load.image('icon-golden-torch', '/icons/golden-torch.png');
    this.load.image('icon-skull', '/icons/skull.png');
    this.load.image('icon-heart', '/icons/heart.png');
    this.load.image('icon-magic-boot', '/icons/boot.png');
    for (const key of GOAL_ICON_KEYS) {
      this.load.image(key, `/icons/virtues/${key}.png`);
    }
  }

  create(): void {
    this.resetRunState();
    this.gameStarted = false;
    this.awaitingPlayerInput = true;
    this.cameras.main.setBackgroundColor(this.currentPalette.background);
    this.drawBackdrop();
    this.roomLayer = this.add.container(0, 0);
    this.buildRoomStates();
    this.buildPlayerAndEnemies();
    this.loadRoom(this.worldModel.currentRoom, 'right', true);
    this.hud = new HUDRenderer(this);
    this.roomTransitionInProgress = true;
    this.showWorldTitleCard(() => {
      this.roomTransitionInProgress = false;
    });
    this.cursors = this.input.keyboard?.createCursorKeys() as Phaser.Types.Input.Keyboard.CursorKeys;
    this.input.keyboard?.on('keydown', () => this.audioManager.unlock());
    this.input.once('pointerdown', () => this.audioManager.unlock());
    this.enemyDirector.start(this.time.now);
    this.game.events.on(Phaser.Core.Events.BLUR, this.handleGameBlur, this);
    this.game.events.on(Phaser.Core.Events.FOCUS, this.handleGameFocus, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.handleGameBlur, this);
      this.game.events.off(Phaser.Core.Events.FOCUS, this.handleGameFocus, this);
      this.lastLoggedGamepadDirection = null;
    });
  }

  private resetRunState(): void {
    this.currentWorldNumber = 1;
    this.currentWorldDefinition = createWorldDefinition(0);
    this.currentTuning = this.buildWorldTuning(1);
    this.currentPalette = this.getWorldPalette(1);
    this.worldModel = new WorldModel(this.currentWorldDefinition);
    this.enemyDirector = new EnemyDirector(
      this.currentTuning.scatterDurationMs,
      this.currentTuning.chaseDurationMs,
      this.currentTuning.swordDurationMs,
    );
    this.enemies.forEach((enemy) => enemy.sprite.destroy());
    this.enemies.forEach((enemy) => enemy.warningAura.destroy());
    this.enemies.forEach((enemy) => enemy.warningOverlay.destroy());
    this.roomStateByKey.clear();
    this.enemies.splice(0, this.enemies.length);
    this.swordExpiresAt = 0;
    this.magicSwordKillsRemaining = 0;
    this.lifeDrainMultiplier = 1;
    this.lightDrainMultiplier = 1;
    this.transitionCooldownUntil = 0;
    this.roomEntryEnemyRevealUntil = 0;
    this.lastMoveToneAt = 0;
    this.roomTransitionInProgress = false;
    this.lifePauseInProgress = false;
    this.activePickups = [];
    this.activeGoalVisual = undefined;
    this.pausedByBlur = false;
  }

  private handleGameBlur(): void {
    if (!this.scene.isActive()) {
      return;
    }

    this.pausedByBlur = true;
    this.scene.pause();
  }

  private handleGameFocus(): void {
    if (!this.pausedByBlur) {
      return;
    }

    this.pausedByBlur = false;
    this.scene.resume();
  }

  update(_time: number, delta: number): void {
    const deltaSeconds = delta / 1000;
    this.handleInput();
    if (!this.gameStarted || this.lifePauseInProgress) {
      this.renderHud();
      return;
    }
    this.enemyDirector.update(this.time.now, this.enemies);
    this.updateEnemies(deltaSeconds);
    if (!this.awaitingPlayerInput) {
      this.player.update(deltaSeconds);
    }
    this.updateGauges(deltaSeconds);
    this.handleGoalCollection();
    this.handleRoomTransitions();
    this.handlePickups();
    this.handleEnemyCollisions();
    this.updateEnemyVisuals();
    this.renderHud();
    this.tickMoveAudio();
  }

  private drawBackdrop(): void {
    this.backdropFill = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, this.currentPalette.backdropFill);
    this.backdropOuterFrame = this.add.rectangle(
      ROOM_ORIGIN_X + ROOM_WIDTH / 2,
      ROOM_ORIGIN_Y + ROOM_HEIGHT / 2,
      ROOM_WIDTH + 28,
      ROOM_HEIGHT + 28,
      0x000000,
      0,
    );
    this.backdropInnerFrame = this.add.rectangle(
      ROOM_ORIGIN_X + ROOM_WIDTH / 2,
      ROOM_ORIGIN_Y + ROOM_HEIGHT / 2,
      ROOM_WIDTH + 38,
      ROOM_HEIGHT + 38,
      0x000000,
      0,
    );
    this.updateBackdropPalette();
  }

  private updateBackdropPalette(): void {
    this.cameras.main.setBackgroundColor(this.currentPalette.background);
    this.backdropFill?.setFillStyle(this.currentPalette.backdropFill, 1);
    this.backdropOuterFrame?.setFillStyle(0x000000, 0);
    this.backdropInnerFrame?.setFillStyle(0x000000, 0);
  }

  private buildRoomStates(): void {
    this.currentWorldDefinition.rooms.forEach((roomDefinition) => {
      const roomKey = this.roomKey(roomDefinition.coord);
      const roomModel = this.worldModel.getRoom(roomDefinition.coord);
      const maze = new MazeGrid(roomDefinition.maze, this.currentTuning.tileSize, new Phaser.Math.Vector2(ROOM_ORIGIN_X, ROOM_ORIGIN_Y));
      maze.setLockOpened(roomModel.lockOpened);
      this.roomStateByKey.set(roomKey, {
        maze,
      });
    });
  }

  private createPowerSprite(type: PowerUpType, x: number, y: number): PickupSprite {
    const key = type === 'apple' ? 'icon-apple' : type === 'torch' ? 'icon-torch' : 'icon-sword';
    const size = type === 'apple' ? 54 : 62;
    return this.createIconSprite(key, x, y, size);
  }

  private createSuperPowerSprite(type: SuperPowerUpType, x: number, y: number): PickupSprite {
    const key = type === 'magicSword'
      ? 'icon-magic-sword'
      : type === 'goldenApple'
        ? 'icon-golden-apple'
        : type === 'goldenTorch'
          ? 'icon-golden-torch'
          : type === 'magicBoot'
            ? 'icon-magic-boot'
            : 'icon-heart';
    const size = type === 'goldenApple'
      ? 64
      : type === 'magicBoot'
        ? 66
        : 73;
    const container = this.add.container(x, y);
    const icon = this.add.image(0, 0, key);
    icon.setScale(Math.min(size / icon.width, size / icon.height));
    container.add(icon);

    const sparkleOffsets = [
      { x: -size * 0.42, y: -size * 0.32, delay: 0 },
      { x: size * 0.38, y: -size * 0.18, delay: 180 },
      { x: -size * 0.28, y: size * 0.36, delay: 340 },
      { x: size * 0.34, y: size * 0.28, delay: 520 },
    ];

    sparkleOffsets.forEach(({ x: offsetX, y: offsetY, delay }) => {
      const sparkle = this.add.star(offsetX, offsetY, 4, 2.5, 6, 0xfdf2a6).setStrokeStyle(1, 0xffd36b, 0.9);
      sparkle.setAlpha(0.35);
      container.add(sparkle);
      this.tweens.add({
        targets: sparkle,
        alpha: { from: 0.2, to: 1 },
        scale: { from: 0.7, to: 1.25 },
        angle: 45,
        duration: 620,
        delay,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    return container;
  }

  private buildPlayerAndEnemies(): void {
    const centerRoom = this.worldModel.getRoom({ x: 1, y: 1 });
    const centerMaze = this.getRoomState(centerRoom.definition.coord).maze;
    this.player = new PlayerController(
      this,
      centerMaze,
      centerRoom.definition.playerSpawn.tileX,
      centerRoom.definition.playerSpawn.tileY,
      this.currentTuning.playerSpeed,
      INITIAL_GAUGES,
    );
    this.player.setSpeedMultiplier(this.getPlayerSpeedMultiplier());

    const profiles = ['direct', 'ambush', 'shy', 'erratic'] as const;
    centerRoom.definition.enemySpawns.forEach((spawn, index) => {
      const enemy = new EnemyController(
        this,
        centerMaze,
        spawn.tileX,
        spawn.tileY,
        ENEMY_COLORS[index],
        profiles[index],
        new Phaser.Math.Vector2(index % 2 === 0 ? -2 : 16, index < 2 ? -2 : 16),
      );
      enemy.warningAura.setDepth(17);
      enemy.warningOverlay.setDepth(19);
      this.enemies.push(enemy);
    });
  }

  private loadRoom(coord: RoomCoord, entryDirection: Direction, usePlayerSpawn = false): void {
    this.worldModel.currentRoom = coord;
    this.roomLayer.removeAll(true);
    this.activePickups = [];
    this.activeGoalVisual = undefined;
    this.awaitingPlayerInput = true;

    const room = this.worldModel.getRoom(coord);
    const roomState = this.getRoomState(coord);
    roomState.maze.setLockOpened(room.lockOpened);
    this.activeMaze = roomState.maze;

    this.activeRoomFrame = this.add.rectangle(
      ROOM_ORIGIN_X + ROOM_WIDTH / 2,
      ROOM_ORIGIN_Y + ROOM_HEIGHT / 2,
      ROOM_WIDTH,
      ROOM_HEIGHT,
      this.currentPalette.roomFloor,
      1,
    ).setStrokeStyle(0, 0x000000, 0);
    this.roomLayer.add(this.activeRoomFrame);

    for (let y = 0; y < room.definition.maze.height; y += 1) {
      for (let x = 0; x < room.definition.maze.width; x += 1) {
        const value = this.activeMaze.getCellValue(x, y);
        const cellRect = this.activeMaze.getCellRect(x, y);

        if (value === 1) {
          this.roomLayer.add(this.createWallSprite(cellRect));
          continue;
        }

        if (value === 'L') {
          if (y === 7 && (x === 8 || x === 10)) {
            continue;
          }
          this.roomLayer.add(this.createLockedWallSprite(cellRect));
          continue;
        }

        if (value === 'G' && !room.goalCollected) {
          const corridor = this.activeMaze.getCorridorRect(x, y);
          const goal = this.add.container(cellRect.centerX, cellRect.centerY);
          const iconKey = VIRTUE_ICON_BY_NAME[this.currentWorldDefinition.virtueName as (typeof WORLD_VIRTUES)[number]] ?? GOAL_ICON_KEYS[0];
          const icon = this.add.image(0, 0, iconKey);
          icon.setScale(Math.min((corridor.width * 1.03) / icon.width, (corridor.height * 1.03) / icon.height));
          goal.add(icon);
          this.activeGoalVisual = goal;
          this.roomLayer.add(goal);
        }
      }
    }

    if (!room.lockOpened) {
      this.roomLayer.add(this.createGoalSideLock(8, 7));
      this.roomLayer.add(this.createGoalSideLock(10, 7));
    }

    room.definition.pickups
      .filter((pickup) => !room.collectedPickupIds.has(pickup.id))
      .forEach((pickup) => {
        const point = this.activeMaze.tileToWorld(pickup.spawn.tileX, pickup.spawn.tileY);
        const sprite = pickup.type === 'key'
          ? this.createKeySprite(point.x, point.y)
          : this.createPowerSprite(pickup.type as PowerUpType, point.x, point.y);
        this.roomLayer.add(sprite);
        this.activePickups.push({ id: pickup.id, sprite, type: pickup.type });
      });

    if (room.defeatedEnemyIndexes.size >= this.enemies.length && !room.superPickupCollected) {
      this.spawnRoomSuperPickup(room);
    }

    const spawnTile = usePlayerSpawn
      ? new Phaser.Math.Vector2(room.definition.playerSpawn.tileX, room.definition.playerSpawn.tileY)
      : this.pickEntryTile(entryDirection, room);
    this.player.attachMaze(this.activeMaze, spawnTile.x, spawnTile.y, 'right');
    this.player.setSpeedMultiplier(this.getPlayerSpeedMultiplier());
    this.player.sprite.setDepth(20);

    const enemySpawns = this.resolveEnemySpawns(room, { tileX: spawnTile.x, tileY: spawnTile.y });
    this.enemies.forEach((enemy, index) => {
      const defeatedInRoom = room.defeatedEnemyIndexes.has(index);
      enemy.setDefeatedStatus(defeatedInRoom);
      const spawn = enemySpawns[index] ?? enemySpawns[0];
      enemy.attachMaze(
        this.activeMaze,
        spawn.tileX,
        spawn.tileY,
        new Phaser.Math.Vector2(index % 2 === 0 ? -2 : 16, index < 2 ? -2 : 16),
      );
      if (defeatedInRoom) {
        return;
      }
      enemy.warningAura.setDepth(17);
      enemy.sprite.setDepth(18);
      enemy.warningOverlay.setDepth(19);
      enemy.sprite.setVisible(this.player.gauges.light > 0);
      enemy.setState(this.player.gauges.sword > 0 || this.swordExpiresAt > this.time.now ? 'vulnerable' : 'chase', this.time.now);
    });

    if (this.player.gauges.light <= 0) {
      this.roomEntryEnemyRevealUntil = this.time.now + 1000;
    } else {
      this.roomEntryEnemyRevealUntil = 0;
    }

    this.transitionCooldownUntil = this.time.now + 180;
  }

  private updateEnemies(deltaSeconds: number): void {
    const playerTile = this.activeMaze.worldToTile(this.player.sprite.x, this.player.sprite.y);
    this.enemies.forEach((enemy) => {
      const speed = enemy.state === 'vulnerable'
        ? this.currentTuning.vulnerableEnemySpeed
        : enemy.state === 'respawning'
          ? this.currentTuning.respawnEnemySpeed
          : this.currentTuning.enemySpeed;
      enemy.update(this.time.now, deltaSeconds, playerTile, this.player.currentDirection, speed);
    });
  }

  private updateGauges(deltaSeconds: number): void {
    if (this.player.drainGauge('life', this.currentTuning.lifeDrainPerSecond * this.lifeDrainMultiplier * deltaSeconds)) {
      this.loseLife();
      return;
    }

    this.player.drainGauge('light', this.currentTuning.lightDrainPerSecond * this.lightDrainMultiplier * deltaSeconds);

    if (this.player.gauges.sword > 0 && this.magicSwordKillsRemaining <= 0) {
      this.player.drainGauge('sword', this.currentTuning.swordDrainPerSecond * deltaSeconds);
      if (this.player.gauges.sword === 0) {
        this.expireSwordPower();
      }
    }
  }

  private handleInput(): void {
    if (this.roomTransitionInProgress) {
      return;
    }

    if (!this.gameStarted) {
      const startDirection = this.getRequestedDirection();
      if (startDirection === 'left') {
        this.startGameplay('left');
      } else if (startDirection === 'right') {
        this.startGameplay('right');
      }
      return;
    }

    if (this.awaitingPlayerInput) {
      const queuedDirection = this.getRequestedDirection();
      if (queuedDirection === 'left') {
        this.beginRoomMovement('left');
      } else if (queuedDirection === 'right') {
        this.beginRoomMovement('right');
      } else if (queuedDirection === 'up') {
        this.beginRoomMovement('up');
      } else if (queuedDirection === 'down') {
        this.beginRoomMovement('down');
      }
      return;
    }

    const desiredDirection = this.getRequestedDirection();
    if (desiredDirection) {
      this.player.setDesiredDirection(desiredDirection);
    }
  }

  private getRequestedDirection(): Direction | null {
    if (this.cursors.left.isDown) {
      return 'left';
    }
    if (this.cursors.right.isDown) {
      return 'right';
    }
    if (this.cursors.up.isDown) {
      return 'up';
    }
    if (this.cursors.down.isDown) {
      return 'down';
    }

    const pad = getActiveGamepad(this.input);
    if (!pad) {
      return null;
    }

    let direction: Direction | null = null;

    if (pad.left) {
      direction = 'left';
    } else if (pad.right) {
      direction = 'right';
    } else if (pad.up) {
      direction = 'up';
    } else if (pad.down) {
      direction = 'down';
    }

    if (direction) {
      this.logGamepadDirection(direction, pad);
      return direction;
    }

    const horizontal = pad.leftStick.x;
    const vertical = pad.leftStick.y;
    const threshold = SceneWorld.GAMEPAD_AXIS_THRESHOLD;

    if (Math.abs(horizontal) >= Math.abs(vertical) && Math.abs(horizontal) >= threshold) {
      direction = horizontal < 0 ? 'left' : 'right';
      this.logGamepadDirection(direction, pad, { horizontal, vertical });
      return direction;
    }

    if (Math.abs(vertical) >= threshold) {
      direction = vertical < 0 ? 'up' : 'down';
      this.logGamepadDirection(direction, pad, { horizontal, vertical });
      return direction;
    }

    if (this.lastLoggedGamepadDirection !== null) {
      console.info('[gamepad][world] neutral', { index: pad.index, id: pad.id, horizontal, vertical });
      this.lastLoggedGamepadDirection = null;
    }

    return null;
  }

  private logGamepadDirection(
    direction: Direction,
    pad: Phaser.Input.Gamepad.Gamepad,
    axes?: { horizontal: number; vertical: number },
  ): void {
    if (this.lastLoggedGamepadDirection === direction) {
      return;
    }

    this.lastLoggedGamepadDirection = direction;
    console.info('[gamepad][world] direction', {
      index: pad.index,
      id: pad.id,
      direction,
      axes,
      dpad: {
        left: pad.left,
        right: pad.right,
        up: pad.up,
        down: pad.down,
      },
    });
  }

  private handlePickups(): void {
    const room = this.worldModel.getRoom(this.worldModel.currentRoom);
    for (let index = this.activePickups.length - 1; index >= 0; index -= 1) {
      const activePickup = this.activePickups[index];
      if (Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, activePickup.sprite.x, activePickup.sprite.y) >= this.overlapRadius) {
        continue;
      }

      activePickup.sprite.destroy();
      this.activePickups.splice(index, 1);
      const pickup = activePickup.isSuper
        ? room.definition.superPickup
        : room.definition.pickups.find((candidate) => candidate.id === activePickup.id);
      if (!pickup) {
        continue;
      }

      if (activePickup.isSuper) {
        if (!this.worldModel.collectSuperPickup(room)) {
          continue;
        }
        this.applySuperPickup(pickup.type as SuperPowerUpType);
        continue;
      }

      this.worldModel.collectPickup(room, pickup);

      if (pickup.type === 'key') {
        this.worldModel.addScore(this.currentTuning.score.keyPickup + this.currentTuning.score.cageOpened);
        this.audioManager.playEvent('key');
        const unlockedRoom = this.worldModel.unlockRandomOtherRoom(room);
        if (unlockedRoom) {
          this.getRoomState(unlockedRoom.definition.coord).maze.setLockOpened(true);
        }
        continue;
      }

      this.worldModel.addScore(this.currentTuning.score.powerUpPickup);

      switch (pickup.type) {
        case 'apple':
          this.player.gauges.life = 100;
          this.audioManager.playEvent('apple');
          break;
        case 'torch':
          this.player.refillGauge('light', this.currentTuning.torchRestore);
          this.audioManager.playEvent('torch');
          break;
        case 'sword':
          if (this.magicSwordKillsRemaining <= 0) {
            this.player.refillGauge('sword', this.currentTuning.swordRestore);
            this.swordExpiresAt = this.time.now + this.currentTuning.swordDurationMs;
            this.enemyDirector.makeVulnerable(
              this.time.now,
              this.enemies,
              this.activeMaze.worldToTile(this.player.sprite.x, this.player.sprite.y),
            );
          }
          this.audioManager.playEvent('sword');
          break;
      }
    }
  }

  private handleEnemyCollisions(): void {
    for (const enemy of this.enemies) {
      if (enemy.permanentlyDefeated || enemy.state === 'respawning') {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, enemy.sprite.x, enemy.sprite.y);
      if (distance >= this.overlapRadius) {
        continue;
      }

      if (enemy.state === 'vulnerable') {
        const currentRoom = this.worldModel.getRoom(this.worldModel.currentRoom);
        currentRoom.defeatedEnemyIndexes.add(this.enemies.indexOf(enemy));
        enemy.defeatForever();
        this.worldModel.addScore(this.currentTuning.score.enemyCaptured);
        if (this.magicSwordKillsRemaining > 0) {
          this.magicSwordKillsRemaining = Math.max(0, this.magicSwordKillsRemaining - 1);
          this.player.gauges.sword = (this.magicSwordKillsRemaining / 12) * 100;
          if (this.magicSwordKillsRemaining === 0) {
            this.expireSwordPower();
          }
        }
        if (currentRoom.defeatedEnemyIndexes.size >= this.enemies.length && !currentRoom.superPickupCollected) {
          this.spawnRoomSuperPickup(currentRoom);
        }
        this.audioManager.playEvent('enemy');
        continue;
      }

      this.loseLife();
      return;
    }
  }

  private handleRoomTransitions(): void {
    if (this.time.now < this.transitionCooldownUntil || this.roomTransitionInProgress) {
      return;
    }

    const currentTile = this.activeMaze.worldToTile(this.player.sprite.x, this.player.sprite.y);
    const nearDoorCenter = this.activeMaze.isNearCenter(this.player.sprite.x, this.player.sprite.y);
    let targetRoom: RoomCoord | null = null;
    let spawnDirection: Direction = this.player.currentDirection;

    if (
      this.player.currentDirection === 'left'
      && this.activeMaze.canExitBoundary(currentTile.x, currentTile.y, 'left')
      && nearDoorCenter
      && this.worldModel.currentRoom.x > 0
    ) {
      targetRoom = { x: (this.worldModel.currentRoom.x - 1) as 0 | 1 | 2, y: this.worldModel.currentRoom.y };
      spawnDirection = 'left';
    } else if (
      this.player.currentDirection === 'right'
      && this.activeMaze.canExitBoundary(currentTile.x, currentTile.y, 'right')
      && nearDoorCenter
      && this.worldModel.currentRoom.x < WORLD_GRID_SIZE - 1
    ) {
      targetRoom = { x: (this.worldModel.currentRoom.x + 1) as 0 | 1 | 2, y: this.worldModel.currentRoom.y };
      spawnDirection = 'right';
    } else if (
      this.player.currentDirection === 'up'
      && this.activeMaze.canExitBoundary(currentTile.x, currentTile.y, 'up')
      && nearDoorCenter
      && this.worldModel.currentRoom.y > 0
    ) {
      targetRoom = { x: this.worldModel.currentRoom.x, y: (this.worldModel.currentRoom.y - 1) as 0 | 1 | 2 };
      spawnDirection = 'up';
    } else if (
      this.player.currentDirection === 'down'
      && this.activeMaze.canExitBoundary(currentTile.x, currentTile.y, 'down')
      && nearDoorCenter
      && this.worldModel.currentRoom.y < WORLD_GRID_SIZE - 1
    ) {
      targetRoom = { x: this.worldModel.currentRoom.x, y: (this.worldModel.currentRoom.y + 1) as 0 | 1 | 2 };
      spawnDirection = 'down';
    }

    if (!targetRoom) {
      return;
    }

    this.saveCurrentRoomEnemySnapshots();
    this.roomTransitionInProgress = true;
    this.cameras.main.fadeOut(140, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.loadRoom(targetRoom as RoomCoord, spawnDirection);
      this.cameras.main.fadeIn(160, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        this.roomTransitionInProgress = false;
      });
    });
  }

  private pickEntryTile(direction: Direction, room: ReturnType<WorldModel['getRoom']>): Phaser.Math.Vector2 {
    switch (direction) {
      case 'left':
        return room.definition.maze.doors.right ? new Phaser.Math.Vector2(17, 7) : new Phaser.Math.Vector2(room.definition.playerSpawn.tileX, room.definition.playerSpawn.tileY);
      case 'right':
        return room.definition.maze.doors.left ? new Phaser.Math.Vector2(1, 7) : new Phaser.Math.Vector2(room.definition.playerSpawn.tileX, room.definition.playerSpawn.tileY);
      case 'up':
        return room.definition.maze.doors.down ? new Phaser.Math.Vector2(9, 13) : new Phaser.Math.Vector2(room.definition.playerSpawn.tileX, room.definition.playerSpawn.tileY);
      case 'down':
        return room.definition.maze.doors.up ? new Phaser.Math.Vector2(9, 1) : new Phaser.Math.Vector2(room.definition.playerSpawn.tileX, room.definition.playerSpawn.tileY);
      default:
        return new Phaser.Math.Vector2(room.definition.playerSpawn.tileX, room.definition.playerSpawn.tileY);
    }
  }

  private updateEnemyVisuals(): void {
    const swordWarningThreshold = this.currentTuning.swordDrainPerSecond * 3;
    const vulnerableFlashing = this.magicSwordKillsRemaining <= 0
      && this.player.gauges.sword > 0
      && this.player.gauges.sword <= swordWarningThreshold;
    const flashUsesWhitePhase = vulnerableFlashing && Math.floor(this.time.now / 90) % 2 === 0;
    const light = this.player.gauges.light;
    const fullyVisible = light > 12;
    const fading = light > 0 && light <= 12;
    let alpha = fading
      ? 0.18 + (((Math.sin(this.time.now / 70) + 1) / 2) * 0.82)
      : fullyVisible
        ? 1
        : 0;

    if (this.player.gauges.light <= 0 && this.roomEntryEnemyRevealUntil > this.time.now) {
      const revealProgress = 1 - ((this.roomEntryEnemyRevealUntil - this.time.now) / 1000);
      alpha = 1 - revealProgress;
      alpha *= 0.25 + (((Math.sin(this.time.now / 70) + 1) / 2) * 0.75);
    }

    this.enemies.forEach((enemy) => {
      enemy.setVulnerableFlash(vulnerableFlashing, flashUsesWhitePhase);
      enemy.setWarningPresentation();
      if (!enemy.permanentlyDefeated && enemy.state !== 'respawning') {
        enemy.sprite.setVisible(alpha > 0);
        enemy.sprite.setAlpha(alpha);
        enemy.warningAura.setVisible(false);
        enemy.warningOverlay.setVisible(false);
      }
    });
  }

  private renderHud(): void {
    const worldNumber = this.currentWorldNumber;
    const roomsWithGoal = this.worldModel.rooms.map((room) => room.goalCollected);
    const roomsUnlocked = this.worldModel.rooms.map((room) => room.lockOpened);
    const virtueIconKey = VIRTUE_ICON_BY_NAME[this.currentWorldDefinition.virtueName as (typeof WORLD_VIRTUES)[number]] ?? GOAL_ICON_KEYS[0];
    this.hud.render(
      this.worldModel.progress,
      this.player.gauges,
      worldNumber,
      virtueIconKey,
      this.worldModel.currentRoom,
      roomsWithGoal,
      roomsUnlocked,
    );
  }

  private tickMoveAudio(): void {
    if (this.time.now - this.lastMoveToneAt < 80) {
      return;
    }

    this.lastMoveToneAt = this.time.now;
    this.audioManager.tickMove(this.player.getSpeedRatio());
  }

  private loseLife(): void {
    if (this.lifePauseInProgress) {
      return;
    }

    this.lifePauseInProgress = true;
    this.worldModel.loseLife();
    this.audioManager.playEvent('hurt');

    if (this.worldModel.progress.lives <= 0) {
      this.time.delayedCall(700, () => {
        this.lifePauseInProgress = false;
        this.audioManager.playEvent('gameover');
        this.scene.start('gameover', { score: this.worldModel.progress.score });
      });
      return;
    }

    this.player.gauges.life = INITIAL_GAUGES.life;
    this.player.gauges.light = INITIAL_GAUGES.light;
    this.worldModel.progress.hasMagicBoot = false;
    this.player.setSpeedMultiplier(this.getPlayerSpeedMultiplier());
    if (this.magicSwordKillsRemaining > 0) {
      this.player.gauges.sword = (this.magicSwordKillsRemaining / 12) * 100;
      this.swordExpiresAt = Number.POSITIVE_INFINITY;
    } else {
      this.player.gauges.sword = 0;
      this.swordExpiresAt = 0;
    }

    const currentRoom = this.worldModel.getRoom(this.worldModel.currentRoom);
    this.time.delayedCall(700, () => {
      this.lifePauseInProgress = false;
      this.loadRoom(currentRoom.definition.coord, 'right', true);
    });
  }

  private getRoomState(coord: RoomCoord): RoomRenderState {
    const state = this.roomStateByKey.get(this.roomKey(coord));
    if (!state) {
      throw new Error(`Room state not found for ${coord.x},${coord.y}`);
    }
    return state;
  }

  private roomKey(coord: RoomCoord): string {
    return `${coord.x}-${coord.y}`;
  }

  private getPlayerSpeedMultiplier(): number {
    return this.worldModel.progress.hasMagicBoot ? MAGIC_BOOT_SPEED_MULTIPLIER : 1;
  }

  private createKeySprite(x: number, y: number): PickupSprite {
    return this.createIconSprite('icon-key', x, y, 65);
  }

  private createWallSprite(cellRect: ReturnType<MazeGrid['getCellRect']>): Phaser.GameObjects.Image {
    const textureKey = cellRect.width > cellRect.height
      ? 'wall-horizontal'
      : cellRect.height > cellRect.width
        ? 'wall-vertical'
        : 'wall-square';
    const sprite = this.add.image(cellRect.centerX, cellRect.centerY, textureKey);
    sprite.setDisplaySize(cellRect.width, cellRect.height);
    sprite.setTint(this.currentPalette.wallTint);
    return sprite;
  }

  private createLockedWallSprite(cellRect: ReturnType<MazeGrid['getCellRect']>): Phaser.GameObjects.Image {
    const sprite = this.add.image(cellRect.centerX, cellRect.centerY, 'wall-locked');
    sprite.setDisplaySize(cellRect.width, cellRect.height);
    sprite.setTint(this.currentPalette.lockedWallTint);
    return sprite;
  }

  private createIconSprite(key: string, x: number, y: number, size: number): Phaser.GameObjects.Image {
    const sprite = this.add.image(x, y, key);
    sprite.setScale(Math.min(size / sprite.width, size / sprite.height));
    return sprite;
  }

  private createGoalSideLock(tileX: number, tileY: number): Phaser.GameObjects.Image {
    const cellRect = this.activeMaze.getCellRect(tileX, tileY);
    return this.createLockedWallSprite(cellRect);
  }

  private spawnRoomSuperPickup(room: ReturnType<WorldModel['getRoom']>): void {
    if (room.superPickupCollected || this.activePickups.some((pickup) => pickup.isSuper)) {
      return;
    }

    const pickup = room.definition.superPickup;
    const point = this.activeMaze.tileToWorld(pickup.spawn.tileX, pickup.spawn.tileY);
    const sprite = this.createSuperPowerSprite(pickup.type as SuperPowerUpType, point.x, point.y);
    this.roomLayer.add(sprite);
    this.activePickups.push({ id: pickup.id, sprite, type: pickup.type, isSuper: true });
  }

  private applySuperPickup(type: SuperPowerUpType): void {
    this.worldModel.addScore(this.currentTuning.score.superPowerUpPickup);

    switch (type) {
      case 'magicSword':
        this.magicSwordKillsRemaining = 12;
        this.player.gauges.sword = 100;
        this.swordExpiresAt = Number.POSITIVE_INFINITY;
        this.enemyDirector.makeVulnerableIndefinitely(
          this.time.now,
          this.enemies,
          this.activeMaze.worldToTile(this.player.sprite.x, this.player.sprite.y),
        );
        this.audioManager.playEvent('sword');
        break;
      case 'goldenApple':
        this.lifeDrainMultiplier = 0.3;
        this.player.refillGauge('life', this.currentTuning.appleRestore * 2.8);
        this.audioManager.playEvent('apple');
        break;
      case 'goldenTorch':
        this.lightDrainMultiplier = 0.3;
        this.player.refillGauge('light', 100);
        this.audioManager.playEvent('torch');
        break;
      case 'heart':
        this.worldModel.progress.lives += 1;
        this.audioManager.playEvent('key');
        break;
      case 'magicBoot':
        this.worldModel.progress.hasMagicBoot = true;
        this.player.setSpeedMultiplier(this.getPlayerSpeedMultiplier());
        this.audioManager.playEvent('torch');
        break;
    }
  }

  private expireSwordPower(): void {
    this.magicSwordKillsRemaining = 0;
    this.player.gauges.sword = 0;
    this.swordExpiresAt = 0;
    this.enemyDirector.clearVulnerable(this.time.now, this.enemies);
  }

  private pickEnemySpawns(preferredSpawns: SpawnDefinition[], playerSpawn: SpawnDefinition): SpawnDefinition[] {
    const candidates: SpawnDefinition[] = [];
    for (let y = 0; y < this.activeMaze.definition.height; y += 1) {
      for (let x = 0; x < this.activeMaze.definition.width; x += 1) {
        const isTwoByTwoCell = (x + 1) % 2 === 0 && (y + 1) % 2 === 0;
        if (!this.activeMaze.isWalkable(x, y)) {
          continue;
        }
        if (!isTwoByTwoCell) {
          continue;
        }
        const distance = Math.abs(x - playerSpawn.tileX) + Math.abs(y - playerSpawn.tileY);
        const exitCount = (['up', 'down', 'left', 'right'] as Direction[]).filter((direction) => this.activeMaze.canMove(x, y, direction)).length;
        if (distance < 10 || exitCount < 2) {
          continue;
        }
        candidates.push({ tileX: x, tileY: y });
      }
    }

    const pool = candidates.length >= this.enemies.length ? candidates : preferredSpawns;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const unique: SpawnDefinition[] = [];

    for (const spawn of [...shuffled, ...preferredSpawns]) {
      if (unique.some((candidate) => candidate.tileX === spawn.tileX && candidate.tileY === spawn.tileY)) {
        continue;
      }
      unique.push(spawn);
      if (unique.length >= this.enemies.length) {
        break;
      }
    }

    return unique;
  }

  private saveCurrentRoomEnemySnapshots(): void {
    const room = this.worldModel.getRoom(this.worldModel.currentRoom);
    room.enemySnapshots = this.enemies.map((enemy) => {
      const tile = this.activeMaze.worldToTile(enemy.sprite.x, enemy.sprite.y);
      return {
        tileX: tile.x,
        tileY: tile.y,
      };
    });
  }

  private resolveEnemySpawns(room: ReturnType<WorldModel['getRoom']>, playerSpawn: SpawnDefinition): SpawnDefinition[] {
    const savedSpawns = room.enemySnapshots;
    if (!savedSpawns || savedSpawns.length === 0) {
      return this.pickEnemySpawns(room.definition.enemySpawns, playerSpawn);
    }

    const fallback = this.pickEnemySpawns(room.definition.enemySpawns, playerSpawn);
    const unique: SpawnDefinition[] = [];

    for (let index = 0; index < this.enemies.length; index += 1) {
      const saved = savedSpawns[index];
      const fallbackSpawn = fallback[index] ?? fallback[0];
      const spawn = saved && this.isPlausibleEnemySpawn(saved, playerSpawn, unique)
        ? saved
        : fallbackSpawn;

      unique.push(spawn);
    }

    return unique;
  }

  private isPlausibleEnemySpawn(spawn: SpawnDefinition, playerSpawn: SpawnDefinition, used: SpawnDefinition[]): boolean {
    if (!this.activeMaze.isWalkable(spawn.tileX, spawn.tileY)) {
      return false;
    }

    if (used.some((candidate) => candidate.tileX === spawn.tileX && candidate.tileY === spawn.tileY)) {
      return false;
    }

    const distanceToPlayer = Math.abs(spawn.tileX - playerSpawn.tileX) + Math.abs(spawn.tileY - playerSpawn.tileY);
    if (distanceToPlayer < 4) {
      return false;
    }

    return true;
  }

  private startGameplay(direction: Direction): void {
    this.gameStarted = true;
    this.beginRoomMovement(direction);
    this.enemies.forEach((enemy) => enemy.setState(this.player.gauges.sword > 0 || this.swordExpiresAt > this.time.now ? 'vulnerable' : 'chase', this.time.now));
  }

  private beginRoomMovement(direction: Direction): void {
    const tile = this.activeMaze.worldToTile(this.player.sprite.x, this.player.sprite.y);
    if (!this.activeMaze.findNextTravelTarget(tile.x, tile.y, direction, true)) {
      return;
    }
    this.awaitingPlayerInput = false;
    this.player.setDirection(direction);
  }

  private handleGoalCollection(): void {
    const room = this.worldModel.getRoom(this.worldModel.currentRoom);
    if (room.goalCollected) {
      return;
    }

    const playerTile = this.activeMaze.worldToTile(this.player.sprite.x, this.player.sprite.y);
    if (this.activeMaze.getCellValue(playerTile.x, playerTile.y) !== 'G') {
      return;
    }

    if (!this.worldModel.collectGoal(room)) {
      return;
    }

    this.activeGoalVisual?.destroy();
    this.activeGoalVisual = undefined;
      this.worldModel.addScore(this.currentTuning.score.cageOpened);
    this.audioManager.playEvent('key');

    if (this.worldModel.isWorldComplete()) {
      this.worldModel.addScore(this.currentTuning.score.worldComplete);
      this.audioManager.playEvent('win');
      this.advanceToNextWorld();
    }
  }

  private advanceToNextWorld(): void {
    const carryOver: Partial<Pick<WorldProgress, 'score' | 'lives' | 'hasMagicBoot'>> = {
      score: this.worldModel.progress.score,
      lives: this.worldModel.progress.lives,
      hasMagicBoot: this.worldModel.progress.hasMagicBoot,
    };

    this.roomTransitionInProgress = true;
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.currentWorldNumber += 1;
      this.currentWorldDefinition = createWorldDefinition(this.currentWorldNumber - 1);
      this.currentTuning = this.buildWorldTuning(this.currentWorldNumber);
      this.currentPalette = this.getWorldPalette(this.currentWorldNumber);
      this.worldModel = new WorldModel(this.currentWorldDefinition, carryOver);
      this.enemyDirector = new EnemyDirector(
        this.currentTuning.scatterDurationMs,
        this.currentTuning.chaseDurationMs,
        this.currentTuning.swordDurationMs,
      );
      this.roomStateByKey.clear();
      this.buildRoomStates();
      this.updateBackdropPalette();
      this.swordExpiresAt = 0;
      this.magicSwordKillsRemaining = 0;
      this.player.gauges.life = INITIAL_GAUGES.life;
      this.player.gauges.light = INITIAL_GAUGES.light;
      this.player.gauges.sword = 0;
      this.player.setSpeedMultiplier(this.getPlayerSpeedMultiplier());
      this.loadRoom({ x: 1, y: 1 }, 'right', true);
      this.cameras.main.fadeIn(260, 0, 0, 0);
      this.showWorldTitleCard(() => {
        this.roomTransitionInProgress = false;
      });
    });
  }

  private showWorldTitleCard(onComplete?: () => void): void {
    const overlay = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    const blackout = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 1);
    const worldLabel = this.add.text(0, -150, `Monde ${this.currentWorldNumber}`, {
      fontFamily: 'Trebuchet MS',
      fontSize: '46px',
      color: '#f5e7b8',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5);
    const virtueLabel = this.add.text(0, -82, `Le ${this.currentWorldDefinition.virtueName.toLowerCase()}`, {
      fontFamily: 'Trebuchet MS',
      fontSize: '58px',
      color: '#fff6d6',
      stroke: '#000000',
      strokeThickness: 10,
    }).setOrigin(0.5);
    const iconKey = VIRTUE_ICON_BY_NAME[this.currentWorldDefinition.virtueName as (typeof WORLD_VIRTUES)[number]] ?? GOAL_ICON_KEYS[0];
    const icon = this.add.image(0, 70, iconKey);
    icon.setScale(Math.min(220 / icon.width, 220 / icon.height));
    overlay.add([blackout, worldLabel, virtueLabel, icon]);
    overlay.setAlpha(1);
    overlay.setDepth(300);
    worldLabel.setAlpha(0);
    virtueLabel.setAlpha(0);
    icon.setAlpha(0);

    this.tweens.add({
      targets: [worldLabel, virtueLabel, icon],
      alpha: 1,
      duration: 260,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: overlay,
          alpha: 0,
          duration: 320,
          delay: 1150,
          ease: 'Sine.easeIn',
          onComplete: () => {
            overlay.destroy();
            onComplete?.();
          },
        });
      },
    });
  }

  private buildWorldTuning(worldNumber: number): TuningDefinition {
    const level = Math.max(0, worldNumber - 1);
    const enemySpeedMultiplier = Math.min(1.4, 1 + (level * 0.045));
    const drainMultiplier = Math.min(1.3, 1 + (level * 0.03));
    const swordDurationMultiplier = Math.max(0.72, 1 - (level * 0.035));
    const scoreMultiplier = 1 + (level * 0.08);

    return {
      ...TUNING,
      enemySpeed: Math.round(TUNING.enemySpeed * enemySpeedMultiplier),
      vulnerableEnemySpeed: Math.round(TUNING.vulnerableEnemySpeed * enemySpeedMultiplier),
      respawnEnemySpeed: Math.round(TUNING.respawnEnemySpeed * enemySpeedMultiplier),
      lifeDrainPerSecond: Number((TUNING.lifeDrainPerSecond * drainMultiplier).toFixed(2)),
      lightDrainPerSecond: Number((TUNING.lightDrainPerSecond * drainMultiplier).toFixed(2)),
      swordDurationMs: Math.round(TUNING.swordDurationMs * swordDurationMultiplier),
      score: {
        keyPickup: Math.round(TUNING.score.keyPickup * scoreMultiplier),
        powerUpPickup: Math.round(TUNING.score.powerUpPickup * scoreMultiplier),
        superPowerUpPickup: Math.round(TUNING.score.superPowerUpPickup * scoreMultiplier),
        enemyCaptured: Math.round(TUNING.score.enemyCaptured * scoreMultiplier),
        cageOpened: Math.round(TUNING.score.cageOpened * scoreMultiplier),
        worldComplete: Math.round(TUNING.score.worldComplete * scoreMultiplier),
      },
    };
  }

  private getWorldPalette(worldNumber: number): WorldPalette {
    return WORLD_PALETTES[(worldNumber - 1) % WORLD_PALETTES.length];
  }
}
