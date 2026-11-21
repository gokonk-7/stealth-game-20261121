// Line of sight, vision cones, light and shadow, and suspicion.
// One job: decide whether a watcher can see the thief, and how fast
// suspicion grows or fades. Guards and cameras both call these.
import {
  CONE_HALF_ANGLE,
  CAMERA_HALF_ANGLE,
  SUSPICION_MAX,
  SUSPICION_DECAY,
  SUSPICION_RISE_BASE,
  LIGHT_FACTOR,
  SHADOW_FACTOR,
  SNEAK_FACTOR,
  ALARM_SUSPICION_FACTOR,
} from './config.js';

// Does the segment (x1,y1)-(x2,y2) cross the rectangle? (Slab test.)
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

// True when nothing solid stands between watcher and thief. Walls and
// cover both block sight: hiding behind a display case is hiding.
export function hasLineOfSight(x1, y1, x2, y2, solids) {
  for (const s of solids) {
    if (segmentHitsRect(x1, y1, x2, y2, s)) return false;
  }
  return true;
}

// Is the thief inside the watcher's cone? Returns the distance, or -1.
export function coneDistance(wx, wy, dir, range, halfAngle, px, py) {
  const dx = px - wx;
  const dy = py - wy;
  const dist = Math.hypot(dx, dy);
  if (dist > range || dist < 1) return dist < 1 ? 0 : -1;
  let diff = Math.atan2(dy, dx) - dir;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return Math.abs(diff) <= halfAngle ? dist : -1;
}

// Light factor at a point: lamp and moon pools make you easier to spot,
// marked shadow makes you harder. Shadow wins where they overlap.
export function lightFactorAt(x, y, level) {
  for (const s of level.shadows) {
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return SHADOW_FACTOR;
  }
  for (const l of level.lights) {
    if (Math.hypot(x - l.x, y - l.y) <= l.r) return LIGHT_FACTOR;
  }
  return 1;
}

// How fast suspicion rises while the thief is seen, per second.
export function suspicionRiseRate(dist, range, player, level, alarm) {
  const closeness = 1 - (dist / range) * 0.6; // closer is worse
  let rate = SUSPICION_RISE_BASE * closeness;
  rate *= lightFactorAt(player.x, player.y, level);
  if (player.sneaking) rate *= SNEAK_FACTOR;
  if (alarm >= 1) rate *= ALARM_SUSPICION_FACTOR;
  return rate;
}

// Update one watcher's suspicion for a frame. Returns 'seen' or 'unseen'.
export function updateWatcherSuspicion(watcher, range, halfAngle, player, level, solids, alarm, dt) {
  const dist = coneDistance(watcher.x, watcher.y, watcher.dir, range, halfAngle, player.x, player.y);
  const seen = dist >= 0 && hasLineOfSight(watcher.x, watcher.y, player.x, player.y, solids);
  if (seen) {
    watcher.suspicion = Math.min(
      SUSPICION_MAX,
      watcher.suspicion + suspicionRiseRate(dist, range, player, level, alarm) * dt,
    );
  } else {
    watcher.suspicion = Math.max(0, watcher.suspicion - SUSPICION_DECAY * dt);
  }
  return seen ? 'seen' : 'unseen';
}

export function guardConeHalfAngle() {
  return CONE_HALF_ANGLE;
}

export function cameraConeHalfAngle() {
  return CAMERA_HALF_ANGLE;
}
