type GamepadState = {
  activeKey: string | null;
  connectedKeys: string;
};

const state: GamepadState = {
  activeKey: null,
  connectedKeys: '',
};

export function logGamepadStatus(
  pads: Array<{ id: string; index: number; connected: boolean }>,
  activePad: { id: string; index: number } | null,
): void {
  const connectedPads = pads.filter((pad) => pad.connected);
  const connectedKeys = connectedPads.map((pad) => `${pad.index}:${pad.id}`).join(' | ');

  if (connectedKeys !== state.connectedKeys) {
    state.connectedKeys = connectedKeys;
    console.info('[gamepad] connected pads', connectedPads.map((pad) => ({ index: pad.index, id: pad.id })));
  }

  const activeKey = activePad ? `${activePad.index}:${activePad.id}` : null;

  if (activeKey !== state.activeKey) {
    state.activeKey = activeKey;
    console.info('[gamepad] active pad', activePad ? { index: activePad.index, id: activePad.id } : null);
  }
}
