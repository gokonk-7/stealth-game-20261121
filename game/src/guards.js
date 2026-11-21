// Guard and camera AI.
// Guards walk patrol waypoints, stop and stare when they grow suspicious,
// chase the last seen position when they spot the thief, and walk back to
// their patrol when they lose the trail. Cameras never chase: their cone
// sweeps from a fixed pivot, and being spotted by one raises the alarm.
import { angleDiff, dist, circleHitsBlocker } from './detection.js';
import { GUARD_CHASE } from './config.js';

export function makeGuard(def) {
  const [sx, sy] = def.path[0];
  return {
    kind: 'guard',
    x: sx,
    y: sy,
    angle: 0,
    path: def.path,
    wp: 1,
    speed: def.speed,
    range: def.range,
    half: def.half,
    suspicion: 0,
    state: 'patrol',
    lastSeen: null,
    unseenTimer: 0,
    stepTimer: 0,
    active: def.active !== false,
    home: { x: sx, y: sy },
  };
}

export function makeCamera(def) {
  return {
    kind: 'camera',
    x: def.x,
    y: def.y,
    angle: def.base,
    base: def.base,
    sweep: def.sweep,
    sweepSpeed: def.speed,
    range: def.range,
    half: def.half,
    suspicion: 0,
    lastSeen: null,
    unseenTimer: 0,
    disabledUntil: 0,
    active: true,
  };
}

// Walk toward a point, sliding along walls (axis-separated movement).
// Returns true when the target is reached.
function moveToward(g, tx, ty, speed, dt, blockers) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const step = Math.min(d, speed * dt);
  const nx = g.x + (dx / d) * step;
  const ny = g.y + (dy / d) * step;
  g.angle = Math.atan2(dy, dx);
  if (!circleHitsBlocker(nx, g.y, 12, blockers)) g.x = nx;
  if (!circleHitsBlocker(g.x, ny, 12, blockers)) g.y = ny;
  return d <= step + 1;
}

function stepSound(g, dt, ctx) {
  g.stepTimer -= dt;
  if (g.stepTimer <= 0) {
    g.stepTimer = 30 / (g.speed || 80);
    const d = dist(g.x, g.y, ctx.thief.x, ctx.thief.y);
    if (d < 520 && ctx.onStep) ctx.onStep(g, d);
  }
}

export function updateGuard(g, dt, ctx) {
  if (!g.active) return;
  const speedMul = ctx.alarm === 0 ? 1 : ctx.alarm === 1 ? 1.15 : 1.3;

  if (g.state === 'chase') {
    const target = g.lastSeen || g.home;
    const arrived = moveToward(g, target.x, target.y, GUARD_CHASE * speedMul, dt, ctx.blockers);
    stepSound(g, dt, ctx);
    if (arrived && g.unseenTimer > 3) g.state = 'return';
    return;
  }

  if (g.state === 'suspicious') {
    // Freeze and stare at the last seen spot while suspicion is high.
    if (g.lastSeen) g.angle = Math.atan2(g.lastSeen.y - g.y, g.lastSeen.x - g.x);
    if (g.suspicion < 30) g.state = 'patrol';
    return;
  }

  if (g.state === 'return') {
    // Walk back to the nearest waypoint, then resume the patrol.
    let best = 0;
    let bd = Infinity;
    g.path.forEach((p, i) => {
      const d = dist(g.x, g.y, p[0], p[1]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    const arrived = moveToward(g, g.path[best][0], g.path[best][1], g.speed * speedMul, dt, ctx.blockers);
    stepSound(g, dt, ctx);
    if (arrived) {
      g.wp = (best + 1) % g.path.length;
      g.state = 'patrol';
    }
    return;
  }

  // Patrol: walk the waypoints in order, forever.
  const wp = g.path[g.wp];
  const arrived = moveToward(g, wp[0], wp[1], g.speed * speedMul, dt, ctx.blockers);
  stepSound(g, dt, ctx);
  if (arrived) g.wp = (g.wp + 1) % g.path.length;
}

export function updateCamera(c, dt, ctx) {
  if (!c.active) return;
  if (ctx.now < c.disabledUntil) return; // powered down: cone parked, no sweep
  c.angle = c.base + Math.sin(ctx.now * c.sweepSpeed) * c.sweep;
}
