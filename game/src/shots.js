// Deterministic screenshot stagings. Each shot drives the REAL game state —
// the thief is moved, suspicion is set, the timer and score are set through
// the same fields play uses — and then one static frame is rendered.
// Never fake pixels: what the shot shows is what the game draws.
export function stageShot(name, world) {
  const S = world.state;

  if (name === 'cover') {
    world.loadLevel(0);
    // Wren crouched behind a display case; a guard's cone sweeps past just
    // in front of her while the second guard patrols the far end.
    S.thief.x = 330;
    S.thief.y = 302;
    S.thief.sneaking = true;
    S.thief.angle = Math.PI;
    S.guards[0].x = 560;
    S.guards[0].y = 300;
    S.guards[0].angle = Math.PI;
    S.guards[0].suspicion = 35;
    S.guards[1].x = 1000;
    S.guards[1].y = 430;
    S.guards[1].angle = Math.PI;
    S.timeLeft = 112;
    S.score = 150;
    S.lootScore = 150;
    S.loot[0].taken = true;
    S.ghost = true;
    S.screen = 'playing';
  } else if (name === 'patrol') {
    world.loadLevel(1);
    // Two guards' cones crossing in the main hall; Wren in the dark gap
    // between them (outside both cones' range and angle).
    S.thief.x = 520;
    S.thief.y = 430;
    S.thief.sneaking = true;
    S.thief.angle = -Math.PI / 2;
    S.guards[0].x = 480;
    S.guards[0].y = 300;
    S.guards[0].angle = 0;
    S.guards[0].suspicion = 28;
    S.guards[1].x = 800;
    S.guards[1].y = 480;
    S.guards[1].angle = Math.PI;
    S.guards[1].suspicion = 12;
    S.timeLeft = 96;
    S.score = 0;
    S.screen = 'playing';
  } else if (name === 'cameras') {
    world.loadLevel(2);
    // A camera sweep cone and a guard cone overlapping near the Opal pedestal;
    // Wren at the control panel, alarm stage 1.
    S.thief.x = 70;
    S.thief.y = 360;
    S.thief.sneaking = false;
    S.thief.angle = 0;
    S.cameras[0].angle = S.cameras[0].base + 0.5;
    S.cameras[0].suspicion = 40;
    S.guards[0].x = 700;
    S.guards[0].y = 300;
    S.guards[0].angle = (Math.PI * 3) / 4;
    S.guards[0].suspicion = 22;
    S.alarm = 1;
    S.timeLeft = 140;
    S.score = 300;
    S.lootScore = 150;
    S.loot[0].taken = true;
    if (S.panel) S.panel.progress = 1.8;
    S.screen = 'playing';
  } else if (name === 'win') {
    world.loadLevel(2);
    // Level 3 complete: the Opal secured, 3 stars, ghost bonus, total score.
    S.opalTaken = true;
    S.loot.forEach((l) => {
      l.taken = true;
    });
    S.timeLeft = 64;
    S.ghost = true;
    S.lootScore = 150;
    S.levelScore = 640 + 500 + 150;
    S.levelStars = 3;
    S.score = 2740;
    S.screen = 'levelComplete';
  } else {
    throw new Error(`unknown shot: ${name}`);
  }
  S.frozen = true;
}
