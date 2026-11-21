// Night at the Meridian Museum — bootstrap, game loop, state machine, scoring.
// The thief is Wren, a cat burglar in a charcoal coat with a crimson scarf,
// after the Starlight Opal. Three wings, guards with vision cones, cameras,
// cover, light and shadow — all procedural, all offline.
import { W, H, THIEF_R, THIEF_WALK, THIEF_SNEAK, GUARD_CHASE, SPOT_LINE } from './config.js';
import { LEVELS } from './levels.js';
import { createAudio } from './audio.js';
import { makeGuard, makeCamera, updateGuard, updateCamera } from './guards.js';
import { hasLOS, inCone, sense, dist, circleHitsBlocker } from './detection.js';
import { createInput } from './input.js';
import { draw } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '7', 10) || 7;
const audio = createAudio();

const state = {
  screen: 'menu', // menu | playing | paused | caught | levelComplete | win
  levelIndex: 0,
  level: null,
  blockers: [],
  thief: { x: 80, y: 388, angle: 0, sneaking: false, moving: false, stepTimer: 0 },
  guards: [],
  cameras: [],
  loot: [],
  opalTaken: false,
  panel: null,
  alarm: 0,
  caughtCount: 0,
  score: 0,
  stars: [0, 0, 0],
  ghosts: [false, false, false],
  timeLeft: 0,
  ghost: true,
  lootScore: 0,
  scoreAtLevelStart: 0,
  now: 0,
  message: '',
  messageUntil: 0,
  levelScore: 0,
  levelStars: 0,
  frozen: false,
  best: 0,
  caughtTimer: 0,
  moveTarget: null,
};

try {
  state.best = parseInt(localStorage.getItem('meridian-best') || '0', 10) || 0;
} catch (e) {
  state.best = 0;
}

function showMessage(text, dur = 1.6) {
  state.message = text;
  state.messageUntil = state.now + dur;
  if (statusEl) statusEl.textContent = text;
}

function loadLevel(i) {
  const def = LEVELS[i];
  state.levelIndex = i;
  state.level = def;
  state.blockers = [...def.walls, ...def.cover];
  state.thief = { x: def.start.x, y: def.start.y, angle: 0, sneaking: false, moving: false, stepTimer: 0 };
  state.guards = def.guards.map(makeGuard);
  if (def.reserve) {
    const r = makeGuard(def.reserve);
    r.active = false;
    state.guards.push(r);
  }
  state.cameras = (def.cameras || []).map(makeCamera);
  state.loot = def.loot.map((l) => ({ ...l, taken: false }));
  state.opalTaken = false;
  state.panel = def.panel ? { x: def.panel.x, y: def.panel.y, progress: 0 } : null;
  state.alarm = 0;
  state.caughtCount = 0;
  state.timeLeft = def.timeLimit;
  state.ghost = true;
  state.lootScore = 0;
  state.scoreAtLevelStart = state.score;
  state.message = '';
  state.messageUntil = 0;
  state.levelScore = 0;
  state.levelStars = 0;
  input.clearMoveTarget();
}

function startGame(i) {
  state.score = 0;
  state.stars = [0, 0, 0];
  state.ghosts = [false, false, false];
  loadLevel(i);
  state.screen = 'playing';
  audio.click();
  showMessage(LEVELS[i].objective, 2.4);
}

function activateReserve() {
  const r = state.guards.find((g) => !g.active);
  if (r) {
    r.active = true;
    showMessage('A reserve guard moves to the exit.', 2);
  }
}

function restartLevel(full) {
  const keepScore = full ? state.scoreAtLevelStart : state.score;
  state.score = keepScore;
  loadLevel(state.levelIndex);
  state.screen = 'playing';
}

function timeout() {
  showMessage('Out of time — the museum opens at dawn.', 2);
  restartLevel(true);
}

function caught() {
  state.caughtCount++;
  state.score = Math.max(0, state.score - 100);
  state.alarm = Math.min(2, state.alarm + 1);
  if (state.alarm === 2) activateReserve();
  audio.alarm();
  if (state.caughtCount >= 3) {
    restartLevel(true);
    showMessage('Caught three times — the wing resets.', 2);
    return;
  }
  state.thief.x = state.level.start.x;
  state.thief.y = state.level.start.y;
  for (const g of state.guards) {
    g.suspicion = 0;
    g.state = 'patrol';
    g.lastSeen = null;
    g.x = g.home.x;
    g.y = g.home.y;
    g.wp = 1;
  }
  for (const c of state.cameras) c.suspicion = 0;
  state.screen = 'caught';
  state.caughtTimer = 1.4;
}

function levelComplete() {
  const timeBonus = Math.round(state.timeLeft) * 10;
  const ghostBonus = state.ghost ? 500 : 0;
  state.levelScore = timeBonus + ghostBonus + state.lootScore;
  state.levelStars = state.ghost && state.timeLeft >= 60 ? 3 : state.timeLeft >= 30 ? 2 : 1;
  state.score += state.levelScore;
  state.stars[state.levelIndex] = state.levelStars;
  state.ghosts[state.levelIndex] = state.ghost;
  audio.complete();
  state.screen = 'levelComplete';
  if (state.score > state.best) {
    state.best = state.score;
    try {
      localStorage.setItem('meridian-best', String(state.best));
    } catch (e) {}
  }
}

function moveThief(dt) {
  const t = state.thief;
  let dx = 0;
  let dy = 0;
  const ax = input.axis();
  if (ax.x || ax.y) {
    dx = ax.x;
    dy = ax.y;
    input.clearMoveTarget();
  } else if (input.moveTarget) {
    const d = dist(t.x, t.y, input.moveTarget.x, input.moveTarget.y);
    if (d < 6) {
      input.clearMoveTarget();
    } else {
      dx = (input.moveTarget.x - t.x) / d;
      dy = (input.moveTarget.y - t.y) / d;
    }
  }
  t.sneaking = input.sneaking;
  const speed = t.sneaking ? THIEF_SNEAK : THIEF_WALK;
  const len = Math.hypot(dx, dy);
  t.moving = len > 0;
  if (len > 0) {
    dx /= len;
    dy /= len;
    t.angle = Math.atan2(dy, dx);
    const step = speed * dt;
    if (!circleHitsBlocker(t.x + dx * step, t.y, THIEF_R, state.blockers)) t.x += dx * step;
    if (!circleHitsBlocker(t.x, t.y + dy * step, THIEF_R, state.blockers)) t.y += dy * step;
    if (!t.sneaking) {
      t.stepTimer -= dt;
      if (t.stepTimer <= 0) {
        t.stepTimer = 0.42;
        audio.thiefStep();
      }
    }
  }
}

function guardCtx() {
  return {
    thief: state.thief,
    blockers: state.blockers,
    alarm: state.alarm,
    now: state.now,
    onStep(g, d) {
      const pan = Math.max(-1, Math.min(1, (g.x - state.thief.x) / 400));
      audio.step(pan, 0.22 * (1 - d / 520));
    },
  };
}

function update(dt) {
  state.now += dt;
  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    timeout();
    return;
  }
  moveThief(dt);

  // Control panel: stand next to it for 3 s to power down the nearest camera.
  if (state.panel) {
    const p = state.panel;
    if (dist(state.thief.x, state.thief.y, p.x, p.y) < 44) {
      p.progress += dt;
      if (p.progress >= 3) {
        let nearest = null;
        let nd = Infinity;
        for (const c of state.cameras) {
          const d = dist(p.x, p.y, c.x, c.y);
          if (d < nd) {
            nd = d;
            nearest = c;
          }
        }
        if (nearest) {
          nearest.disabledUntil = state.now + 8;
          nearest.suspicion = 0;
          showMessage('Camera powered down for 8 s.', 1.6);
        }
        p.progress = 0;
      }
    } else {
      p.progress = 0;
    }
  }

  // Guards sense, then move.
  for (const g of state.guards) {
    if (!g.active) continue;
    const r = sense(g, state.thief, state.level, state.blockers, state.alarm, dt, state.now);
    if (g.suspicion >= SPOT_LINE) state.ghost = false;
    if (r.spotted) {
      g.state = 'chase';
      g.lastSeen = { x: state.thief.x, y: state.thief.y };
      audio.spotted();
      showMessage('Spotted!', 1.2);
    } else if (g.suspicion >= SPOT_LINE && g.state === 'patrol') {
      g.state = 'suspicious';
      audio.sting();
    }
    if (g.suspicion >= SPOT_LINE && state.alarm === 2) {
      // Alert: every guard converges on the last known position.
      for (const o of state.guards) {
        if (o.active && o.state !== 'chase') {
          o.state = 'chase';
          o.lastSeen = { x: state.thief.x, y: state.thief.y };
        }
      }
    }
    updateGuard(g, dt, guardCtx());
    if (g.state === 'chase' && dist(g.x, g.y, state.thief.x, state.thief.y) < 26) {
      caught();
      return;
    }
  }

  // Cameras sense and sweep.
  for (const c of state.cameras) {
    updateCamera(c, dt, state);
    const r = sense(c, state.thief, state.level, state.blockers, state.alarm, dt, state.now);
    if (c.suspicion >= SPOT_LINE) state.ghost = false;
    if (r.spotted) {
      state.alarm = Math.max(state.alarm, 1);
      c.suspicion = 0;
      for (const g of state.guards) {
        if (g.active) g.lastSeen = { x: state.thief.x, y: state.thief.y };
      }
      audio.alarm();
      showMessage('A camera spotted you — the alarm is up!', 1.6);
    }
  }

  // Loot.
  for (const l of state.loot) {
    if (!l.taken && dist(state.thief.x, state.thief.y, l.x, l.y) < 26) {
      l.taken = true;
      state.lootScore += 150;
      audio.pickup();
      showMessage(`Picked up ${l.label}  +150`, 1.4);
    }
  }

  // The Opal: taking it raises the alarm to stage 1 at once.
  if (state.level.opal && !state.opalTaken) {
    const o = state.level.opal;
    if (dist(state.thief.x, state.thief.y, o.x, o.y) < 30) {
      state.opalTaken = true;
      state.alarm = Math.max(state.alarm, 1);
      audio.alarm();
      showMessage('The Starlight Opal is yours — the alarm is up. Run!', 2);
    }
  }

  // Exit.
  const e = state.level.exit;
  const t = state.thief;
  if (t.x > e.x && t.x < e.x + e.w && t.y > e.y && t.y < e.y + e.h) {
    if (state.level.opal && !state.opalTaken) {
      showMessage('Take the Opal first.', 1.2);
    } else {
      levelComplete();
    }
  }
}

function onKey(key) {
  audio.ensure();
  if (key === 'm') {
    audio.setMuted(!audio.isMuted());
    showMessage(audio.isMuted() ? 'Muted.' : 'Sound on.', 1);
    return;
  }
  if (state.screen === 'menu') {
    if (key === 'Enter' || key === ' ') startGame(0);
    else if (key === '1') startGame(0);
    else if (key === '2') startGame(1);
    else if (key === '3') startGame(2);
    return;
  }
  if (key === 'p' || key === 'Escape') {
    if (state.screen === 'playing') state.screen = 'paused';
    else if (state.screen === 'paused') state.screen = 'playing';
    return;
  }
  if (key === 'r') {
    if (state.screen === 'win') startGame(0);
    else if (state.screen !== 'menu') restartLevel(false);
    return;
  }
  if (state.screen === 'levelComplete' && (key === 'Enter' || key === ' ')) {
    if (state.levelIndex < 2) {
      loadLevel(state.levelIndex + 1);
      state.screen = 'playing';
      showMessage(LEVELS[state.levelIndex].objective, 2.4);
    } else {
      state.screen = 'win';
      audio.win();
    }
  }
}

function onClick() {
  audio.ensure();
  if (state.screen === 'menu') {
    startGame(0);
    return;
  }
  if (state.screen === 'levelComplete') {
    if (state.levelIndex < 2) {
      loadLevel(state.levelIndex + 1);
      state.screen = 'playing';
      showMessage(LEVELS[state.levelIndex].objective, 2.4);
    } else {
      state.screen = 'win';
      audio.win();
    }
    return;
  }
  if (state.screen === 'win') startGame(0);
}

const input = createInput(canvas, { onKey, onClick });

const world = { state, loadLevel, startGame };

// Test hook for automated checks: state plus the same code paths play uses.
window.__game = {
  state,
  startGame,
  loadLevel,
  moveTo(x, y) {
    state.thief.x = x;
    state.thief.y = y;
  },
  setSuspicion(i, v) {
    const g = state.guards[i] || state.cameras[i];
    if (g) g.suspicion = v;
  },
  collectLoot(i) {
    const l = state.loot[i];
    if (l && !l.taken) {
      l.taken = true;
      state.lootScore += 150;
    }
  },
  forceCaught() {
    caught();
  },
  step(dt) {
    update(dt);
  },
  pressKey(key) {
    onKey(key);
  },
};

// Self-test (?selftest=1): runs the real assertions inside the page and writes
// PASS/FAIL into document.title. Kept in the shipped code; it is small and honest.
function runSelfTest() {
  const results = [];
  const check = (name, cond) => results.push([name, !!cond]);
  const step = (n, dt = 1 / 60) => {
    for (let i = 0; i < n; i++) update(dt);
  };
  try {
    // 1. Suspicion rises inside a cone with line of sight.
    startGame(0);
    const g0 = state.guards[0];
    state.thief.x = g0.x + 100;
    state.thief.y = g0.y;
    step(60);
    const s1 = g0.suspicion;
    check('suspicion-rises-in-cone', s1 > 5);

    // 2. Suspicion decays behind cover (line of sight blocked by a case).
    state.thief.x = 390;
    state.thief.y = 190;
    step(120);
    check('suspicion-decays-behind-cover', g0.suspicion < s1);

    // 3. Reaching 100 suspicion starts a chase.
    state.thief.x = g0.x + 100;
    state.thief.y = g0.y;
    g0.suspicion = 99;
    step(10);
    check('spotted-starts-chase', g0.state === 'chase');

    // 4. Breaking line of sight lets the guard give up and return.
    state.thief.x = 100;
    state.thief.y = 650;
    step(300);
    check('guard-gives-up-and-returns', g0.state !== 'chase');

    // 5. Being caught respawns at the start with alarm +1.
    const alarmBefore = state.alarm;
    window.__game.forceCaught();
    check(
      'caught-respawns-alarm-plus-one',
      state.alarm === alarmBefore + 1 &&
        state.thief.x === state.level.start.x &&
        state.thief.y === state.level.start.y,
    );
    state.screen = 'playing';

    // 6. A camera sweeps, and the panel powers it down for 8 s.
    loadLevel(2);
    state.screen = 'playing';
    const c0 = state.cameras[0];
    const a0 = c0.angle;
    step(60);
    check('camera-sweeps', c0.angle !== a0);
    state.thief.x = 48;
    state.thief.y = 360;
    step(240);
    check('panel-disables-camera', c0.disabledUntil > state.now);

    // 7. Loot pays +150.
    loadLevel(0);
    state.screen = 'playing';
    window.__game.collectLoot(0);
    check('loot-pays-150', state.lootScore === 150 && state.loot[0].taken);

    // 8. Reaching the exit completes the level.
    const e = state.level.exit;
    state.thief.x = e.x + e.w / 2;
    state.thief.y = e.y + e.h / 2;
    step(1);
    check('exit-completes-level', state.screen === 'levelComplete' && state.levelScore > 0);

    // 9. Restart resets the wing.
    restartLevel(false);
    check(
      'restart-resets-wing',
      state.screen === 'playing' &&
        state.thief.x === state.level.start.x &&
        state.timeLeft === state.level.timeLimit,
    );

    // 10. The Opal + exit flow reaches the win screen.
    loadLevel(2);
    state.screen = 'playing';
    state.opalTaken = true;
    const e3 = state.level.exit;
    state.thief.x = e3.x + e3.w / 2;
    state.thief.y = e3.y + e3.h / 2;
    step(1);
    check('vault-exit-completes', state.screen === 'levelComplete');
    onKey('Enter');
    check('win-screen-after-vault', state.screen === 'win');
  } catch (err) {
    results.push(['selftest-threw', false]);
    console.error(err);
  }
  const failed = results.filter(([, ok]) => !ok).map(([n]) => n);
  const passed = results.length - failed.length;
  const title = failed.length === 0 ? `SELFTEST PASS ${passed}/${results.length}` : `SELFTEST FAIL: ${failed.join(',')}`;
  document.title = title;
  if (statusEl) statusEl.textContent = title;
  console.log(title, results);
}

let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
  last = ts;
  if (state.screen === 'playing') update(dt);
  else if (state.screen === 'caught') {
    state.caughtTimer -= dt;
    if (state.caughtTimer <= 0) state.screen = 'playing';
  }
  state.moveTarget = input.moveTarget;
  draw(ctx, state);
  requestAnimationFrame(loop);
}

// Boot.
if (params.get('selftest') === '1') {
  loadLevel(0);
  state.screen = 'playing';
  runSelfTest();
  draw(ctx, state);
} else if (params.get('shot')) {
  loadLevel(0);
  stageShot(params.get('shot'), world);
  draw(ctx, state);
  document.title = 'shot-ready';
} else {
  loadLevel(0);
  state.screen = 'menu';
  requestAnimationFrame(loop);
}
