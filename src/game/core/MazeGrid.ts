import Phaser from 'phaser';
import type { Direction, MazeCellValue, MazeDefinition } from '../types';

const TILE_UNIT_THICKNESS = 0.16;
const DOOR_TILES: Record<Direction, Phaser.Math.Vector2> = {
  up: new Phaser.Math.Vector2(9, 0),
  down: new Phaser.Math.Vector2(9, 14),
  left: new Phaser.Math.Vector2(0, 7),
  right: new Phaser.Math.Vector2(18, 7),
};

export class MazeGrid {
  readonly tileSize: number;
  readonly definition: MazeDefinition;
  readonly origin: Phaser.Math.Vector2;
  readonly wallThickness: number;
  readonly corridorInset: number;
  readonly roomWidth: number;
  readonly roomHeight: number;
  private lockOpened = false;

  private readonly rowHeights: number[];
  private readonly columnWidths: number[];
  private readonly rowOffsets: number[];
  private readonly columnOffsets: number[];

  constructor(definition: MazeDefinition, tileSize: number, origin: Phaser.Math.Vector2) {
    this.definition = definition;
    this.tileSize = tileSize;
    this.origin = origin;
    this.rowHeights = Array.from({ length: definition.height }, (_, index) => this.cellHeight(index) * this.tileSize);
    this.columnWidths = Array.from({ length: definition.width }, (_, index) => this.cellWidth(index) * this.tileSize);
    this.rowOffsets = this.buildOffsets(this.rowHeights);
    this.columnOffsets = this.buildOffsets(this.columnWidths);
    this.roomWidth = this.columnWidths.reduce((sum, value) => sum + value, 0);
    this.roomHeight = this.rowHeights.reduce((sum, value) => sum + value, 0);
    this.wallThickness = Math.max(6, Math.round(this.tileSize * TILE_UNIT_THICKNESS));
    this.corridorInset = Math.max(4, Math.round(this.wallThickness * 0.75));
  }

  isWall(tileX: number, tileY: number): boolean {
    if (!this.isInside(tileX, tileY)) {
      return true;
    }

    return !this.isWalkableValue(this.getResolvedCellValue(tileX, tileY));
  }

  isWalkable(tileX: number, tileY: number): boolean {
    return this.isInside(tileX, tileY) && this.isWalkableValue(this.getResolvedCellValue(tileX, tileY));
  }

  isAnchorTile(tileX: number, tileY: number): boolean {
    return this.isWalkable(tileX, tileY) && (tileX + 1) % 2 === 0 && (tileY + 1) % 2 === 0;
  }

  canMove(tileX: number, tileY: number, direction: Direction): boolean {
    return this.findNextTravelTarget(tileX, tileY, direction, true) !== null;
  }

  canExitBoundary(tileX: number, tileY: number, direction: Direction): boolean {
    if (!this.isWalkable(tileX, tileY)) {
      return false;
    }

    const door = DOOR_TILES[direction];
    if (door.x !== tileX || door.y !== tileY) {
      return false;
    }

    return this.definition.doors[direction];
  }

  tileToWorld(tileX: number, tileY: number): Phaser.Math.Vector2 {
    const rect = this.getCellRect(tileX, tileY);
    return new Phaser.Math.Vector2(rect.centerX, rect.centerY);
  }

  getCellTopLeft(tileX: number, tileY: number): Phaser.Math.Vector2 {
    const rect = this.getCellRect(tileX, tileY);
    return new Phaser.Math.Vector2(rect.x, rect.y);
  }

  getCellRect(tileX: number, tileY: number): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.origin.x + this.columnOffsets[tileX],
      this.origin.y + this.rowOffsets[tileY],
      this.columnWidths[tileX],
      this.rowHeights[tileY],
    );
  }

  getCorridorRect(tileX: number, tileY: number): Phaser.Geom.Rectangle {
    const rect = this.getCellRect(tileX, tileY);
    return new Phaser.Geom.Rectangle(
      rect.x + this.corridorInset,
      rect.y + this.corridorInset,
      Math.max(4, rect.width - this.corridorInset * 2),
      Math.max(4, rect.height - this.corridorInset * 2),
    );
  }

  getCellValue(tileX: number, tileY: number): MazeCellValue {
    return this.getResolvedCellValue(tileX, tileY);
  }

  worldToTile(worldX: number, worldY: number): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      this.findIndex(worldX - this.origin.x, this.columnWidths, this.roomWidth),
      this.findIndex(worldY - this.origin.y, this.rowHeights, this.roomHeight),
    );
  }

  isNearCenter(worldX: number, worldY: number, epsilon = 0.75): boolean {
    const tile = this.worldToTile(worldX, worldY);
    if (!this.isInside(tile.x, tile.y)) {
      return false;
    }
    const center = this.tileToWorld(tile.x, tile.y);
    return Math.abs(center.x - worldX) <= epsilon && Math.abs(center.y - worldY) <= epsilon;
  }

  snapToCenter(sprite: Phaser.GameObjects.Components.Transform): Phaser.Math.Vector2 {
    const tile = this.worldToTile(sprite.x, sprite.y);
    if (!this.isInside(tile.x, tile.y)) {
      return new Phaser.Math.Vector2(sprite.x, sprite.y);
    }
    const center = this.tileToWorld(tile.x, tile.y);
    sprite.x = center.x;
    sprite.y = center.y;
    return center;
  }

  getBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.origin.x, this.origin.y, this.roomWidth, this.roomHeight);
  }

  getDoorTile(direction: Direction): Phaser.Math.Vector2 {
    return DOOR_TILES[direction].clone();
  }

  setLockOpened(lockOpened: boolean): void {
    this.lockOpened = lockOpened;
  }

  findNextAnchorTile(tileX: number, tileY: number, direction: Direction): Phaser.Math.Vector2 | null {
    return this.findNextTravelTarget(tileX, tileY, direction, false);
  }

  findNextTravelTarget(
    tileX: number,
    tileY: number,
    direction: Direction,
    allowExitBoundary: boolean,
  ): Phaser.Math.Vector2 | null {
    let next = this.getNeighbor(tileX, tileY, direction);
    while (this.isWalkable(next.x, next.y)) {
      if (allowExitBoundary && this.canExitBoundary(next.x, next.y, direction)) {
        return next;
      }
      if (this.isAnchorTile(next.x, next.y)) {
        return next;
      }
      next = this.getNeighbor(next.x, next.y, direction);
    }

    return null;
  }

  private cellWidth(tileX: number): number {
    return (tileX + 1) % 2 === 1 ? 1 : 2;
  }

  private cellHeight(tileY: number): number {
    return (tileY + 1) % 2 === 1 ? 1 : 2;
  }

  private buildOffsets(sizes: number[]): number[] {
    const offsets: number[] = [];
    let current = 0;
    for (const size of sizes) {
      offsets.push(current);
      current += size;
    }
    return offsets;
  }

  private findIndex(localPosition: number, sizes: number[], totalSize: number): number {
    if (localPosition < 0) {
      return -1;
    }
    if (localPosition >= totalSize) {
      return sizes.length;
    }

    let offset = 0;
    for (let index = 0; index < sizes.length; index += 1) {
      const size = sizes[index];
      if (localPosition < offset + size) {
        return index;
      }
      offset += size;
    }

    return sizes.length - 1;
  }

  private getNeighbor(tileX: number, tileY: number, direction: Direction): Phaser.Math.Vector2 {
    switch (direction) {
      case 'up':
        return new Phaser.Math.Vector2(tileX, tileY - 1);
      case 'down':
        return new Phaser.Math.Vector2(tileX, tileY + 1);
      case 'left':
        return new Phaser.Math.Vector2(tileX - 1, tileY);
      case 'right':
        return new Phaser.Math.Vector2(tileX + 1, tileY);
    }
  }

  private isInside(tileX: number, tileY: number): boolean {
    return tileX >= 0 && tileY >= 0 && tileX < this.definition.width && tileY < this.definition.height;
  }

  private isWalkableValue(value: MazeCellValue): boolean {
    return value === 0 || value === 'G';
  }

  private getResolvedCellValue(tileX: number, tileY: number): MazeCellValue {
    const value = this.definition.cells[tileY][tileX];
    if (value === 'L' && this.lockOpened) {
      return 0;
    }
    return value;
  }
}
