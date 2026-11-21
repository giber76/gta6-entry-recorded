// input.js — keyboard + mouse state for Solara Bay.
// Keys are tracked by `code` so layout does not matter. Mouse drag orbits
// the camera (no pointer lock, so Escape stays free for pause).
export class Input {
  constructor(canvas, onKey) {
    this.keys = new Set();
    this.onKey = onKey || (() => {});
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.eHeld = false;
    this.eHoldTime = 0; // game-seconds E has been held continuously
    this.canvas = canvas;
    window.addEventListener('keydown', (ev) => {
      if (ev.repeat) {
        if (ev.code === 'KeyE') this.eHeld = true;
        return;
      }
      this.keys.add(ev.code);
      if (ev.code === 'KeyE') this.eHeld = true;
      this.onKey(ev.code, true);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) {
        ev.preventDefault();
      }
    });
    window.addEventListener('keyup', (ev) => {
      this.keys.delete(ev.code);
      if (ev.code === 'KeyE') {
        this.eHeld = false;
        this.eHoldTime = 0;
      }
      this.onKey(ev.code, false);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.eHeld = false;
      this.eHoldTime = 0;
    });
    canvas.addEventListener('pointerdown', (ev) => {
      this.dragging = true;
      this.lastX = ev.clientX;
      this.lastY = ev.clientY;
      canvas.setPointerCapture(ev.pointerId);
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (!this.dragging) return;
      this.mouseDX += ev.clientX - this.lastX;
      this.mouseDY += ev.clientY - this.lastY;
      this.lastX = ev.clientX;
      this.lastY = ev.clientY;
    });
    const endDrag = () => {
      this.dragging = false;
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
  }

  down(code) {
    return this.keys.has(code);
  }

  // Arcade drive input from WASD/arrows.
  drive() {
    return {
      forward: this.down('KeyW') || this.down('ArrowUp'),
      back: this.down('KeyS') || this.down('ArrowDown'),
      left: this.down('KeyA') || this.down('ArrowLeft'),
      right: this.down('KeyD') || this.down('ArrowRight'),
    };
  }

  walk() {
    return {
      forward: this.down('KeyW') || this.down('ArrowUp'),
      back: this.down('KeyS') || this.down('ArrowDown'),
      left: this.down('KeyA') || this.down('ArrowLeft'),
      right: this.down('KeyD') || this.down('ArrowRight'),
    };
  }

  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  update(dt) {
    if (this.eHeld) this.eHoldTime += dt;
  }
}
