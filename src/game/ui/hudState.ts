import type { GaugeValues, RoomCoord } from '../types';

export type HudGaugeIcons = {
  sword: string;
  life: string;
  light: string;
};

export type HudSnapshot = {
  score: number;
  lives: number;
  gauges: GaugeValues;
  gaugeIcons: HudGaugeIcons;
  worldNumber: number;
  virtueName: string;
  virtueIconKey: string;
  currentRoom: RoomCoord;
  roomsWithGoal: boolean[];
  roomsUnlocked: boolean[];
  hasMagicBoot: boolean;
};

type HudListener = (snapshot: HudSnapshot | null) => void;

let snapshot: HudSnapshot | null = null;
const listeners = new Set<HudListener>();

export function setHudSnapshot(nextSnapshot: HudSnapshot): void {
  snapshot = nextSnapshot;
  listeners.forEach((listener) => listener(snapshot));
}

export function clearHudSnapshot(): void {
  snapshot = null;
  listeners.forEach((listener) => listener(snapshot));
}

export function subscribeToHudSnapshot(listener: HudListener): () => void {
  listeners.add(listener);
  listener(snapshot);
  return () => listeners.delete(listener);
}
