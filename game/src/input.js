// Keyboard and mouse input for an open world: held keys drive movement, steering and firing,
// one-shot presses (confirm, pause, enter/exit a car, mute) are queued as bit flags and taken
// once by the loop, and the pointer position feeds the renderer's world-space aim.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_MUTE = 8;
export const ACTION_FIRE = 16;

const MOVE_NEG_X = ['KeyA', 'ArrowLeft'];
const MOVE_POS_X = ['KeyD', 'ArrowRight'];
const MOVE_NEG_Y = ['KeyW', 'ArrowUp'];
const MOVE_POS_Y = ['KeyS', 'ArrowDown'];

export function createInput(target) {
  const keys = new Set();
  let actions = 0;
  let mouseX = -1000;
  let mouseY = -1000;
  let mouseDown = false;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    if (!event.repeat) {
      if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
      else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
      else if (event.code === 'KeyE') actions |= ACTION_ENTER;
      else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    }
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  target.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });
  target.addEventListener('pointerdown', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (event.button === 0) {
      mouseDown = true;
      actions |= ACTION_CONFIRM;
      // Even a click shorter than one frame must fire once.
      actions |= ACTION_FIRE;
    }
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  target.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    pressed(code) {
      return keys.has(code);
    },
    /** -1, 0 or 1 from the held keys in the two lists. */
    axis(negative, positive) {
      let value = 0;
      for (const code of negative) if (keys.has(code)) value -= 1;
      for (const code of positive) if (keys.has(code)) value += 1;
      return Math.sign(value);
    },
    moveX() {
      return this.axis(MOVE_NEG_X, MOVE_POS_X);
    },
    moveY() {
      return this.axis(MOVE_NEG_Y, MOVE_POS_Y);
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    get mouseX() {
      return mouseX;
    },
    get mouseY() {
      return mouseY;
    },
    get mouseDown() {
      return mouseDown;
    },
  };
}
