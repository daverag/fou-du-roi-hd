import { GAME_HEIGHT, GAME_WIDTH } from './constants';

export type LayoutMode = 'desktop' | 'mobile-portrait';

export type GameLayoutState = {
  mode: LayoutMode;
  isTouchDevice: boolean;
  useDomHud: boolean;
  viewportWidth: number;
  viewportHeight: number;
  roomOriginX: number;
  roomOriginY: number;
  roomWidth: number;
  roomHeight: number;
};

type LayoutListener = (state: GameLayoutState) => void;

const ROOM_WIDTH = 896;
const ROOM_HEIGHT = 704;
const DESKTOP_ORIGIN = {
  x: Math.round((GAME_WIDTH - ROOM_WIDTH) / 2),
  y: Math.round((GAME_HEIGHT - ROOM_HEIGHT) / 2),
};
const MOBILE_ORIGIN = {
  x: Math.round((GAME_WIDTH - ROOM_WIDTH) / 2),
  y: Math.round((GAME_HEIGHT - ROOM_HEIGHT) / 2),
};

let layoutState: GameLayoutState = createLayoutState();
const listeners = new Set<LayoutListener>();

function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
}

function createLayoutState(): GameLayoutState {
  const viewportWidth = typeof window === 'undefined' ? GAME_WIDTH : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? GAME_HEIGHT : window.innerHeight;
  const isTouchDevice = detectTouchDevice();
  const isPortrait = viewportHeight > viewportWidth;
  const isCompactMobile = viewportWidth <= 900;
  const mode: LayoutMode = isTouchDevice && isPortrait && isCompactMobile ? 'mobile-portrait' : 'desktop';
  const roomOrigin = mode === 'mobile-portrait' ? MOBILE_ORIGIN : DESKTOP_ORIGIN;

  return {
    mode,
    isTouchDevice,
    useDomHud: true,
    viewportWidth,
    viewportHeight,
    roomOriginX: roomOrigin.x,
    roomOriginY: roomOrigin.y,
    roomWidth: ROOM_WIDTH,
    roomHeight: ROOM_HEIGHT,
  };
}

export function getGameLayoutState(): GameLayoutState {
  return layoutState;
}

export function recalculateGameLayout(): GameLayoutState {
  const nextState = createLayoutState();
  const changed = JSON.stringify(layoutState) !== JSON.stringify(nextState);
  layoutState = nextState;

  if (changed) {
    listeners.forEach((listener) => listener(layoutState));
  }

  return layoutState;
}

export function subscribeToGameLayout(listener: LayoutListener): () => void {
  listeners.add(listener);
  listener(layoutState);
  return () => listeners.delete(listener);
}
