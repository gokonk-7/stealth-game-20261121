// Bootstrap, game loop, state machine, scoring and the test hook.
// One job: own the state and drive it forward. Drawing lives in render.js,
// watching lives in guards.js, seeing lives in detection.js.
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_WALK_SPEED,
  PLAYER_SNEAK_SPEED,
  CONE_RANGE,
  SUSPICION_QUESTION,
  SUSPICION_MAX,
  LOOT_SCORE,
  GHOST_BONUS,
  CAUGHT_PENALTY,
  MAX_CAUGHT_PER_LEVEL,
} from './config.js';
import { LEVELS } from './levels.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { render } from './render.js';
import { makeGuard, makeCamera, updateGuard, updateCamera, updatePanel, raiseAlarmStage2 } from './guards.js';
import { stageShot } from './shots.js';

function loadBestScore() {
  try {
    return Number(window.localStorage.getItem('meridian-best') || 0) || 0;
  } catch (_e) {
    return 0;
  }
}

function saveBestScore(score) {
  try {
    window.localStorage.setItem('meridian-best', String(score));
  } catch (_e) {
    /* storage unavailable: best score just lives for the session */
  }
}

export function createGame(canvas) {
  const ctx = canvas.getContext('2d');
  const audio = createAudio();
  const input = createInput(canvas);

  const state = {
    screen: 'menu', // menu | playing | paused | caught | levelComplete | win
    levelIndex: 0,
    level: LEVELS[0],
    solids: [],
    guards: [],
    cameras: [],
    loot: [],
    opal: null,
    panel: null,
    exit: LEVELS[0].exit,
    player: { x: 70, y: 360, dir: 0, sneaking: false, moveTarget: null, stepTimer: 0 },
    timer: LEVELS[0].timeLimit,
    time: 0,
    score: 0,
    alarm: 0,
    ghost: true,
    caughtCount: 0,
    stars: [0, 0, 0],
    bestScore: loadBestScore(),
    banner: null,
    bannerUntil: 0,
    lastStars: 1,
    lastTimeBonus: 0,
    lastGhost: false,
    lastLootBonus: 0,
    lastLevelScore: 0,
  };

  function buildLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.solids = [...level.walls, ...level.cover];
    state.guards = level.guards.map((g, i) => makeGuard(g, i));
    state.cameras = level.cameras.map((c) => makeCamera(c));
    state.loot = level.loot.map((l) => ({ ...l, taken: false }));
    state.opal = level.opal ? { ...level.opal, taken: false } : null;
    state.panel = level.panel ? { ...level.panel, progress: 0 } : null;
    state.exit = level.exit;
    state.player = {
      x: level.start.x,
      y: level.start.y,
      dir: 0,
      sneaking: false,
      moveTarget: null,
      stepTimer: 0,
    };
    state.timer = level.timeLimit;
    state.time = 0;
    state.alarm = 0;
    state.ghost = true;
    state.caughtCount = 0;
    state.banner = null;
    state.bannerUntil = 0;
    input.clearMoveTarget();
  }

  function startLevel(index) {
    buildLevel(index);
    state.screen = 'playing';
  }

  function restartLevel() {
    const score = state.score;
    buildLevel(state.levelIndex);
    state.score = score;
    state.screen = 'playing';
    setBanner('Back to the door. Stay low.', 2.5);
  }

  function setBanner(text, seconds = 2.5) {
    state.banner = text;
    state.bannerUntil = state.time + seconds;
  }

  function raiseAlarm(steps) {
    const before = state.alarm;
    state.alarm = Math.min(2, state.alarm + steps);
    if (state.alarm !== before) {
      audio.alarmTone();
      if (state.alarm === 2) raiseAlarmStage2(state.guards, state.exit);
    }
  }

  function respawnAfterCaught() {
    state.player.x = state.level.start.x;
    state.player.y = state.level.start.y;
    state.player.moveTarget = null;
    state.player.dir = 0;
    for (const g of state.guards) {
      g.suspicion = 0;
      g.mode = 'patrol';
      g.exitDuty = false;
      g.waypoints = state.level.guards[g.index].waypoints.map(([x, y]) => ({ x, y }));
      const [sx, sy] = state.level.guards[g.index].waypoints[0];
      g.x = sx;
      g.y = sy;
      g.wpIndex = 1 % g.waypoints.length;
    }
    for (const c of state.cameras) c.suspicion = 0;
  }

  function handleCaught(reason) {
    state.score = Math.max(0, state.score - CAUGHT_PENALTY);
    state.caughtCount += 1;
    audio.caughtBuzz();
    if (state.caughtCount >= MAX_CAUGHT_PER_LEVEL) {
      restartLevel();
      setBanner('Three catches — the level restarts.', 3);
      return;
    }
    respawnAfterCaught();
    raiseAlarm(1);
    state.screen = 'caught';
  }

  function levelComplete() {
    const timeBonus = Math.max(0, Math.ceil(state.timer)) * 10;
    const ghostBonus = state.ghost ? GHOST_BONUS : 0;
    const lootBonus = state.loot.filter((l) => l.taken).length * LOOT_SCORE;
    state.lastTimeBonus = timeBonus;
    state.lastGhost = state.ghost;
    state.lastLootBonus = lootBonus;
    state.lastLevelScore = timeBonus + ghostBonus + lootBonus;
    state.score += timeBonus + ghostBonus;
    state.lastStars = state.ghost && state.timer >= 60 ? 3 : state.timer >= 30 ? 2 : 1;
    state.stars[state.levelIndex] = state.lastStars;
    if (state.score > state.bestScore) {
      state.bestScore = state.score;
      saveBestScore(state.score);
    }
    if (state.levelIndex >= LEVELS.length - 1) {
      audio.winFanfare();
      state.screen = 'win';
    } else {
      audio.levelComplete();
      state.screen = 'levelComplete';
    }
  }

  function circleHitsSolid(x, y, r) {
    for (const s of state.solids) {
      const cx = Math.max(s.x, Math.min(x, s.x + s.w));
      const cy = Math.max(s.y, Math.min(y, s.y + s.h));
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
    }
    return false;
  }

  function movePlayer(dt) {
    const p = state.player;
    p.sneaking = input.sneaking();
    const speed = p.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED;
    let mx = 0;
    let my = 0;
    const kv = input.moveVector();
    if (kv) {
      mx = kv.x;
      my = kv.y;
      p.moveTarget = null;
    } else {
      const target = input.moveTarget();
      if (target) {
        p.moveTarget = target;
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 8) {
          input.clearMoveTarget();
          p.moveTarget = null;
        } else {
          mx = dx / dist;
          my = dy / dist;
        }
      }
    }
    if (mx !== 0 || my !== 0) {
      p.dir = Math.atan2(my, mx);
      const nx = p.x + mx * speed * dt;
      const ny = p.y + my * speed * dt;
      if (!circleHitsSolid(nx, p.y, PLAYER_RADIUS)) p.x = nx;
      if (!circleHitsSolid(p.x, ny, PLAYER_RADIUS)) p.y = ny;
      // Footsteps: quiet while walking, silent while sneaking.
      p.stepTimer -= dt;
      if (p.stepTimer <= 0 && !p.sneaking) {
        p.stepTimer = 0.42;
        audio.thiefStep(p.x, p.y);
      }
    }
  }

  function update(dt) {
    if (state.screen !== 'playing') return;
    state.time += dt;
    state.timer -= dt;
    if (state.timer <= 0) {
      state.timer = 0;
      handleCaught('time');
      return;
    }

    movePlayer(dt);
    const p = state.player;
    const watchCtx = {
      player: p,
      level: state.level,
      solids: state.solids,
      alarm: state.alarm,
      time: state.time,
      audio,
    };

    for (const g of state.guards) {
      const events = updateGuard(g, dt, watchCtx);
      if (events.includes('question')) {
        audio.suspicionSting();
        setBanner('A guard is getting curious…', 2);
      }
      if (events.includes('spotted')) {
        audio.spottedSting();
        setBanner('SPOTTED! Break line of sight!', 2.5);
      }
      if (events.includes('caught')) {
        handleCaught('guard');
        return;
      }
    }
    for (const c of state.cameras) {
      const event = updateCamera(c, dt, watchCtx);
      if (event === 'question') audio.suspicionSting();
      if (event === 'tripped') {
        raiseAlarm(1);
        setBanner('A camera raised the alarm!', 2.5);
      }
    }
    if (state.panel) {
      const disabled = updatePanel(state.panel, p, state.cameras, dt, state.time);
      if (disabled) {
        audio.pickupChime();
        setBanner('Camera disabled for 8 seconds.', 2.5);
      }
    }

    // Ghost bonus dies the moment any watcher gets properly suspicious.
    const maxSuspicion = Math.max(
      0,
      ...state.guards.map((g) => g.suspicion),
      ...state.cameras.map((c) => c.suspicion),
    );
    if (maxSuspicion >= SUSPICION_QUESTION) state.ghost = false;

    // Loot pickup.
    for (const item of state.loot) {
      if (!item.taken && Math.hypot(p.x - item.x, p.y - item.y) < 26) {
        item.taken = true;
        state.score += LOOT_SCORE;
        audio.pickupChime();
        setBanner(`${item.name} secured · +${LOOT_SCORE}`, 2.5);
      }
    }
    // The Opal: grabbing it trips the alarm at once.
    if (state.opal && !state.opal.taken && Math.hypot(p.x - state.opal.x, p.y - state.opal.y) < 30) {
      state.opal.taken = true;
      raiseAlarm(1);
      setBanner('The Starlight Opal is yours — the alarm is up!', 3);
    }
    // Exit: step inside and the level is done.
    const e = state.exit;
    if (p.x > e.x && p.x < e.x + e.w && p.y > e.y && p.y < e.y + e.h) {
      levelComplete();
    }
  }

  function pollKeys() {
    if (state.screen === 'menu') {
      if (input.wasPressed('1')) startLevel(0);
      else if (input.wasPressed('2')) startLevel(1);
      else if (input.wasPressed('3')) startLevel(2);
      else if (input.wasPressed('Enter')) startLevel(0);
    } else if (state.screen === 'playing') {
      if (input.wasPressed('p') || input.wasPressed('Escape')) state.screen = 'paused';
      else if (input.wasPressed('m')) audio.setMuted(!audio.isMuted());
      else if (input.wasPressed('r')) restartLevel();
    } else if (state.screen === 'paused') {
      if (input.wasPressed('p') || input.wasPressed('Escape')) state.screen = 'playing';
      else if (input.wasPressed('r')) restartLevel();
    } else if (state.screen === 'caught') {
      if (input.wasPressed('Enter') || input.wasPressed(' ') || input.wasPressed('r')) {
        state.screen = 'playing';
      } else if (pressedAny()) {
        state.screen = 'playing';
      }
    } else if (state.screen === 'levelComplete') {
      if (input.wasPressed('Enter')) startLevel(state.levelIndex + 1);
      else if (input.wasPressed('r')) restartLevel();
    } else if (state.screen === 'win') {
      if (input.wasPressed('r') || input.wasPressed('Enter')) {
        state.score = 0;
        state.stars = [0, 0, 0];
        startLevel(0);
      }
    }
    input.consumePressed();
  }

  function pressedAny() {
    return (
      input.wasPressed('w') || input.wasPressed('a') || input.wasPressed('s') || input.wasPressed('d') ||
      input.wasPressed('ArrowUp') || input.wasPressed('ArrowDown') || input.wasPressed('ArrowLeft') ||
      input.wasPressed('ArrowRight')
    );
  }

  let last = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    pollKeys();
    update(dt);
    render(ctx, state);
    requestAnimationFrame(frame);
  }

  // -- self-test ---------------------------------------------------------
  // ?selftest=1 runs the same assertions inside the page and writes
  // PASS/FAIL into document.title, so headless Chrome can read it back.
  function runSelfTest() {
    const results = [];
    function check(name, fn) {
      try {
        const ok = fn();
        results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`);
      } catch (e) {
        results.push(`FAIL ${name} (${e.message})`);
      }
    }
    const step = (seconds) => {
      const n = Math.ceil(seconds / (1 / 60));
      for (let i = 0; i < n; i++) update(1 / 60);
    };

    check('suspicion rises inside a cone', () => {
      startLevel(0);
      state.player.x = 430;
      state.player.y = 150;
      step(0.5);
      return state.guards[0].suspicion > 5;
    });
    check('suspicion decays out of sight', () => {
      const before = state.guards[0].suspicion;
      state.player.x = 100;
      state.player.y = 600;
      step(1);
      return state.guards[0].suspicion < before;
    });
    check('full suspicion starts a chase', () => {
      state.player.x = 430;
      state.player.y = 150;
      state.guards[0].suspicion = 99;
      step(0.3);
      return state.guards[0].mode === 'chase';
    });
    check('guard gives up and returns to patrol', () => {
      state.player.x = 100;
      state.player.y = 600;
      step(4);
      return state.guards[0].mode !== 'chase';
    });
    check('touching a guard catches the thief', () => {
      startLevel(0);
      const g = state.guards[0];
      state.player.x = g.x;
      state.player.y = g.y;
      step(0.05);
      return state.screen === 'caught' && state.alarm === 1;
    });
    check('camera cone sweeps', () => {
      startLevel(2);
      const before = state.cameras[0].dir;
      step(1);
      return Math.abs(state.cameras[0].dir - before) > 0.05;
    });
    check('panel disables the nearest camera', () => {
      startLevel(2);
      state.player.x = state.panel.x;
      state.player.y = state.panel.y;
      step(3.5);
      return state.cameras[0].disabledUntil > state.time;
    });
    check('loot pickup scores +150', () => {
      startLevel(0);
      const before = state.score;
      state.player.x = state.loot[0].x;
      state.player.y = state.loot[0].y;
      step(0.05);
      return state.loot[0].taken && state.score === before + LOOT_SCORE;
    });
    check('reaching the exit completes the level', () => {
      startLevel(0);
      state.player.x = state.exit.x + state.exit.w / 2;
      state.player.y = state.exit.y + state.exit.h / 2;
      step(0.05);
      return state.screen === 'levelComplete';
    });
    check('restart resets the level', () => {
      restartLevel();
      return (
        state.screen === 'playing' &&
        state.timer === state.level.timeLimit &&
        state.player.x === state.level.start.x &&
        state.player.y === state.level.start.y
      );
    });

    const passed = results.filter((r) => r.startsWith('PASS')).length;
    const summary = `SELFTEST ${passed}/${results.length} ${passed === results.length ? 'PASS' : 'FAIL'}`;
    document.title = summary;
    const div = document.getElementById('selftest');
    if (div) div.textContent = [summary, ...results].join('\n');
    return { passed, total: results.length, results };
  }

  const game = {
    state,
    startLevel,
    restartLevel,
    update,
    render: () => render(ctx, state),
    // Test hook: drive the game from automated checks.
    moveTo(x, y) {
      state.player.x = x;
      state.player.y = y;
      state.player.moveTarget = null;
    },
    setSuspicion(index, value) {
      state.guards[index].suspicion = value;
    },
    collectLoot(index) {
      const item = state.loot[index];
      if (item && !item.taken) {
        item.taken = true;
        state.score += LOOT_SCORE;
      }
    },
    forceCaught() {
      handleCaught('test');
    },
    runSelfTest,
  };

  // Boot: menu over level 1, then the mode the URL asks for.
  buildLevel(0);
  state.screen = 'menu';
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    stageShot(game, shot);
    render(ctx, state);
    document.title = 'shot-ready';
  } else if (params.get('selftest') === '1') {
    const out = runSelfTest();
    render(ctx, state);
    if (window.console) console.log(out.results.join('\n'));
  } else {
    window.addEventListener('keydown', () => audio.unlock(), { once: true });
    canvas.addEventListener('mousedown', () => audio.unlock(), { once: true });
    requestAnimationFrame(frame);
  }

  window.__game = game;
  return game;
}

// Entry point: the page's module script calls this once.
const canvas = document.getElementById('game');
if (canvas) createGame(canvas);
