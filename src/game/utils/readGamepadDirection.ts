import type Phaser from 'phaser';
import type { Direction } from '../types';

export type GamepadDirectionState = {
  direction: Direction | null;
  horizontal: number;
  vertical: number;
  dpad: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  };
};

type NativeGamepadLike = {
  axes?: readonly number[];
  buttons?: ReadonlyArray<{ pressed?: boolean; value?: number }>;
};

const DPAD_UP_INDEX = 12;
const DPAD_DOWN_INDEX = 13;
const DPAD_LEFT_INDEX = 14;
const DPAD_RIGHT_INDEX = 15;

export function readGamepadDirection(
  pad: Phaser.Input.Gamepad.Gamepad,
  threshold: number,
): GamepadDirectionState {
  const nativePad = getNativeGamepad(pad);
  const dpad = {
    left: Boolean(pad.left) || isNativeButtonPressed(nativePad, DPAD_LEFT_INDEX),
    right: Boolean(pad.right) || isNativeButtonPressed(nativePad, DPAD_RIGHT_INDEX),
    up: Boolean(pad.up) || isNativeButtonPressed(nativePad, DPAD_UP_INDEX),
    down: Boolean(pad.down) || isNativeButtonPressed(nativePad, DPAD_DOWN_INDEX),
  };

  if (dpad.left) {
    return { direction: 'left', horizontal: -1, vertical: 0, dpad };
  }
  if (dpad.right) {
    return { direction: 'right', horizontal: 1, vertical: 0, dpad };
  }
  if (dpad.up) {
    return { direction: 'up', horizontal: 0, vertical: -1, dpad };
  }
  if (dpad.down) {
    return { direction: 'down', horizontal: 0, vertical: 1, dpad };
  }

  const horizontal = getAxisValue(nativePad, 0, pad.leftStick?.x ?? 0);
  const vertical = getAxisValue(nativePad, 1, pad.leftStick?.y ?? 0);

  if (Math.abs(horizontal) >= Math.abs(vertical) && Math.abs(horizontal) >= threshold) {
    return {
      direction: horizontal < 0 ? 'left' : 'right',
      horizontal,
      vertical,
      dpad,
    };
  }

  if (Math.abs(vertical) >= threshold) {
    return {
      direction: vertical < 0 ? 'up' : 'down',
      horizontal,
      vertical,
      dpad,
    };
  }

  return {
    direction: null,
    horizontal,
    vertical,
    dpad,
  };
}

function getNativeGamepad(pad: Phaser.Input.Gamepad.Gamepad): NativeGamepadLike | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return null;
  }

  const nativePads = navigator.getGamepads();
  return nativePads[pad.index] ?? null;
}

function isNativeButtonPressed(nativePad: NativeGamepadLike | null, index: number): boolean {
  const button = nativePad?.buttons?.[index];
  return Boolean(button?.pressed || (typeof button?.value === 'number' && button.value >= 0.5));
}

function getAxisValue(nativePad: NativeGamepadLike | null, index: number, fallback: number): number {
  const value = nativePad?.axes?.[index];
  return typeof value === 'number' ? value : fallback;
}
