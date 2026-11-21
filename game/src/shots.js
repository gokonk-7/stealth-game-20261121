// Screenshot staging: drive the REAL game state into a chosen moment
// (move the thief, set a guard's suspicion, set the timer and score
// through the same state the game plays with), then render one static
// frame. Never fake pixels: every shot is the game itself, frozen.
import { SUSPICION_MAX } from './config.js';

// Stage the cover: Level 1 mid-play, Wren crouched behind a display case,
// a guard's cone sweeping past just in front of her, the second guard
// mid-patrol at the far end, suspicion ~35, timer ~112 s, score 150.
function stageCover(game) {
  game.startLevel(0);
  const s = game.state;
  s.player.x = 410;
  s.player.y = 252;
  s.player.dir = Math.PI / 2;
  s.player.sneaking = true;
  const g0 = s.guards[0];
  g0.x = 470;
  g0.y = 120;
  g0.dir = Math.PI / 2 + 0.35; // cone sweeps just in front of Wren
  g0.suspicion = 35;
  const g1 = s.guards[1];
  g1.x = 900;
  g1.y = 600;
  g1.dir = Math.PI;
  g1.suspicion = 0;
  s.loot[0].taken = true; // the Jade Scarab, +150
  s.score = 150;
  s.timer = 112;
  s.time = 38;
}

// Stage the patrol shot: Level 2, two guards' cones crossing in the main
// hall, Wren between them, the Gold Mask glinting on its pedestal.
function stagePatrol(game) {
  game.startLevel(1);
  const s = game.state;
  s.player.x = 640;
  s.player.y = 402;
  s.player.dir = -Math.PI / 2;
  s.player.sneaking = true;
  const g0 = s.guards[0];
  g0.x = 480;
  g0.y = 360;
  g0.dir = 0;
  g0.suspicion = 20;
  const g1 = s.guards[1];
  g1.x = 800;
  g1.y = 440;
  g1.dir = Math.PI;
  g1.suspicion = 12;
  const g2 = s.guards[2];
  g2.x = 700;
  g2.y = 90;
  g2.dir = 0;
  s.loot[1].taken = true; // the Ivory Figure, +150
  s.score = 150;
  s.timer = 96;
  s.time = 84;
}

// Stage the cameras shot: Level 3, a camera sweep cone and a guard cone
// overlapping near the Opal pedestal, Wren at the control panel, alarm 1.
function stageCameras(game) {
  game.startLevel(2);
  const s = game.state;
  s.player.x = 78;
  s.player.y = 360;
  s.player.dir = 0;
  s.panel.progress = 0.6;
  const cam = s.cameras[0];
  cam.phase = 0; // pointing straight down at the Opal
  cam.dir = cam.baseDir;
  cam.suspicion = 60;
  const g0 = s.guards[0];
  g0.x = 660;
  g0.y = 160;
  g0.dir = Math.PI / 2;
  g0.suspicion = 25;
  s.alarm = 1;
  s.loot[0].taken = true; // the Silver Astrolabe, +150
  s.score = 150;
  s.timer = 140;
  s.time = 70;
}

// Stage the win shot: play Level 3's ending through the real code path —
// take the Opal, then step onto the skylight exit — so the win screen is
// the game's own, with 3 stars and the ghost bonus.
function stageWin(game) {
  game.startLevel(2);
  const s = game.state;
  s.timer = 200;
  s.time = 10;
  s.loot[0].taken = true;
  s.score = 150;
  s.stars = [3, 3, 0];
  s.player.x = s.opal.x;
  s.player.y = s.opal.y;
  game.update(0.016); // collect the Opal through the real pickup path
  s.player.x = s.exit.x + s.exit.w / 2;
  s.player.y = s.exit.y + s.exit.h / 2;
  game.update(0.016); // step onto the exit through the real finish path
  s.time = 10; // keep the frame calm: no banner pulse mid-shot
}

export function stageShot(game, name) {
  if (name === 'cover') stageCover(game);
  else if (name === 'patrol') stagePatrol(game);
  else if (name === 'cameras') stageCameras(game);
  else if (name === 'win') stageWin(game);
  else throw new Error(`unknown shot: ${name}`);
  return game.state;
}

export { SUSPICION_MAX };
