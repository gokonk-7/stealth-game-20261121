// Line of sight, vision cones, light and suspicion — the heart of the stealth.
// A detector (guard or camera) sees the thief only inside its cone AND with a
// clear line of sight: walls and tall cover block sight, so cover is real cover.
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

// Liang–Barsky: true when the segment touches the rect (edges count).
export function segHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

export function hasLOS(x1, y1, x2, y2, blockers) {
  for (const b of blockers) {
    if (segHitsRect(x1, y1, x2, y2, b)) return false;
  }
  return true;
}

export function inCone(det, tx, ty) {
  const d = dist(det.x, det.y, tx, ty);
  if (d > det.range) return false;
  const toThief = Math.atan2(ty - det.y, tx - det.x);
  return Math.abs(angleDiff(toThief, det.angle)) <= det.half;
}

// Light at a floor point: 1.5 in a light pool, 0.6 in a shadow zone, 1.0 elsewhere.
export function lightFactor(x, y, level) {
  for (const s of level.shadows || []) {
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return 0.6;
  }
  for (const l of level.lights || []) {
    if (dist(x, y, l.x, l.y) <= l.r) return 1.5;
  }
  return 1;
}

// One sensing step for a guard or a camera. Mutates det.suspicion, det.lastSeen
// and det.unseenTimer. Returns { seen, spotted }: spotted is true only on the
// frame suspicion crosses 100. A powered-down camera (disabledUntil in the
// future) senses nothing.
export function sense(det, thief, level, blockers, alarm, dt, now) {
  if (det.disabledUntil && now < det.disabledUntil) {
    return { seen: false, spotted: false };
  }
  const seen = inCone(det, thief.x, thief.y) && hasLOS(det.x, det.y, thief.x, thief.y, blockers);
  if (seen) {
    const d = dist(det.x, det.y, thief.x, thief.y);
    const proximity = 1 - (d / det.range) * 0.55;
    const light = lightFactor(thief.x, thief.y, level);
    const sneak = thief.sneaking ? 0.6 : 1;
    const alarmMul = alarm === 0 ? 1 : alarm === 1 ? 1.2 : 1.35;
    const before = det.suspicion;
    det.suspicion = Math.min(
      100,
      det.suspicion + 55 * Math.max(0.25, proximity) * light * sneak * alarmMul * dt,
    );
    det.lastSeen = { x: thief.x, y: thief.y };
    det.unseenTimer = 0;
    return { seen: true, spotted: before < 100 && det.suspicion >= 100 };
  }
  det.suspicion = Math.max(0, det.suspicion - 12 * dt);
  det.unseenTimer = (det.unseenTimer || 0) + dt;
  return { seen: false, spotted: false };
}

// Circle-vs-rect test for movement collision.
export function circleHitsBlocker(x, y, r, blockers) {
  for (const b of blockers) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
  }
  return false;
}
