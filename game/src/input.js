// input.js — keyboard + mouse for Solara Bay.
// WASD move/drive, mouse drag to look, SPACE handbrake, E interact, Q weapon,
// SHIFT sprint, P/ESC pause, M mission list, R reload is not needed (infinite ammo).

export function initInput(G) {
  G.keys = new Set();
  G.lookDX = 0;
  G.lookDY = 0;
  G.mouseDown = false;

  const GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'KeyM', 'KeyP',
    'Space', 'ShiftLeft', 'ShiftRight', 'Escape', 'Enter',
  ]);

  window.addEventListener('keydown', (ev) => {
    if (GAME_KEYS.has(ev.code)) ev.preventDefault();
    if (ev.repeat) return;
    G.keys.add(ev.code);
    if (ev.code === 'Enter' && G.onEnter) G.onEnter();
    if ((ev.code === 'KeyP' || ev.code === 'Escape') && G.onPauseKey) G.onPauseKey();
    if (ev.code === 'KeyM' && G.onMissionKey) G.onMissionKey();
    if (ev.code === 'KeyQ' && G.onWeaponKey) G.onWeaponKey();
  });
  window.addEventListener('keyup', (ev) => {
    G.keys.delete(ev.code);
  });
  window.addEventListener('blur', () => {
    G.keys.clear();
  });

  const canvas = G.renderer.domElement;
  canvas.addEventListener('mousedown', (ev) => {
    G.mouseDown = true;
    G.lastMouseX = ev.clientX;
    G.lastMouseY = ev.clientY;
    if (G.audio) G.audio.unlock();
  });
  window.addEventListener('mouseup', () => {
    G.mouseDown = false;
  });
  window.addEventListener('mousemove', (ev) => {
    if (!G.mouseDown) return;
    G.lookDX += ev.clientX - (G.lastMouseX ?? ev.clientX);
    G.lookDY += ev.clientY - (G.lastMouseY ?? ev.clientY);
    G.lastMouseX = ev.clientX;
    G.lastMouseY = ev.clientY;
  });
  canvas.addEventListener('click', () => {
    if (G.audio) G.audio.unlock();
    if (G.onClick) G.onClick();
  });

  // Movement input as a 2D vector in camera space: x = strafe right, y = forward.
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
