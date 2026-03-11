import { INITIAL_LIVES } from '../constants';
import type { PickupDefinition, RoomCoord, WorldDefinition, WorldProgress } from '../types';
import { RoomModel } from './RoomModel';

type WorldProgressCarryOver = Pick<WorldProgress, 'score' | 'lives' | 'hasMagicBoot'>;

export class WorldModel {
  readonly rooms: RoomModel[];
  readonly progress: WorldProgress;
  currentRoom: RoomCoord = { x: 1, y: 1 };

  constructor(definition: WorldDefinition, carryOver?: Partial<WorldProgressCarryOver>) {
    this.rooms = definition.rooms.map((room) => new RoomModel(room));
    this.progress = {
      keysCollected: 0,
      cagesOpened: 0,
      goalsCollected: 0,
      score: carryOver?.score ?? 0,
      lives: carryOver?.lives ?? INITIAL_LIVES,
      hasMagicBoot: carryOver?.hasMagicBoot ?? false,
    };
  }

  getRoom(coord: RoomCoord): RoomModel {
    const room = this.rooms.find((candidate) => candidate.definition.coord.x === coord.x && candidate.definition.coord.y === coord.y);
    if (!room) {
      throw new Error(`Room not found for ${coord.x},${coord.y}`);
    }
    return room;
  }

  unlockRandomOtherRoom(excludedRoom: RoomModel): RoomModel | null {
    const candidates = this.rooms.filter((room) => room !== excludedRoom && !room.lockOpened);
    if (candidates.length === 0) {
      return null;
    }

    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    selected.lockOpened = true;
    return selected;
  }

  hasOpenedCage(index: number): boolean {
    return this.rooms[index]?.goalCollected ?? false;
  }

  collectPickup(room: RoomModel, pickup: PickupDefinition): void {
    if (room.collectedPickupIds.has(pickup.id)) {
      return;
    }

    room.collectedPickupIds.add(pickup.id);

    if (pickup.type === 'key') {
      this.progress.keysCollected += 1;
      this.progress.cagesOpened += 1;
    }
  }

  collectSuperPickup(room: RoomModel): boolean {
    if (room.superPickupCollected) {
      return false;
    }

    room.superPickupCollected = true;
    return true;
  }

  collectGoal(room: RoomModel): boolean {
    if (room.goalCollected) {
      return false;
    }

    room.goalCollected = true;
    this.progress.goalsCollected += 1;
    return true;
  }

  addScore(value: number): void {
    this.progress.score += value;
  }

  loseLife(): void {
    this.progress.lives = Math.max(0, this.progress.lives - 1);
  }

  isWorldComplete(): boolean {
    return this.progress.goalsCollected >= this.rooms.length;
  }
}
