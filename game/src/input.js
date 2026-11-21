// input.js — keyboard and mouse state for Solara Bay.
// Tracks held keys, per-frame "pressed" edges, and mouse clicks (the pistol).
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.clickQueued = false;
    this.mouseDX = 0;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedKeys.add(e.code);
      if (e.code === 'Escape' || e.code === 'Space') e.preventDefault();
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) this.clickQueued = true;
    };
    this._onMouseMove = (e) => {
      this.mouseDX += e.movementX || 0;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
  }

  down(code) {
    return this.keys.has(code);
  }

  // True once, on the frame the key went down.
  pressed(code) {
    return this.pressedKeys.has(code);
  }

  takeClick() {
    const c = this.clickQueued;
    this.clickQueued = false;
    return c;
  }

  takeMouseDX() {
    const dx = this.mouseDX;
    this.mouseDX = 0;
    return dx;
  }

  // Call once per frame, after the game has read the edges.
  endFrame() {
    this.pressedKeys.clear();
  }
}
