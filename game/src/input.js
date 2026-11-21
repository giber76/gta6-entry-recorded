// input.js — keyboard + mouse state for Solara Bay.
// Tracks held keys (for driving / walking / holding E) and edge presses
// (for entering cars, cycling radio, zooming the minimap).
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, consumed each frame
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      this.pressed.add(k);
      if (k === ' ' || k === 'arrowup' || k === 'arrowdown') e.preventDefault();
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.key.toLowerCase());
    };
    this._onMouseMove = (e) => {
      this.mouseX = e.movementX || 0;
      this.mouseY = e.movementY || 0;
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.pressed.add('click');
      }
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouseDown = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  held(key) {
    return this.keys.has(key);
  }

  // True once on the frame the key went down (edge). Call once per frame.
  wasPressed(key) {
    return this.pressed.has(key);
  }

  // End-of-frame housekeeping: clear edge presses and mouse deltas.
  endFrame() {
    this.pressed.clear();
    this.mouseX = 0;
    this.mouseY = 0;
  }
}
