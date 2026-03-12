import Phaser from 'phaser';
import { logGamepadStatus } from './gamepadDebug';

export function getActiveGamepad(input: Phaser.Input.InputPlugin): Phaser.Input.Gamepad.Gamepad | null {
  const plugin = input.gamepad;

  if (!plugin) {
    return null;
  }

  const pads = plugin.getAll();
  const connectedPad = pads.find((pad) => pad.connected) ?? null;

  logGamepadStatus(pads, connectedPad);

  return connectedPad ?? null;
}
