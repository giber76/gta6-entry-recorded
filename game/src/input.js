// input.js — keyboard + mouse state for Solara Bay.
// Tracks held keys and one-frame "just pressed" edges so a quick tap is
// never lost even when the renderer runs slowly under SwiftShader.

export function createInput(world, canvas) {
  const input = {
    keys: new Set(), // currently held e.code values
    pressed: new Set(), // codes pressed since the last frame (edges)
    mouseDown: false,
  };

  function onKeyDown(e) {
    // Ignore repeats: only the first keydown is an edge.
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
    // Keep the page from scrolling on game keys.
    if (
      e.code === 'Space' ||
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight' ||
      e.code === 'Tab'
    ) {
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    input.keys.delete(e.code);
  }

  function onBlur() {
    input.keys.clear();
  }

  function onMouseDown(e) {
    if (e.button === 0) {
      input.mouseDown = true;
      input.pressed.add('Mouse0');
    }
  }

  function onMouseUp(e) {
    if (e.button === 0) input.mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  // True while the key is held down.
  input.held = function (code) {
    return input.keys.has(code);
  };

  // True only on the frame the key went down. Consumed by the game loop.
  input.wasPressed = function (code) {
    return input.pressed.has(code);
  };

  // Call once per frame, after every system has read the edges.
  input.endFrame = function () {
    input.pressed.clear();
  };

  world.input = input;
  return input;
}
