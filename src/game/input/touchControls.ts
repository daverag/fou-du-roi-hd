import type { Direction } from '../types';

type TouchControlsState = {
  direction: Direction | null;
};

const state: TouchControlsState = {
  direction: null,
};

const DIRECTION_LABELS: Record<Direction, string> = {
  up: '▲',
  down: '▼',
  left: '◀',
  right: '▶',
};

let rootElement: HTMLDivElement | null = null;
let activeButton: HTMLElement | null = null;
let activePointerId: number | null = null;

export function mountTouchControls(parent: HTMLElement): void {
  if (rootElement) {
    return;
  }

  rootElement = document.createElement('div');
  rootElement.className = 'touch-controls';
  rootElement.setAttribute('aria-label', 'Controle directionnel tactile');

  (['up', 'left', 'right', 'down'] as Direction[]).forEach((direction) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `touch-controls__button touch-controls__button--${direction}`;
    button.dataset.direction = direction;
    button.setAttribute('aria-label', direction);
    button.textContent = DIRECTION_LABELS[direction];
    rootElement?.append(button);
  });

  const setDirection = (button: HTMLElement | null) => {
    activeButton?.classList.remove('is-active');
    activeButton = button;
    if (!button) {
      state.direction = null;
      return;
    }

    button.classList.add('is-active');
    state.direction = button.dataset.direction as Direction;
  };

  rootElement.addEventListener('pointerdown', (event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-direction]');
    if (!target) {
      return;
    }

    event.preventDefault();
    activePointerId = event.pointerId;
    rootElement?.setPointerCapture(event.pointerId);
    setDirection(target);
  });

  rootElement.addEventListener('pointermove', (event) => {
    if (activePointerId !== event.pointerId) {
      return;
    }

    const hovered = document.elementFromPoint(event.clientX, event.clientY);
    const target = hovered instanceof HTMLElement ? hovered.closest<HTMLElement>('[data-direction]') : null;
    setDirection(target);
  });

  const releasePointer = (event: PointerEvent) => {
    if (activePointerId !== event.pointerId) {
      return;
    }

    if (rootElement?.hasPointerCapture(event.pointerId)) {
      rootElement.releasePointerCapture(event.pointerId);
    }
    activePointerId = null;
    setDirection(null);
  };

  rootElement.addEventListener('pointerup', releasePointer);
  rootElement.addEventListener('pointercancel', releasePointer);
  rootElement.addEventListener('lostpointercapture', releasePointer);
  parent.append(rootElement);
}

export function getTouchDirection(): Direction | null {
  return state.direction;
}
