import Phaser from 'phaser';
import { MazeGrid } from '../core/MazeGrid';
import type { Direction, EnemyState } from '../types';

type EnemyProfile = 'direct' | 'ambush' | 'shy' | 'erratic';

const DIRECTION_VECTORS: Record<Direction, Phaser.Math.Vector2> = {
  up: new Phaser.Math.Vector2(0, -1),
  down: new Phaser.Math.Vector2(0, 1),
  left: new Phaser.Math.Vector2(-1, 0),
  right: new Phaser.Math.Vector2(1, 0),
};

const ALL_DIRECTIONS: Direction[] = ['up', 'left', 'down', 'right'];

export class EnemyController {
  readonly warningOverlay: Phaser.GameObjects.Image;
  readonly warningAura: Phaser.GameObjects.Ellipse;
  readonly sprite: Phaser.GameObjects.Image;
  readonly profile: EnemyProfile;
  state: EnemyState = 'scatter';
  permanentlyDefeated = false;
  private readonly baseScale: number;
  private maze: MazeGrid;
  private homeTile: Phaser.Math.Vector2;
  private scatterTarget: Phaser.Math.Vector2;
  private readonly baseColor: number;
  private decisionMistakeChance: number;
  private currentDirection: Direction = 'left';
  private respawnEndsAt = 0;
  private nextTargetTile: Phaser.Math.Vector2 | null = null;
  private vulnerableWarningActive = false;
  private vulnerableWarningWhitePhase = false;

  constructor(
    scene: Phaser.Scene,
    maze: MazeGrid,
    tileX: number,
    tileY: number,
    color: number,
    profile: EnemyProfile,
    scatterTarget: Phaser.Math.Vector2,
    decisionMistakeChance: number,
  ) {
    const position = maze.tileToWorld(tileX, tileY);
    this.warningAura = scene.add.ellipse(position.x, position.y, maze.tileSize * 1.9, maze.tileSize * 1.9, 0xff2f2f, 0);
    this.sprite = scene.add.image(position.x, position.y, 'icon-skull');
    this.warningOverlay = scene.add.image(position.x, position.y, 'icon-skull');
    this.baseScale = (maze.tileSize * 1.33) / this.sprite.width;
    this.sprite.setScale(this.baseScale);
    this.warningOverlay.setScale(this.baseScale);
    this.warningOverlay.setVisible(false);
    this.maze = maze;
    this.baseColor = color;
    this.profile = profile;
    this.homeTile = new Phaser.Math.Vector2(tileX, tileY);
    this.scatterTarget = scatterTarget;
    this.decisionMistakeChance = decisionMistakeChance;
    this.refreshTint();
  }

  setState(state: EnemyState, now: number, respawnDelayMs = 0): void {
    if (this.permanentlyDefeated) {
      return;
    }
    this.state = state;
    if (state === 'respawning') {
      this.respawnEndsAt = now + respawnDelayMs;
      this.sprite.setVisible(false);
    } else {
      this.sprite.setVisible(true);
    }
    this.refreshTint();
  }

  update(now: number, deltaSeconds: number, playerTile: Phaser.Math.Vector2, playerDirection: Direction, speed: number): void {
    if (this.permanentlyDefeated) {
      return;
    }

    if (this.state === 'respawning' && now >= this.respawnEndsAt) {
      this.setState('scatter', now);
      const home = this.maze.tileToWorld(this.homeTile.x, this.homeTile.y);
      this.warningAura.setPosition(home.x, home.y);
      this.sprite.setPosition(home.x, home.y);
      this.warningOverlay.setPosition(home.x, home.y);
      this.currentDirection = this.pickFirstAvailableDirection(this.homeTile.x, this.homeTile.y);
      this.nextTargetTile = this.maze.findNextAnchorTile(this.homeTile.x, this.homeTile.y, this.currentDirection);
    }

    let currentTile = this.maze.worldToTile(this.sprite.x, this.sprite.y);
    const centered = this.maze.isAnchorTile(currentTile.x, currentTile.y) && this.maze.isNearCenter(this.sprite.x, this.sprite.y);
    if (centered) {
      this.maze.snapToCenter(this.sprite);
      currentTile = this.maze.worldToTile(this.sprite.x, this.sprite.y);
      this.currentDirection = this.chooseDirection(
        currentTile,
        playerTile,
        playerDirection,
        this.maze.findNextAnchorTile(currentTile.x, currentTile.y, this.currentDirection) === null,
      );
      this.nextTargetTile = this.maze.findNextAnchorTile(currentTile.x, currentTile.y, this.currentDirection);
    }

    if (!this.nextTargetTile) {
      this.nextTargetTile = this.maze.findNextAnchorTile(currentTile.x, currentTile.y, this.currentDirection);
      if (!this.nextTargetTile) {
        return;
      }
    }

    const vector = DIRECTION_VECTORS[this.currentDirection];
    const targetWorld = this.maze.tileToWorld(this.nextTargetTile.x, this.nextTargetTile.y);
    const step = speed * deltaSeconds;
    const nextX = this.clampStep(this.sprite.x, targetWorld.x, vector.x, step);
    const nextY = this.clampStep(this.sprite.y, targetWorld.y, vector.y, step);

    if (this.canOccupy(nextX, nextY)) {
      this.warningAura.setPosition(nextX, nextY);
      this.sprite.setPosition(nextX, nextY);
      this.warningOverlay.setPosition(nextX, nextY);
      if (nextX === targetWorld.x && nextY === targetWorld.y) {
        this.nextTargetTile = null;
      }
    } else if (centered) {
      this.currentDirection = this.chooseDirection(currentTile, playerTile, playerDirection, true);
      this.nextTargetTile = this.maze.findNextAnchorTile(currentTile.x, currentTile.y, this.currentDirection);
    }
  }

  attachMaze(maze: MazeGrid, tileX: number, tileY: number, scatterTarget: Phaser.Math.Vector2): void {
    this.maze = maze;
    this.homeTile = new Phaser.Math.Vector2(tileX, tileY);
    this.scatterTarget = scatterTarget;
    if (this.permanentlyDefeated) {
      this.sprite.setVisible(false);
      return;
    }
    const home = this.maze.tileToWorld(tileX, tileY);
    this.warningAura.setPosition(home.x, home.y);
    this.sprite.setPosition(home.x, home.y);
    this.warningOverlay.setPosition(home.x, home.y);
    this.currentDirection = this.pickRandomAvailableDirection(tileX, tileY);
    this.nextTargetTile = this.maze.findNextAnchorTile(tileX, tileY, this.currentDirection);
    this.refreshTint();
  }

  setDecisionMistakeChance(decisionMistakeChance: number): void {
    this.decisionMistakeChance = Phaser.Math.Clamp(decisionMistakeChance, 0, 0.95);
  }

  private chooseDirection(currentTile: Phaser.Math.Vector2, playerTile: Phaser.Math.Vector2, playerDirection: Direction, allowReverse = false): Direction {
    const nonReverseCandidates = ALL_DIRECTIONS.filter((direction) => !this.isReverse(direction) && this.canMoveToInteriorAnchor(currentTile.x, currentTile.y, direction));
    const candidates = nonReverseCandidates.length > 0
      ? nonReverseCandidates
      : ALL_DIRECTIONS.filter((direction) => (allowReverse || !this.isReverse(direction)) && this.canMoveToInteriorAnchor(currentTile.x, currentTile.y, direction));

    if (candidates.length === 0) {
      const reverse = this.getReverseDirection();
      if (this.canMoveToInteriorAnchor(currentTile.x, currentTile.y, reverse)) {
        return reverse;
      }
      return this.pickFirstAvailableDirection(currentTile.x, currentTile.y);
    }

    if (this.state === 'vulnerable') {
      candidates.sort((a, b) => {
        const aTile = this.maze.findNextAnchorTile(currentTile.x, currentTile.y, a) ?? currentTile;
        const bTile = this.maze.findNextAnchorTile(currentTile.x, currentTile.y, b) ?? currentTile;
        const distanceA = Phaser.Math.Distance.Between(aTile.x, aTile.y, playerTile.x, playerTile.y);
        const distanceB = Phaser.Math.Distance.Between(bTile.x, bTile.y, playerTile.x, playerTile.y);
        const scoreA = distanceA + this.countInteriorExits(aTile.x, aTile.y) * 2.4;
        const scoreB = distanceB + this.countInteriorExits(bTile.x, bTile.y) * 2.4;
        return scoreB - scoreA;
      });
      return candidates[0];
    }

    const target = this.resolveTarget(playerTile, playerDirection);
    candidates.sort((a, b) => {
      const aTile = this.maze.findNextAnchorTile(currentTile.x, currentTile.y, a) ?? currentTile;
      const bTile = this.maze.findNextAnchorTile(currentTile.x, currentTile.y, b) ?? currentTile;
      const distanceA = Phaser.Math.Distance.Between(aTile.x, aTile.y, target.x, target.y);
      const distanceB = Phaser.Math.Distance.Between(bTile.x, bTile.y, target.x, target.y);
      return distanceA - distanceB;
    });

    if (candidates[1] && Math.random() < this.decisionMistakeChance) {
      return candidates[1];
    }

    if (this.profile === 'erratic' && Math.random() > 0.66 && candidates[1]) {
      return candidates[1];
    }
    return candidates[0];
  }

  private resolveTarget(playerTile: Phaser.Math.Vector2, playerDirection: Direction): Phaser.Math.Vector2 {
    switch (this.profile) {
      case 'direct':
        return playerTile.clone();
      case 'ambush':
        return playerTile.clone().add(DIRECTION_VECTORS[playerDirection].clone().scale(3));
      case 'shy':
        if (Phaser.Math.Distance.Between(playerTile.x, playerTile.y, this.homeTile.x, this.homeTile.y) < 5) {
          return this.scatterTarget.clone();
        }
        return playerTile.clone();
      case 'erratic':
        return Math.random() > 0.5 ? playerTile.clone() : this.scatterTarget.clone();
      default:
        return playerTile.clone();
    }
  }

  private getReverseDirection(): Direction {
    switch (this.currentDirection) {
      case 'up': return 'down';
      case 'down': return 'up';
      case 'left': return 'right';
      case 'right': return 'left';
    }
  }

  private isReverse(direction: Direction): boolean {
    return this.getReverseDirection() === direction;
  }

  reverseDirection(playerTile?: Phaser.Math.Vector2): void {
    if (this.permanentlyDefeated || this.state === 'respawning') {
      return;
    }
    const tile = this.maze.worldToTile(this.sprite.x, this.sprite.y);
    const reverse = this.getReverseDirection();
    if (!this.canMoveToInteriorAnchor(tile.x, tile.y, reverse)) {
      return;
    }
    if (playerTile) {
      const currentTarget = this.maze.findNextAnchorTile(tile.x, tile.y, this.currentDirection);
      const reverseTarget = this.maze.findNextAnchorTile(tile.x, tile.y, reverse);
      if (reverseTarget) {
        const reverseDistance = Phaser.Math.Distance.Between(reverseTarget.x, reverseTarget.y, playerTile.x, playerTile.y);
        const currentDistance = currentTarget ? Phaser.Math.Distance.Between(currentTarget.x, currentTarget.y, playerTile.x, playerTile.y) : Number.NEGATIVE_INFINITY;
        if (reverseDistance <= currentDistance) {
          return;
        }
      }
    }
    this.currentDirection = reverse;
    this.nextTargetTile = this.maze.findNextAnchorTile(tile.x, tile.y, reverse);
  }

  defeatForever(): void {
    this.permanentlyDefeated = true;
    this.sprite.setVisible(false);
  }

  setDefeatedStatus(defeated: boolean): void {
    this.permanentlyDefeated = defeated;
    this.nextTargetTile = null;
    if (defeated) {
      this.warningAura.setVisible(false);
      this.warningOverlay.setVisible(false);
      this.sprite.setVisible(false);
      return;
    }
    this.warningAura.setVisible(false);
    this.warningOverlay.setVisible(false);
    this.sprite.setVisible(true);
    this.refreshTint();
  }

  setVulnerableFlash(active: boolean, useWhitePhase: boolean): void {
    if (this.vulnerableWarningActive === active && this.vulnerableWarningWhitePhase === useWhitePhase) {
      return;
    }
    this.vulnerableWarningActive = active;
    this.vulnerableWarningWhitePhase = useWhitePhase;
    this.refreshTint();
  }

  setWarningPresentation(): void {
    this.sprite.setScale(this.baseScale);
    this.warningAura.setVisible(false);
    this.warningOverlay.setVisible(false);
  }

  private refreshTint(): void {
    if (this.permanentlyDefeated) {
      this.warningAura.setVisible(false);
      this.warningOverlay.setVisible(false);
      this.sprite.setVisible(false);
      return;
    }
    if (this.state === 'vulnerable') {
      if (this.vulnerableWarningActive) {
        this.sprite.setTint(this.vulnerableWarningWhitePhase ? 0xaeb8ff : 0xff2f2f);
      } else {
        this.sprite.setTint(0xaeb8ff);
      }
      return;
    }
    if (this.state === 'respawning') {
      this.warningAura.setVisible(false);
      this.warningOverlay.setVisible(false);
      this.sprite.setTint(0x8b4b64);
      return;
    }
    if (!this.vulnerableWarningActive) {
      this.warningAura.setVisible(false);
      this.warningOverlay.setVisible(false);
    }
    this.sprite.setTint(this.baseColor);
  }

  private canOccupy(worldX: number, worldY: number): boolean {
    const tile = this.maze.worldToTile(worldX, worldY);
    return !this.maze.isWall(tile.x, tile.y);
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

  private pickFirstAvailableDirection(tileX: number, tileY: number): Direction {
    return ALL_DIRECTIONS.find((direction) => this.canMoveToInteriorAnchor(tileX, tileY, direction)) ?? 'left';
  }

  private pickRandomAvailableDirection(tileX: number, tileY: number): Direction {
    const options = ALL_DIRECTIONS.filter((direction) => this.canMoveToInteriorAnchor(tileX, tileY, direction));
    return options.length === 0 ? 'left' : Phaser.Utils.Array.GetRandom(options);
  }

  private canMoveToInteriorAnchor(tileX: number, tileY: number, direction: Direction): boolean {
    return this.maze.findNextAnchorTile(tileX, tileY, direction) !== null;
  }

  private countInteriorExits(tileX: number, tileY: number): number {
    return ALL_DIRECTIONS.filter((direction) => this.canMoveToInteriorAnchor(tileX, tileY, direction)).length;
  }
}
