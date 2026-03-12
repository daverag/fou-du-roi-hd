import Phaser from 'phaser';

let patched = false;

export function patchPhaserGamepadShutdown(): void {
  if (patched) {
    return;
  }

  const pluginPrototype = Phaser.Input.Gamepad.GamepadPlugin?.prototype as
    | {
        stopListeners?: () => void;
        __fouStopListenersPatched?: boolean;
      }
    | undefined;

  if (!pluginPrototype || pluginPrototype.__fouStopListenersPatched) {
    patched = true;
    return;
  }

  pluginPrototype.stopListeners = function stopListenersPatched(this: {
    target?: EventTarget;
    onGamepadHandler?: EventListenerOrEventListenerObject;
    sceneInputPlugin?: { pluginEvents?: { off: (event: string, fn: Function) => void } };
    update?: Function;
    gamepads: Array<{ removeAllListeners?: () => void } | undefined>;
  }): void {
    this.target?.removeEventListener('gamepadconnected', this.onGamepadHandler ?? null);
    this.target?.removeEventListener('gamepaddisconnected', this.onGamepadHandler ?? null);
    this.sceneInputPlugin?.pluginEvents?.off('update', this.update as Function);

    for (let index = 0; index < this.gamepads.length; index += 1) {
      this.gamepads[index]?.removeAllListeners?.();
    }
  };

  pluginPrototype.__fouStopListenersPatched = true;
  patched = true;
  console.info('[gamepad] patched Phaser GamepadPlugin.stopListeners for sparse pad indexes');
}
