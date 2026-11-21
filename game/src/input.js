// Keyboard and mouse input. One job: turn keys and clicks into a move
// vector, a sneak flag, and action keys. The game loop owns what they do.
export function createInput(canvas) {
  const keys = new Set();
  let moveTarget = null; // {x, y} in canvas coordinates, or null
  const pressed = new Set(); // keys pressed since the last poll

  function keyOf(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  function onKeyDown(e) {
    const k = keyOf(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (!e.repeat) pressed.add(k);
    keys.add(k);
  }

  function onKeyUp(e) {
    keys.delete(keyOf(e));
  }

  function onMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    moveTarget = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function onBlur() {
    keys.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    // Current move direction from WASD/arrows, or the click target.
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) x += 1;
      if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('s') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 || y !== 0) {
        moveTarget = null;
        const len = Math.hypot(x, y);
        return { x: x / len, y: y / len };
      }
      return null;
    },
    moveTarget() {
      return moveTarget;
    },
    clearMoveTarget() {
      moveTarget = null;
    },
    sneaking() {
      return keys.has('Shift');
    },
    // True once per physical press; the game loop polls and clears.
    wasPressed(k) {
      return pressed.has(k.toLowerCase());
    },
    consumePressed() {
      pressed.clear();
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousedown', onMouseDown);
    },
  };
}
