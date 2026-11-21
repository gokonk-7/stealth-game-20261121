// Guard patrols and chases, camera sweeps, and the control panel.
// One job: move the watchers and decide what they do next. Detection
// itself (cones, line of sight, suspicion) lives in detection.js.
import {
  GUARD_CHASE_SPEED,
  GUARD_CATCH_DISTANCE,
  CHASE_GIVE_UP_SECONDS,
  PANEL_HOLD_SECONDS,
  PANEL_DISABLE_SECONDS,
  CAMERA_ALERT_COOLDOWN,
  SUSPICION_MAX,
  SUSPICION_QUESTION,
  ALARM_SPEED_FACTOR,
  ALARM_CONE_FACTOR,
  CONE_RANGE,
  CAMERA_RANGE,
} from './config.js';
import { hasLineOfSight, updateWatcherSuspicion, guardConeHalfAngle, cameraConeHalfAngle } from './detection.js';

export function makeGuard(def, index) {
  const [sx, sy] = def.waypoints[0];
  return {
    kind: 'guard',
    index,
    x: sx,
    y: sy,
    dir: 0,
    waypoints: def.waypoints.map(([x, y]) => ({ x, y })),
    wpIndex: 1 % def.waypoints.length,
    baseSpeed: def.speed,
    suspicion: 0,
    mode: 'patrol', // patrol | chase | return | search
    lastSeen: { x: sx, y: sy },
    loseTimer: 0,
    stepTimer: 0,
    stepPhase: index * 0.37,
    exitDuty: false, // alarm stage 2: this guard patrols the exit instead
  };
}

export function makeCamera(def) {
  return {
    kind: 'camera',
    x: def.x,
    y: def.y,
    baseDir: def.baseDir,
    sweep: def.sweep,
    range: def.range || CAMERA_RANGE,
    speed: def.speed || 0.6,
    phase: Math.random() * Math.PI * 2,
    dir: def.baseDir,
    suspicion: 0,
    disabledUntil: 0,
    cooldownUntil: 0,
    tripped: false,
  };
}

function moveToward(e, tx, ty, speed, dt, solids, radius) {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return true;
  const step = Math.min(dist, speed * dt);
  const nx = e.x + (dx / dist) * step;
  const ny = e.y + (dy / dist) * step;
  e.dir = Math.atan2(dy, dx);
  if (!hitsSolid(nx, e.y, radius, solids)) e.x = nx;
  if (!hitsSolid(e.x, ny, radius, solids)) e.y = ny;
  return dist <= step + 0.5;
}

function hitsSolid(x, y, radius, solids) {
  for (const s of solids) {
    const cx = Math.max(s.x, Math.min(x, s.x + s.w));
    const cy = Math.max(s.y, Math.min(y, s.y + s.h));
    if ((x - cx) ** 2 + (y - cy) ** 2 < radius * radius) return true;
  }
  return false;
}

// One guard, one frame. Returns an event string the game loop acts on:
// 'spotted' when suspicion first hits 100, 'caught' when the guard
// touches the thief, 'question' when suspicion first crosses 50.
export function updateGuard(g, dt, ctx) {
  const { player, level, solids, alarm, time, audio } = ctx;
  const speed = g.baseSpeed * (alarm >= 1 ? ALARM_SPEED_FACTOR : 1);
  const range = CONE_RANGE * (alarm >= 1 ? ALARM_CONE_FACTOR : 1);
  const events = [];

  const wasQuestion = g.suspicion >= SUSPICION_QUESTION;
  const seen = updateWatcherSuspicion(g, range, guardConeHalfAngle(), player, level, solids, alarm, dt);
  if (!wasQuestion && g.suspicion >= SUSPICION_QUESTION && g.suspicion < SUSPICION_MAX) {
    events.push('question');
  }

  if (g.suspicion >= SUSPICION_MAX && g.mode !== 'chase') {
    g.mode = 'chase';
    g.loseTimer = 0;
    events.push('spotted');
  }
  if (seen === 'seen') {
    g.lastSeen = { x: player.x, y: player.y };
    g.loseTimer = 0;
  }

  if (g.mode === 'patrol') {
    const target = g.waypoints[g.wpIndex];
    if (moveToward(g, target.x, target.y, speed, dt, solids, 13)) {
      g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
    }
  } else if (g.mode === 'chase') {
    if (seen === 'seen') {
      moveToward(g, player.x, player.y, GUARD_CHASE_SPEED, dt, solids, 13);
    } else {
      g.loseTimer += dt;
      if (g.loseTimer >= CHASE_GIVE_UP_SECONDS) {
        g.mode = 'return';
      } else {
        moveToward(g, g.lastSeen.x, g.lastSeen.y, GUARD_CHASE_SPEED, dt, solids, 13);
      }
    }
  } else if (g.mode === 'return') {
    // Walk back to the nearest patrol waypoint, then resume the patrol.
    let best = 0;
    let bestDist = Infinity;
    g.waypoints.forEach((w, i) => {
      const d = Math.hypot(w.x - g.x, w.y - g.y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    g.wpIndex = best;
    const target = g.waypoints[g.wpIndex];
    if (moveToward(g, target.x, target.y, speed, dt, solids, 13)) {
      g.mode = 'patrol';
      g.suspicion = 0;
    }
  } else if (g.mode === 'search') {
    // Alarm stage 2: converge on the last-known position, then hold there.
    moveToward(g, g.lastSeen.x, g.lastSeen.y, speed, dt, solids, 13);
  }

  // A guard that touches the thief catches them, patrol or chase alike.
  if (Math.hypot(player.x - g.x, player.y - g.y) <= GUARD_CATCH_DISTANCE) {
    events.push('caught');
  }

  // Footsteps: a soft thud each stride, panned by direction from the thief.
  g.stepTimer -= dt;
  const stride = (g.mode === 'chase' ? 0.34 : 0.52) * (g.baseSpeed / speed);
  if (g.stepTimer <= 0 && (g.mode !== 'patrol' || Math.hypot(g.x - g.waypoints[g.wpIndex].x, g.y - g.waypoints[g.wpIndex].y) > 1)) {
    g.stepTimer = stride;
    if (audio) audio.guardStep(g.x, g.y, player.x, player.y);
  }
  return events;
}

// One camera, one frame. Cameras never chase: at full suspicion they trip
// the alarm (once per cooldown) and reset. Returns 'tripped' or null.
export function updateCamera(c, dt, ctx) {
  const { player, level, solids, alarm, time } = ctx;
  if (time < c.disabledUntil) {
    c.suspicion = Math.max(0, c.suspicion - 20 * dt);
    return null;
  }
  c.phase += dt * c.speed;
  c.dir = c.baseDir + Math.sin(c.phase) * c.sweep;
  const wasQuestion = c.suspicion >= SUSPICION_QUESTION;
  updateWatcherSuspicion(c, c.range, cameraConeHalfAngle(), player, level, solids, alarm, dt);
  if (!wasQuestion && c.suspicion >= SUSPICION_QUESTION && c.suspicion < SUSPICION_MAX) {
    return 'question';
  }
  if (c.suspicion >= SUSPICION_MAX && time >= c.cooldownUntil) {
    c.suspicion = 0;
    c.cooldownUntil = time + CAMERA_ALERT_COOLDOWN;
    return 'tripped';
  }
  return null;
}

// The control panel: stand next to it and it charges; hold still long
// enough and the nearest live camera goes dark for a while. Standing in
// the open is the risk. Returns the camera disabled, or null.
export function updatePanel(panel, player, cameras, dt, time) {
  if (!panel) return null;
  const dist = Math.hypot(player.x - panel.x, player.y - panel.y);
  if (dist <= 48) {
    panel.progress = Math.min(1, (panel.progress || 0) + dt / PANEL_HOLD_SECONDS);
    if (panel.progress >= 1) {
      panel.progress = 0;
      let best = null;
      let bestDist = Infinity;
      for (const c of cameras) {
        if (time < c.disabledUntil) continue;
        const d = Math.hypot(c.x - panel.x, c.y - panel.y);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      if (best) {
        best.disabledUntil = time + PANEL_DISABLE_SECONDS;
        return best;
      }
    }
  } else {
    panel.progress = 0;
  }
  return null;
}

// Alarm stage 2: every guard converges on the last-known position, and
// the first guard takes up a patrol loop by the exit.
export function raiseAlarmStage2(guards, exit) {
  for (const g of guards) {
    if (g.mode === 'patrol') g.mode = 'search';
  }
  const first = guards[0];
  if (first && !first.exitDuty) {
    first.exitDuty = true;
    first.waypoints = [
      { x: exit.x - 90, y: exit.y + exit.h / 2 },
      { x: exit.x + exit.w + 90, y: exit.y + exit.h / 2 },
    ];
    first.wpIndex = 0;
    first.mode = 'patrol';
  }
}

export { hasLineOfSight };
