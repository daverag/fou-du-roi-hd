import type { RoomDefinition, SpawnDefinition } from '../types';

export class RoomModel {
  readonly definition: RoomDefinition;
  readonly collectedPickupIds = new Set<string>();
  readonly defeatedEnemyIndexes = new Set<number>();
  enemySnapshots: SpawnDefinition[] | null = null;
  superPickupCollected = false;
  lockOpened = false;
  goalCollected = false;

  constructor(definition: RoomDefinition) {
    this.definition = definition;
  }
}
