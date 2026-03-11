import Phaser from 'phaser';
import { MAX_GAUGE } from '../constants';
import { MazeGrid } from '../core/MazeGrid';
import type { Direction, GaugeValues } from '../types';

const DIRECTION_VECTORS: Record<Direction, Phaser.Math.Vector2> = {
  up: new Phaser.Math.Vector2(0, -1),
  down: new Phaser.Math.Vector2(0, 1),
  left: new Phaser.Math.Vector2(-1, 0),
  right: new Phaser.Math.Vector2(1, 0),
};

export class PlayerController {
  readonly sprite: Phaser.GameObjects.Image;
  readonly gauges: GaugeValues;
  currentDirection: Direction;
  desiredDirection: Direction;
  isAlive = true;
  private maze: MazeGrid;
  private readonly speed: number;
  private speedMultiplier = 1;
  private readonly debugMovement = true;
  private nextTargetTile: Phaser.Math.Vector2 | null = null;
  private readonly preTurnWindow: number;

  constructor(scene: Phaser.Scene, maze: MazeGrid, startTileX: number, startTileY: number, speed: number, initialGauges: GaugeValues) {
    const start = maze.tileToWorld(startTileX, startTileY);
    this.sprite = scene.add.image(start.x, start.y, 'icon-hero');
    this.sprite.setScale((maze.tileSize * 1.64) / this.sprite.width);
    this.maze = maze;
    this.speed = speed;
    this.preTurnWindow = Math.max(6, maze.tileSize * 0.28);
    this.currentDirection = 'right';
    this.desiredDirection = 'right';
    this.gauges = { ...initialGauges };
  }

  setDesiredDirection(direction: Direction): void {
    const tile = this.maze.worldToTile(this.sprite.x, this.sprite.y);
    const centered = this.maze.isAnchorTile(tile.x, tile.y) && this.maze.isNearCenter(this.sprite.x, this.sprite.y);
    const moving = this.maze.canMove(tile.x, tile.y, this.currentDirection);
    if (centered && !moving && !this.maze.canMove(tile.x, tile.y, direction)) {
      this.debugLog('reject_direction', {
        tileX: tile.x,
        tileY: tile.y,
        currentDirection: this.currentDirection,
        requestedDirection: direction,
      });
      return;
    }
    this.debugLog('buffer_direction', {
      tileX: tile.x,
      tileY: tile.y,
      currentDirection: this.currentDirection,
      requestedDirection: direction,
    });
    this.desiredDirection = direction;
  }

  setDirection(direction: Direction): void {
    this.currentDirection = direction;
    this.desiredDirection = direction;
    const tile = this.maze.worldToTile(this.sprite.x, this.sprite.y);
    this.nextTargetTile = this.maze.findNextTravelTarget(tile.x, tile.y, direction, true);
  }

  update(deltaSeconds: number): void {
    let remaining = this.speed * this.speedMultiplier * deltaSeconds;
    let iterations = 0;

    while (remaining > 0.0001 && iterations < 4) {
      iterations += 1;
      let currentTile = this.maze.worldToTile(this.sprite.x, this.sprite.y);
      const centered = this.maze.isAnchorTile(currentTile.x, currentTile.y) && this.maze.isNearCenter(this.sprite.x, this.sprite.y);

      if (centered) {
        this.maze.snapToCenter(this.sprite);
        currentTile = this.maze.worldToTile(this.sprite.x, this.sprite.y);

        const desiredTarget = this.maze.findNextTravelTarget(currentTile.x, currentTile.y, this.desiredDirection, true);
        if (desiredTarget) {
          if (this.currentDirection !== this.desiredDirection) {
            this.debugLog('turn', {
              tileX: currentTile.x,
              tileY: currentTile.y,
              from: this.currentDirection,
              to: this.desiredDirection,
            });
          }
          this.currentDirection = this.desiredDirection;
          this.nextTargetTile = desiredTarget;
        } else {
          this.nextTargetTile = this.maze.findNextTravelTarget(currentTile.x, currentTile.y, this.currentDirection, true);
        }

        if (!this.nextTargetTile) {
          this.debugLog('stopped_at_anchor', {
            tileX: currentTile.x,
            tileY: currentTile.y,
            currentDirection: this.currentDirection,
            desiredDirection: this.desiredDirection,
          });
          return;
        }
      }

      if (!this.nextTargetTile) {
        this.nextTargetTile = this.maze.findNextTravelTarget(currentTile.x, currentTile.y, this.currentDirection, true);
        if (!this.nextTargetTile) {
          return;
        }
      }

      if (this.tryImmediateReverse(currentTile) || this.tryPreTurn(remaining)) {
        continue;
      }

      const directionVector = DIRECTION_VECTORS[this.currentDirection];
      const targetWorld = this.maze.tileToWorld(this.nextTargetTile.x, this.nextTargetTile.y);
      const distanceToTarget = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, targetWorld.x, targetWorld.y);

      if (distanceToTarget <= 0.0001) {
        this.sprite.x = targetWorld.x;
        this.sprite.y = targetWorld.y;
        this.nextTargetTile = null;
        continue;
      }

      const step = Math.min(remaining, distanceToTarget);
      const nextX = this.clampStep(this.sprite.x, targetWorld.x, directionVector.x, step);
      const nextY = this.clampStep(this.sprite.y, targetWorld.y, directionVector.y, step);

      if (this.canOccupy(nextX, nextY) || this.isExitingRoom(currentTile.x, currentTile.y)) {
        this.sprite.x = nextX;
        this.sprite.y = nextY;
        remaining -= step;

        if (nextX === targetWorld.x && nextY === targetWorld.y) {
          this.nextTargetTile = null;
        } else {
          break;
        }
      } else if (centered) {
        this.debugLog('blocked_move', {
          tileX: currentTile.x,
          tileY: currentTile.y,
          currentDirection: this.currentDirection,
          desiredDirection: this.desiredDirection,
          nextX,
          nextY,
        });
        this.maze.snapToCenter(this.sprite);
        return;
      } else {
        return;
      }
    }
  }

  private canOccupy(worldX: number, worldY: number): boolean {
    const tile = this.maze.worldToTile(worldX, worldY);
    return !this.maze.isWall(tile.x, tile.y);
  }

  private isExitingRoom(tileX: number, tileY: number): boolean {
    return this.maze.canExitBoundary(tileX, tileY, this.currentDirection);
  }

  drainGauge(key: keyof GaugeValues, amount: number): boolean {
    this.gauges[key] = Math.max(0, this.gauges[key] - amount);
    return this.gauges[key] === 0;
  }

  refillGauge(key: keyof GaugeValues, amount: number): void {
    this.gauges[key] = Math.min(MAX_GAUGE, this.gauges[key] + amount);
  }

  resetPosition(tileX: number, tileY: number): void {
    const point = this.maze.tileToWorld(tileX, tileY);
    this.sprite.setPosition(point.x, point.y);
    this.currentDirection = 'right';
    this.desiredDirection = 'right';
    this.nextTargetTile = null;
  }

  attachMaze(maze: MazeGrid, tileX: number, tileY: number, direction: Direction = 'right'): void {
    this.maze = maze;
    const point = this.maze.tileToWorld(tileX, tileY);
    this.sprite.setPosition(point.x, point.y);
    this.currentDirection = direction;
    this.desiredDirection = direction;
    this.nextTargetTile = null;
  }

  setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = multiplier;
  }

  getSpeedRatio(): number {
    return this.speedMultiplier;
  }

  private clampStep(current: number, target: number, axisDirection: number, step: number): number {
    if (axisDirection === 0) {
      return target;
    }
    if (axisDirection > 0) {
      return Math.min(current + step, target);
    }
    return Math.max(current - step, target);
  }

  private debugLog(event: string, payload: Record<string, unknown>): void {
    if (!this.debugMovement) {
      return;
    }
    console.debug(`[player:${event}]`, payload);
  }

  private tryImmediateReverse(currentTile: Phaser.Math.Vector2): boolean {
    const currentVector = DIRECTION_VECTORS[this.currentDirection];
    const desiredVector = DIRECTION_VECTORS[this.desiredDirection];
    const isReverse = currentVector.x === -desiredVector.x && currentVector.y === -desiredVector.y;
    if (!isReverse) {
      return false;
    }
    const reverseTarget = this.maze.findNextTravelTarget(currentTile.x, currentTile.y, this.desiredDirection, true);
    if (!reverseTarget) {
      return false;
    }
    this.currentDirection = this.desiredDirection;
    this.nextTargetTile = reverseTarget;
    this.debugLog('reverse', {
      tileX: currentTile.x,
      tileY: currentTile.y,
      to: this.desiredDirection,
    });
    return true;
  }

  private tryPreTurn(remaining: number): boolean {
    if (!this.nextTargetTile || this.desiredDirection === this.currentDirection) {
      return false;
    }
    const currentVector = DIRECTION_VECTORS[this.currentDirection];
    const desiredVector = DIRECTION_VECTORS[this.desiredDirection];
    const isPerpendicular = currentVector.x !== desiredVector.x && currentVector.y !== desiredVector.y;
    if (!isPerpendicular) {
      return false;
    }
    const desiredTarget = this.maze.findNextTravelTarget(this.nextTargetTile.x, this.nextTargetTile.y, this.desiredDirection, true);
    if (!desiredTarget) {
      return false;
    }
    const anchorWorld = this.maze.tileToWorld(this.nextTargetTile.x, this.nextTargetTile.y);
    const distanceToAnchor = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, anchorWorld.x, anchorWorld.y);
    const threshold = Math.max(this.preTurnWindow, remaining);
    if (distanceToAnchor > threshold) {
      return false;
    }
    this.sprite.setPosition(anchorWorld.x, anchorWorld.y);
    this.currentDirection = this.desiredDirection;
    this.nextTargetTile = desiredTarget;
    this.debugLog('pre_turn', {
      tileX: this.nextTargetTile.x,
      tileY: this.nextTargetTile.y,
      to: this.desiredDirection,
    });
    return true;
  }
}
