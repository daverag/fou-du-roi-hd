import Phaser from 'phaser';

export function getActiveGamepad(input: Phaser.Input.InputPlugin): Phaser.Input.Gamepad.Gamepad | null {
  const plugin = input.gamepad;

  if (!plugin) {
    return null;
  }

  const connectedPad = plugin.getAll().find((pad) => pad.connected);

  return connectedPad ?? null;
}
