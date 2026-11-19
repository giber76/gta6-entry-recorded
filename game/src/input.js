// input.js — keyboard and mouse for Solara Bay.
//
// WASD move and drive, mouse drag to look around, SPACE handbrake, E to
// enter a car, R cycles the radio, Z/X zoom the minimap, Q swaps weapon,
// M for the mission list, SHIFT to sprint, P or ESC to pause, ENTER to
// advance dialogue. The pistol never needs reloading, so there is no
// reload key. Keys live in a Set on the game object; the game reads them
// each frame through moveInput() and sprinting().

const HANDLED_CODES = [
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'KeyM', 'KeyP',
  'KeyR', 'KeyZ', 'KeyX',
  'Space', 'ShiftLeft', 'ShiftRight', 'Escape', 'Enter',
];
const HANDLED_KEYS = new Set(HANDLED_CODES);

// Which game callback fires for a single key press.
const PRESS_ROWS = [
  ['Enter', 'onEnter'],
  ['KeyP', 'onPauseKey'],
  ['Escape', 'onPauseKey'],
  ['KeyM', 'onMissionKey'],
  ['KeyQ', 'onWeaponKey'],
  ['KeyR', 'onRadioKey'],
  ['KeyZ', 'onZoomIn'],
  ['KeyX', 'onZoomOut'],
];
const PRESS_ACTIONS = Object.fromEntries(PRESS_ROWS);

// Movement keys: [code, dx, dy] in camera space (x = strafe right, y = forward).
const MOVE_KEYS = [
  ['KeyW', 0, 1],
  ['KeyS', 0, -1],
  ['KeyA', -1, 0],
  ['KeyD', 1, 0],
];

export function initInput(game) {
  game.keys = new Set();
  game.lookDX = 0;
  game.lookDY = 0;
  game.mouseDown = false;

  function onKeyDown(ev) {
    if (HANDLED_KEYS.has(ev.code)) ev.preventDefault();
    if (ev.repeat) return;
    game.keys.add(ev.code);
    const hook = PRESS_ACTIONS[ev.code];
    if (hook && game[hook]) game[hook]();
  }

  function onKeyUp(ev) {
    game.keys.delete(ev.code);
  }

  function onBlur() {
    game.keys.clear();
  }

  function onMouseDown(ev) {
    game.mouseDown = true;
    game.lastMouseX = ev.clientX;
    game.lastMouseY = ev.clientY;
    if (game.audio) game.audio.unlock();
  }

  function onMouseUp() {
    game.mouseDown = false;
  }

  function onMouseMove(ev) {
    if (!game.mouseDown) return;
    game.lookDX += ev.clientX - (game.lastMouseX ?? ev.clientX);
    game.lookDY += ev.clientY - (game.lastMouseY ?? ev.clientY);
    game.lastMouseX = ev.clientX;
    game.lastMouseY = ev.clientY;
  }

  function onClick() {
    if (game.audio) game.audio.unlock();
    if (game.onClick) game.onClick();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  const canvas = game.renderer.domElement;
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('click', onClick);

  // Movement as a 2D vector in camera space: x = strafe right, y = forward.
  game.moveInput = function moveInput() {
    let x = 0;
    let y = 0;
    for (const [code, dx, dy] of MOVE_KEYS) {
      if (game.keys.has(code)) {
        x += dx;
        y += dy;
      }
    }
    const len = Math.hypot(x, y);
    if (len > 0) {
      x /= len;
      y /= len;
    }
    return { x, y };
  };

  game.sprinting = function sprinting() {
    return game.keys.has('ShiftLeft') || game.keys.has('ShiftRight');
  };
}
