// The three levels of Night at the Meridian Museum.
// Plain data only, no logic: walls, cover, light pools, shadow, patrols,
// cameras, loot, the panel, the Opal, the exit and the start. The border
// walls are listed per level so the shape of each hall stays in one place.
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js';

const W = CANVAS_WIDTH;
const H = CANVAS_HEIGHT;
const T = 24; // border wall thickness

function borderWalls() {
  return [
    { x: 0, y: 0, w: W, h: T },
    { x: 0, y: H - T, w: W, h: T },
    { x: 0, y: 0, w: T, h: H },
    { x: W - T, y: 0, w: T, h: H },
  ];
}

// Level 1 — The Grand Gallery. Wide marble hall, two slow patrols, long
// display cases as cover, moonlight pools from tall windows.
const LEVEL_1 = {
  name: 'The Grand Gallery',
  objective: 'Cross the gallery. Reach the service door unseen.',
  timeLimit: 150,
  start: { x: 70, y: 360 },
  exit: { x: 1210, y: 322, w: 46, h: 76, label: 'Service Door' },
  walls: borderWalls(),
  cover: [
    { x: 300, y: 180, w: 220, h: 42, kind: 'case' },
    { x: 580, y: 180, w: 220, h: 42, kind: 'case' },
    { x: 300, y: 498, w: 220, h: 42, kind: 'case' },
    { x: 580, y: 498, w: 220, h: 42, kind: 'case' },
    { x: 880, y: 170, w: 42, h: 42, kind: 'statue' },
    { x: 880, y: 508, w: 42, h: 42, kind: 'statue' },
  ],
  lights: [
    { x: 400, y: 60, r: 110, kind: 'moon' },
    { x: 860, y: 60, r: 110, kind: 'moon' },
    { x: 640, y: 660, r: 100, kind: 'lamp' },
  ],
  shadows: [
    { x: 240, y: 300, w: 620, h: 120 },
    { x: 940, y: 300, w: 220, h: 120 },
  ],
  guards: [
    { waypoints: [[250, 120], [1030, 120]], speed: 70 },
    { waypoints: [[1030, 600], [250, 600]], speed: 70 },
  ],
  cameras: [],
  loot: [{ x: 640, y: 360, name: 'Jade Scarab' }],
  opal: null,
  panel: null,
};

// Level 2 — The Hall of Antiquities. Two routes: the main hall (shorter,
// two guards crossing at the centre) or the balcony corridor (longer,
// darker, one guard, more shadow).
const LEVEL_2 = {
  name: 'The Hall of Antiquities',
  objective: 'Two routes. The dark one is longer — and safer.',
  timeLimit: 180,
  start: { x: 70, y: 620 },
  exit: { x: 1180, y: 60, w: 60, h: 60, label: 'Stairwell' },
  walls: [
    ...borderWalls(),
    { x: 240, y: 150, w: 24, h: 200 }, // balcony wall, leaves a gap at the top
    { x: 1016, y: 370, w: 24, h: 200 }, // east partition, gap at the bottom
  ],
  cover: [
    { x: 340, y: 290, w: 38, h: 38, kind: 'column' },
    { x: 620, y: 290, w: 38, h: 38, kind: 'column' },
    { x: 900, y: 290, w: 38, h: 38, kind: 'column' },
    { x: 340, y: 430, w: 38, h: 38, kind: 'column' },
    { x: 620, y: 430, w: 38, h: 38, kind: 'column' },
    { x: 900, y: 430, w: 38, h: 38, kind: 'column' },
    { x: 860, y: 540, w: 150, h: 62, kind: 'sarcophagus' },
    { x: 240, y: 620, w: 240, h: 26, kind: 'curtain' },
    { x: 760, y: 620, w: 240, h: 26, kind: 'curtain' },
  ],
  lights: [
    { x: 640, y: 360, r: 150, kind: 'lamp' },
    { x: 1080, y: 120, r: 90, kind: 'lamp' },
  ],
  shadows: [
    { x: 40, y: 40, w: 1200, h: 100 }, // the dark balcony corridor
    { x: 40, y: 560, w: 500, h: 120 },
  ],
  guards: [
    { waypoints: [[300, 360], [980, 360]], speed: 85 },
    { waypoints: [[300, 440], [980, 440]], speed: 85 },
    { waypoints: [[260, 90], [1000, 90]], speed: 80 },
  ],
  cameras: [],
  loot: [
    { x: 500, y: 200, name: 'Gold Mask' },
    { x: 1080, y: 620, name: 'Ivory Figure' },
  ],
  opal: null,
  panel: null,
};

// Level 3 — The Vault Wing. Three guards, two sweeping cameras, a control
// panel that kills the nearest camera for 8 seconds, and the Starlight Opal
// on the central pedestal. Grabbing it trips the alarm at once.
const LEVEL_3 = {
  name: 'The Vault Wing',
  objective: 'Take the Opal. Then run — quietly.',
  timeLimit: 210,
  start: { x: 70, y: 360 },
  exit: { x: 600, y: 650, w: 80, h: 46, label: 'Skylight Window' },
  walls: [
    ...borderWalls(),
    { x: 420, y: 240, w: 24, h: 160 },
    { x: 836, y: 320, w: 24, h: 160 },
  ],
  cover: [
    { x: 300, y: 140, w: 150, h: 42, kind: 'case' },
    { x: 830, y: 140, w: 150, h: 42, kind: 'case' },
    { x: 300, y: 538, w: 150, h: 42, kind: 'case' },
    { x: 830, y: 538, w: 150, h: 42, kind: 'case' },
    { x: 180, y: 320, w: 42, h: 42, kind: 'statue' },
    { x: 1058, y: 320, w: 42, h: 42, kind: 'statue' },
    { x: 560, y: 560, w: 60, h: 40, kind: 'crate' },
    { x: 660, y: 560, w: 60, h: 40, kind: 'crate' },
  ],
  lights: [
    { x: 640, y: 360, r: 130, kind: 'lamp' },
    { x: 200, y: 100, r: 90, kind: 'lamp' },
    { x: 1080, y: 100, r: 90, kind: 'lamp' },
  ],
  shadows: [
    { x: 40, y: 480, w: 300, h: 180 },
    { x: 940, y: 480, w: 300, h: 180 },
    { x: 480, y: 40, w: 320, h: 80 },
  ],
  guards: [
    { waypoints: [[260, 120], [1020, 120]], speed: 90 },
    { waypoints: [[1020, 600], [260, 600]], speed: 90 },
    { waypoints: [[1100, 200], [1100, 520]], speed: 85 },
  ],
  cameras: [
    { x: 640, y: 34, baseDir: Math.PI / 2, sweep: 1.1, range: 260, speed: 0.55 },
    { x: 1246, y: 360, baseDir: Math.PI, sweep: 1.0, range: 260, speed: 0.7 },
  ],
  loot: [{ x: 1080, y: 620, name: 'Silver Astrolabe' }],
  opal: { x: 640, y: 360 },
  panel: { x: 60, y: 360 },
};

export const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3];
