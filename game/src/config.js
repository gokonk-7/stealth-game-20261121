// Shared tuning constants for Night at the Meridian Museum.
// One job: every number the game balances on lives here.
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

export const PLAYER_RADIUS = 12;
export const PLAYER_WALK_SPEED = 130; // px per second
export const PLAYER_SNEAK_SPEED = 70; // px per second, silent
export const GUARD_RADIUS = 13;
export const GUARD_CHASE_SPEED = 150; // px per second
export const GUARD_CATCH_DISTANCE = 27; // touching the thief ends the run

export const CONE_RANGE = 220; // guard vision cone length, px
export const CONE_HALF_ANGLE = (32 * Math.PI) / 180; // guard vision cone half-angle
export const CAMERA_RANGE = 260;
export const CAMERA_HALF_ANGLE = (28 * Math.PI) / 180;

export const SUSPICION_MAX = 100;
export const SUSPICION_QUESTION = 50; // at this level the guard shows "?" and the edge pulses
export const SUSPICION_DECAY = 12; // per second while unseen
export const SUSPICION_RISE_BASE = 55; // per second at point-blank range, before factors
export const LIGHT_FACTOR = 1.5; // standing in a light pool
export const SHADOW_FACTOR = 0.6; // standing in shadow
export const SNEAK_FACTOR = 0.6; // sneaking while seen
export const ALARM_SUSPICION_FACTOR = 1.2; // alarm stage 1 multiplier
export const ALARM_SPEED_FACTOR = 1.15; // alarm stage 1 guard speed multiplier
export const ALARM_CONE_FACTOR = 1.1; // alarm stage 1 cone range multiplier

export const CHASE_GIVE_UP_SECONDS = 3; // unseen this long and the guard returns to patrol
export const PANEL_HOLD_SECONDS = 3; // stand by the panel this long to kill a camera
export const PANEL_DISABLE_SECONDS = 8; // how long a disabled camera stays dark
export const CAMERA_ALERT_COOLDOWN = 5; // seconds after a camera trips the alarm

export const LOOT_SCORE = 150;
export const GHOST_BONUS = 500;
export const CAUGHT_PENALTY = 100;
export const MAX_CAUGHT_PER_LEVEL = 3; // third catch restarts the level

export const COLORS = {
  floorLight: '#b8a88a',
  floorDark: '#a8977a',
  floorTile: '#c4b49a',
  wall: '#3d3348',
  wallTop: '#574a68',
  caseGlass: '#7fb3c8',
  caseFrame: '#5d4a2f',
  statue: '#9a938a',
  column: '#8a7f74',
  curtain: '#7a2e3a',
  sarcophagus: '#6b5a34',
  crate: '#6e5233',
  lampLight: 'rgba(255, 196, 110, 0.20)',
  moonLight: 'rgba(150, 190, 255, 0.16)',
  shadow: 'rgba(10, 8, 24, 0.34)',
  coneCalm: 'rgba(255, 176, 66, 0.20)',
  coneAlert: 'rgba(255, 60, 50, 0.30)',
  guardUniform: '#23202e',
  guardTrim: '#e8d27a',
  thiefCoat: '#26262e',
  thiefScarf: '#c22e3d',
  exitGlow: '#58d68d',
  hudBar: '#17131f',
};
