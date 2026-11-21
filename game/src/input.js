// Keyboard (WASD/arrows move, Shift sneak, P/Esc pause, M mute, R restart)
// plus mouse click-to-move. Menu buttons are keys too, so the whole game is
// playable with keyboard alone or with the mouse.
export function createInput(canvas, hooks) {
  const keys = new Set();
  let moveTarget = null;

  function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys.add(key);
    hooks.onKey(key);
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  });
  canvas.addEventListener('mousedown', (e) => {
    const p = canvasPos(e);
    moveTarget = p;
    hooks.onClick(p);
  });

  return {
    keys,
    get moveTarget() {
      return moveTarget;
    },
    clearMoveTarget() {
      moveTarget = null;
    },
    axis() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) x += 1;
      if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('s') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    get sneaking() {
      return keys.has('Shift');
    },
  };
}
