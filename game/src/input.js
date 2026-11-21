// input.js — keyboard + mouse state. Keys are tracked by code (KeyW etc.)
// so layouts don't matter. Exposes one-frame edge flags for E / R / Z / X /
// Escape, and a held flag for E (the bank vault needs a hold).
export function initInput(G) {
  const input = {
    w: false, a: false, s: false, d: false,
    e: false, // held
    ePressed: false, // one-frame edge
    rPressed: false,
    zPressed: false,
    xPressed: false,
    escPressed: false,
    mouseDown: false,
  };
  G.input = input;
  const keyMap = {
    KeyW: 'w', ArrowUp: 'w',
    KeyA: 'a', ArrowLeft: 'a',
    KeyS: 's', ArrowDown: 's',
    KeyD: 'd', ArrowRight: 'd',
    KeyE: 'e',
  };
  window.addEventListener('keydown', (ev) => {
    const k = keyMap[ev.code];
    if (k) {
      if (k === 'e' && !input.e) input.ePressed = true;
      input[k] = true;
      ev.preventDefault();
      return;
    }
    if (ev.code === 'KeyR' && !ev.repeat) input.rPressed = true;
    if (ev.code === 'KeyZ' && !ev.repeat) input.zPressed = true;
    if (ev.code === 'KeyX' && !ev.repeat) input.xPressed = true;
    if (ev.code === 'Escape' && !ev.repeat) input.escPressed = true;
  });
  window.addEventListener('keyup', (ev) => {
    const k = keyMap[ev.code];
    if (k) input[k] = false;
  });
  const canvas = document.getElementById('game-canvas');
  if (canvas) {
    canvas.addEventListener('mousedown', (ev) => {
      if (ev.button === 0) input.mouseDown = true;
    });
    window.addEventListener('mouseup', (ev) => {
      if (ev.button === 0) input.mouseDown = false;
    });
  }
  // Clicking a menu button must not leak into the game.
  window.addEventListener('blur', () => {
    input.w = input.a = input.s = input.d = input.e = false;
    input.mouseDown = false;
  });
  return input;
}

// Clear the one-frame edge flags at the end of each game frame.
export function endFrameInput(G) {
  const input = G.input;
  input.ePressed = false;
  input.rPressed = false;
  input.zPressed = false;
  input.xPressed = false;
  input.escPressed = false;
}
