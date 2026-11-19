// input.js — keyboard and mouse for Solara Bay.
//
// WASD move and drive, mouse drag to look around, SPACE handbrake, E to
// enter a car, R cycles the radio, Z/X zoom the minimap, Q swaps weapon.
// interact, Q to switch weapon, R to cycle the radio, Z/X to zoom the
// minimap, SHIFT to sprint, P or ESC to pause, M for the mission list.
// The pistol never needs reloading, so there is no reload key. Keys live
// in a Set on the game object; the game reads them each frame through
// moveInput() and sprinting().

const HANDLED_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'KeyM', 'KeyP',
  'KeyR', 'KeyZ', 'KeyX',
  'Space', 'ShiftLeft', 'ShiftRight', 'Escape', 'Enter',
]);

// Which game callback fires for a single key press.
const PRESS_ACTIONS = {
  Enter: 'onEnter',
  KeyP: 'onPauseKey',
  Escape: 'onPauseKey',
  KeyM: 'onMissionKey',
  KeyQ: 'onWeaponKey',
  KeyR: 'onRadioKey',
  KeyZ: 'onZoomIn',
  KeyX: 'onZoomOut',
};

export function initInput(G) {
  G.keys = new Set();
  G.lookDX = 0;
  G.lookDY = 0;
  G.mouseDown = false;

  function onKeyDown(ev) {
    if (HANDLED_KEYS.has(ev.code)) ev.preventDefault();
    if (ev.repeat) return;
    G.keys.add(ev.code);
    const hook = PRESS_ACTIONS[ev.code];
    if (hook && G[hook]) G[hook]();
  }

  function onKeyUp(ev) {
    G.keys.delete(ev.code);
  }

  function onBlur() {
    G.keys.clear();
  }

  function onMouseDown(ev) {
    G.mouseDown = true;
    G.lastMouseX = ev.clientX;
    G.lastMouseY = ev.clientY;
    if (G.audio) G.audio.unlock();
  }

  function onMouseUp() {
    G.mouseDown = false;
  }

  function onMouseMove(ev) {
    if (!G.mouseDown) return;
    G.lookDX += ev.clientX - (G.lastMouseX ?? ev.clientX);
    G.lookDY += ev.clientY - (G.lastMouseY ?? ev.clientY);
    G.lastMouseX = ev.clientX;
    G.lastMouseY = ev.clientY;
  }

  function onClick() {
    if (G.audio) G.audio.unlock();
    if (G.onClick) G.onClick();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  const canvas = G.renderer.domElement;
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('click', onClick);

  // Movement as a 2D vector in camera space: x = strafe right, y = forward.
  G.moveInput = function moveInput() {
    let x = 0;
    let y = 0;
    if (G.keys.has('KeyW')) y += 1;
    if (G.keys.has('KeyS')) y -= 1;
    if (G.keys.has('KeyA')) x -= 1;
    if (G.keys.has('KeyD')) x += 1;
    const len = Math.hypot(x, y);
    if (len > 0) {
      x /= len;
      y /= len;
    }
    return { x, y };
  };

  G.sprinting = function sprinting() {
    return G.keys.has('ShiftLeft') || G.keys.has('ShiftRight');
  };
}
