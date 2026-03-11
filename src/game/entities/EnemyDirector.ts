import type { EnemyController } from './EnemyController';

export class EnemyDirector {
  private vulnerableUntil = 0;

  constructor(
    _scatterDurationMs: number,
    _chaseDurationMs: number,
    private readonly swordDurationMs: number,
  ) {}

  start(_now: number): void {}

  update(now: number, enemies: EnemyController[]): void {
    if (now < this.vulnerableUntil) {
      enemies.forEach((enemy) => {
        if (enemy.state !== 'respawning') {
          enemy.setState('vulnerable', now);
        }
      });
      return;
    }

    if (this.vulnerableUntil !== 0) {
      this.vulnerableUntil = 0;
      enemies.forEach((enemy) => {
        if (enemy.state !== 'respawning') {
          enemy.setState('chase', now);
        }
      });
    }
  }

  makeVulnerable(now: number, enemies: EnemyController[], playerTile?: Phaser.Math.Vector2): void {
    this.vulnerableUntil = now + this.swordDurationMs;
    enemies.forEach((enemy) => {
      if (enemy.state !== 'respawning') {
        enemy.reverseDirection(playerTile);
        enemy.setState('vulnerable', now);
      }
    });
  }

  makeVulnerableIndefinitely(now: number, enemies: EnemyController[], playerTile?: Phaser.Math.Vector2): void {
    this.vulnerableUntil = Number.POSITIVE_INFINITY;
    enemies.forEach((enemy) => {
      if (enemy.state !== 'respawning') {
        enemy.reverseDirection(playerTile);
        enemy.setState('vulnerable', now);
      }
    });
  }

  clearVulnerable(now: number, enemies: EnemyController[]): void {
    if (this.vulnerableUntil === 0) {
      return;
    }

    this.vulnerableUntil = 0;
    enemies.forEach((enemy) => {
      if (enemy.state !== 'respawning') {
        enemy.setState('chase', now);
      }
    });
  }

  getVulnerableRemainingMs(now: number): number {
    if (this.vulnerableUntil === Number.POSITIVE_INFINITY) {
      return Number.POSITIVE_INFINITY;
    }

    if (this.vulnerableUntil <= now) {
      return 0;
    }

    return this.vulnerableUntil - now;
  }
}
