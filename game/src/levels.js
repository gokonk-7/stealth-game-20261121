// The three wings of the Meridian Museum. Pure data — no logic here.
// Coordinates are canvas pixels (1280x720). The HUD bar covers y 0..56;
// the museum floor runs from the north wall (y 56) to the south wall (y 696).
// walls: solid rects that block movement and sight.
// cover: tall furniture that blocks movement and sight; kind decides the drawing.
// lights: pools where detection runs 1.5x (moonlight cool, lamp warm).
// shadows: dark zones where detection runs 0.6x.
// guards: patrol paths, speed px/s, cone range px, cone half-angle radians.
// reserve: one extra guard, asleep until the alarm reaches stage 2.
// cameras: fixed pivots sweeping a cone; they never chase, they raise the alarm.
// panel: stand next to it for 3 s to power down the nearest camera for 8 s.
// loot: optional side artefacts, +150 each. opal: the level-3 objective.

export const LEVELS = [
  {
    name: 'The Grand Gallery',
    objective: 'Cross the gallery. Reach the service door unseen.',
    timeLimit: 150,
    walls: [
      { x: 0, y: 56, w: 1280, h: 24 },
      { x: 0, y: 696, w: 1280, h: 24 },
      { x: 0, y: 56, w: 24, h: 664 },
      { x: 1256, y: 56, w: 24, h: 274 },
      { x: 1256, y: 390, w: 24, h: 330 },
    ],
    cover: [
      { x: 300, y: 220, w: 180, h: 60, kind: 'case' },
      { x: 800, y: 220, w: 180, h: 60, kind: 'case' },
      { x: 300, y: 460, w: 180, h: 60, kind: 'case' },
      { x: 800, y: 460, w: 180, h: 60, kind: 'case' },
      { x: 600, y: 150, w: 44, h: 44, kind: 'statue' },
      { x: 600, y: 520, w: 44, h: 44, kind: 'statue' },
    ],
    lights: [
      { x: 400, y: 140, r: 95, tone: 'moon' },
      { x: 880, y: 140, r: 95, tone: 'moon' },
      { x: 640, y: 360, r: 110, tone: 'lamp' },
    ],
    shadows: [
      { x: 100, y: 560, w: 380, h: 120 },
      { x: 800, y: 560, w: 380, h: 120 },
    ],
    guards: [
      { path: [[200, 300], [1080, 300]], speed: 70, range: 220, half: 0.56 },
      { path: [[1080, 430], [200, 430]], speed: 70, range: 220, half: 0.56 },
    ],
    reserve: { path: [[1100, 300], [1100, 430]], speed: 90, range: 220, half: 0.56 },
    cameras: [],
    panel: null,
    loot: [{ x: 640, y: 620, label: 'Jade Scarab' }],
    opal: null,
    start: { x: 80, y: 388 },
    exit: { x: 1232, y: 330, w: 24, h: 60, label: 'SERVICE DOOR' },
  },
  {
    name: 'The Hall of Antiquities',
    objective: 'Two routes. The dark one is longer — and safer.',
    timeLimit: 180,
    walls: [
      { x: 0, y: 56, w: 1280, h: 24 },
      { x: 0, y: 696, w: 1280, h: 24 },
      { x: 0, y: 56, w: 24, h: 664 },
      { x: 1256, y: 56, w: 24, h: 664 },
      { x: 24, y: 560, w: 276, h: 24 },
      { x: 380, y: 560, w: 520, h: 24 },
      { x: 980, y: 560, w: 276, h: 24 },
    ],
    cover: [
      { x: 420, y: 220, w: 36, h: 36, kind: 'column' },
      { x: 860, y: 220, w: 36, h: 36, kind: 'column' },
      { x: 420, y: 420, w: 36, h: 36, kind: 'column' },
      { x: 860, y: 420, w: 36, h: 36, kind: 'column' },
      { x: 200, y: 92, w: 120, h: 28, kind: 'curtain' },
      { x: 960, y: 92, w: 120, h: 28, kind: 'curtain' },
      { x: 580, y: 330, w: 120, h: 64, kind: 'sarcophagus' },
    ],
    lights: [
      { x: 640, y: 300, r: 130, tone: 'lamp' },
      { x: 240, y: 140, r: 90, tone: 'moon' },
      { x: 1040, y: 140, r: 90, tone: 'moon' },
    ],
    shadows: [
      { x: 24, y: 584, w: 1232, h: 112 },
      { x: 1040, y: 440, w: 200, h: 100 },
    ],
    guards: [
      { path: [[300, 300], [980, 300]], speed: 85, range: 230, half: 0.56 },
      { path: [[980, 480], [300, 480]], speed: 85, range: 230, half: 0.56 },
      { path: [[200, 640], [1080, 640]], speed: 75, range: 220, half: 0.56 },
    ],
    reserve: { path: [[1080, 140], [1180, 240]], speed: 90, range: 220, half: 0.56 },
    cameras: [],
    panel: null,
    loot: [
      { x: 200, y: 130, label: 'Gold Mask' },
      { x: 1080, y: 130, label: 'Ivory Figure' },
    ],
    opal: null,
    start: { x: 80, y: 388 },
    exit: { x: 1180, y: 80, w: 52, h: 52, label: 'STAIRWELL' },
  },
  {
    name: 'The Vault Wing',
    objective: 'Take the Opal. Then run — quietly.',
    timeLimit: 210,
    walls: [
      { x: 0, y: 56, w: 1280, h: 24 },
      { x: 0, y: 56, w: 24, h: 664 },
      { x: 1256, y: 56, w: 24, h: 664 },
      { x: 0, y: 696, w: 616, h: 24 },
      { x: 664, y: 696, w: 616, h: 24 },
    ],
    cover: [
      { x: 300, y: 200, w: 160, h: 56, kind: 'case' },
      { x: 820, y: 200, w: 160, h: 56, kind: 'case' },
      { x: 300, y: 480, w: 160, h: 56, kind: 'case' },
      { x: 820, y: 480, w: 160, h: 56, kind: 'case' },
      { x: 640, y: 180, w: 36, h: 36, kind: 'column' },
      { x: 640, y: 520, w: 36, h: 36, kind: 'column' },
      { x: 620, y: 340, w: 40, h: 40, kind: 'pedestal' },
    ],
    lights: [
      { x: 640, y: 360, r: 150, tone: 'lamp' },
      { x: 300, y: 120, r: 80, tone: 'moon' },
      { x: 980, y: 120, r: 80, tone: 'moon' },
    ],
    shadows: [
      { x: 80, y: 560, w: 300, h: 120 },
      { x: 900, y: 560, w: 300, h: 120 },
    ],
    guards: [
      { path: [[240, 300], [1040, 300]], speed: 90, range: 230, half: 0.56 },
      { path: [[1040, 420], [240, 420]], speed: 90, range: 230, half: 0.56 },
      { path: [[560, 130], [560, 590]], speed: 85, range: 230, half: 0.56 },
    ],
    reserve: { path: [[560, 600], [720, 600]], speed: 90, range: 220, half: 0.56 },
    cameras: [
      { x: 400, y: 80, base: Math.PI / 2, sweep: 0.7, speed: 0.5, range: 260, half: 0.49 },
      { x: 880, y: 664, base: -Math.PI / 2, sweep: 0.7, speed: 0.42, range: 260, half: 0.49 },
    ],
    panel: { x: 48, y: 360 },
    loot: [{ x: 1080, y: 120, label: 'Silver Astrolabe' }],
    opal: { x: 640, y: 360 },
    start: { x: 80, y: 388 },
    exit: { x: 616, y: 672, w: 48, h: 24, label: 'SKYLIGHT' },
  },
];
