// All drawing: marble floor, walls, cover, light pools and darkness, vision
// cones, guards, the thief, loot, HUD and every overlay. One canvas, 1280x720,
// procedural Canvas 2D only — no raster assets, no network fonts.
import { W, H, HUD_H, THIEF_R, COLORS } from './config.js';
import { mulberry32 } from './random.js';
import { dist } from './detection.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFloor(ctx, S) {
  const level = S.level;
  ctx.fillStyle = COLORS.floorA;
  ctx.fillRect(0, HUD_H, W, H - HUD_H);
  // Marble tiles with a seeded speckle so the floor is not flat.
  const rng = mulberry32(1000 + S.levelIndex * 77);
  ctx.strokeStyle = COLORS.floorLine;
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, HUD_H);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = HUD_H; y < H; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 260; i++) {
    const x = rng() * W;
    const y = HUD_H + rng() * (H - HUD_H);
    ctx.fillRect(x, y, 2, 2);
  }
  // Walls: dark slabs with a lit top edge.
  for (const w of level.walls) {
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = COLORS.wallTop;
    ctx.fillRect(w.x, w.y, w.w, 3);
  }
  // Room name, faint, on the floor.
  ctx.fillStyle = 'rgba(232,230,223,0.10)';
  ctx.font = `700 26px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(level.name.toUpperCase(), W / 2, H - 18);
}

function drawLights(ctx, S) {
  const level = S.level;
  // Shadow zones first: visibly darker floor.
  for (const s of level.shadows || []) {
    ctx.fillStyle = COLORS.shadow;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
    ctx.setLineDash([]);
  }
  // Light pools on top: cool moonlight, warm lamps.
  for (const l of level.lights || []) {
    const g = ctx.createRadialGradient(l.x, l.y, 8, l.x, l.y, l.r);
    const tone = l.tone === 'moon' ? '150,190,255' : '255,205,120';
    g.addColorStop(0, `rgba(${tone},0.20)`);
    g.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCover(ctx, S) {
  for (const c of S.level.cover) {
    if (c.kind === 'case') {
      ctx.fillStyle = COLORS.caseWood;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = COLORS.caseGlass;
      ctx.fillRect(c.x + 6, c.y + 6, c.w - 12, c.h - 12);
      ctx.strokeStyle = 'rgba(200,220,240,0.5)';
      ctx.strokeRect(c.x + 6, c.y + 6, c.w - 12, c.h - 12);
      // A glint inside the case.
      ctx.fillStyle = 'rgba(232,193,90,0.9)';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.kind === 'statue') {
      ctx.fillStyle = COLORS.statue;
      rr(ctx, c.x, c.y, c.w, c.h, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2 - 6, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.kind === 'column') {
      ctx.fillStyle = COLORS.column;
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2 - 5, c.y + c.h / 2 - 5, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.kind === 'curtain') {
      ctx.fillStyle = COLORS.curtain;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      for (let x = c.x + 10; x < c.x + c.w; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, c.y);
        ctx.lineTo(x, c.y + c.h);
        ctx.stroke();
      }
    } else if (c.kind === 'sarcophagus') {
      ctx.fillStyle = COLORS.sarcophagus;
      rr(ctx, c.x, c.y, c.w, c.h, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(232,193,90,0.8)';
      ctx.lineWidth = 2;
      rr(ctx, c.x + 8, c.y + 8, c.w - 16, c.h - 16, 4);
      ctx.stroke();
      ctx.lineWidth = 1;
    } else if (c.kind === 'pedestal') {
      ctx.fillStyle = COLORS.pedestal;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = COLORS.gold;
      ctx.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
    }
  }
}

function drawCone(ctx, x, y, angle, range, half, hot, disabled) {
  if (disabled) return;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - half, angle + half);
  ctx.closePath();
  ctx.fillStyle = hot ? COLORS.coneHot : COLORS.cone;
  ctx.fill();
  ctx.strokeStyle = hot ? COLORS.coneHotEdge : COLORS.coneEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawCones(ctx, S) {
  for (const g of S.guards) {
    if (!g.active) continue;
    drawCone(ctx, g.x, g.y, g.angle, g.range, g.half, g.suspicion >= 50, false);
  }
  for (const c of S.cameras) {
    const disabled = S.now < c.disabledUntil;
    drawCone(ctx, c.x, c.y, c.angle, c.range, c.half, c.suspicion >= 50, disabled);
  }
}

function drawExit(ctx, S) {
  const e = S.level.exit;
  const pulse = 0.5 + 0.3 * Math.sin(S.now * 3);
  ctx.fillStyle = `rgba(61,220,132,${0.15 + pulse * 0.2})`;
  ctx.fillRect(e.x - 6, e.y - 6, e.w + 12, e.h + 12);
  ctx.fillStyle = COLORS.exit;
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.fillStyle = '#0c0e13';
  ctx.font = `700 11px ${FONT}`;
  ctx.textAlign = 'center';
  if (e.w >= 48) {
    ctx.fillText('EXIT', e.x + e.w / 2, e.y + e.h / 2 + 4);
  } else {
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('EXIT', 0, 4);
    ctx.restore();
  }
  // Label above the door so the goal reads at a glance, clamped on-canvas.
  ctx.fillStyle = COLORS.exit;
  ctx.font = `700 12px ${FONT}`;
  const ly = e.y < 140 ? e.y + e.h + 18 : e.y - 10;
  const halfW = ctx.measureText(e.label).width / 2;
  const lx = Math.max(halfW + 8, Math.min(W - halfW - 8, e.x + e.w / 2));
  ctx.fillText(e.label, lx, ly);
}

function drawLoot(ctx, S) {
  for (const l of S.loot) {
    if (l.taken) continue;
    const pulse = 0.6 + 0.4 * Math.sin(S.now * 4 + l.x);
    ctx.fillStyle = `rgba(232,193,90,${0.25 * pulse})`;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 18 + 4 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.moveTo(l.x, l.y - 9);
    ctx.lineTo(l.x + 6, l.y);
    ctx.lineTo(l.x, l.y + 9);
    ctx.lineTo(l.x - 6, l.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.text;
    ctx.font = `600 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(l.label, l.x, l.y + 26);
  }
  // The Starlight Opal on its pedestal.
  if (S.level.opal && !S.opalTaken) {
    const o = S.level.opal;
    const pulse = 0.6 + 0.4 * Math.sin(S.now * 3);
    ctx.fillStyle = `rgba(150,220,255,${0.3 * pulse})`;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 24 + 5 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#bfe8ff';
    ctx.beginPath();
    ctx.moveTo(o.x, o.y - 11);
    ctx.lineTo(o.x + 8, o.y);
    ctx.lineTo(o.x, o.y + 11);
    ctx.lineTo(o.x - 8, o.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#dff4ff';
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('STARLIGHT OPAL', o.x, o.y - 30);
  }
}

function drawPanel(ctx, S) {
  if (!S.panel) return;
  const p = S.panel;
  ctx.fillStyle = '#1d2432';
  ctx.fillRect(p.x - 14, p.y - 18, 28, 36);
  ctx.strokeStyle = '#5a6a8a';
  ctx.strokeRect(p.x - 14, p.y - 18, 28, 36);
  ctx.fillStyle = '#7de3a8';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 6, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.text;
  ctx.font = `600 10px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('PANEL', p.x, p.y + 30);
  if (p.progress > 0) {
    ctx.strokeStyle = COLORS.exit;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 24, -Math.PI / 2, -Math.PI / 2 + (p.progress / 3) * Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}

function drawGuards(ctx, S) {
  for (const g of S.guards) {
    if (!g.active) continue;
    // Body: dark uniform with a light trim ring so it reads against the floor.
    ctx.fillStyle = COLORS.guardBody;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.guardTrim;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineWidth = 1;
    // Facing tick.
    ctx.strokeStyle = COLORS.guardTrim;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.angle) * 16, g.y + Math.sin(g.angle) * 16);
    ctx.stroke();
    // Suspicion marks.
    if (g.state === 'chase') {
      ctx.fillStyle = COLORS.red;
      ctx.font = `700 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - 20);
    } else if (g.suspicion >= 50) {
      ctx.fillStyle = COLORS.amber;
      ctx.font = `700 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('?', g.x, g.y - 20);
    }
  }
  for (const c of S.cameras) {
    const disabled = S.now < c.disabledUntil;
    ctx.fillStyle = disabled ? '#3a3f4a' : '#1d2432';
    ctx.fillRect(c.x - 10, c.y - 8, 20, 16);
    ctx.strokeStyle = disabled ? '#555' : '#8a94a8';
    ctx.strokeRect(c.x - 10, c.y - 8, 20, 16);
    ctx.fillStyle = disabled ? '#666' : COLORS.red;
    ctx.beginPath();
    ctx.arc(c.x + Math.cos(c.angle) * 12, c.y + Math.sin(c.angle) * 12, 3, 0, Math.PI * 2);
    ctx.fill();
    if (disabled) {
      ctx.fillStyle = COLORS.dim;
      ctx.font = `700 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('OFF', c.x, c.y - 16);
    } else if (c.suspicion >= 50) {
      ctx.fillStyle = COLORS.amber;
      ctx.font = `700 18px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('?', c.x, c.y - 18);
    }
  }
}

function drawThief(ctx, S) {
  const t = S.thief;
  // Soft shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(t.x, t.y + 8, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Charcoal coat, crimson scarf, white rim so Wren reads on dark floor.
  ctx.fillStyle = COLORS.thiefCoat;
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.sneaking ? 11 : THIEF_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,230,223,0.85)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.lineWidth = 1;
  // Scarf on the facing side.
  ctx.strokeStyle = COLORS.thiefScarf;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(t.x, t.y, 8, t.angle - 0.9, t.angle + 0.9);
  ctx.stroke();
  ctx.lineWidth = 1;
  // Direction tick.
  ctx.strokeStyle = COLORS.text;
  ctx.beginPath();
  ctx.moveTo(t.x, t.y);
  ctx.lineTo(t.x + Math.cos(t.angle) * 15, t.y + Math.sin(t.angle) * 15);
  ctx.stroke();
  // Sneaking: a dotted ring.
  if (t.sneaking) {
    ctx.strokeStyle = 'rgba(232,230,223,0.6)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(t.x, t.y, 19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Click-to-move target marker.
  if (S.moveTarget) {
    ctx.strokeStyle = 'rgba(232,230,223,0.7)';
    ctx.beginPath();
    ctx.arc(S.moveTarget.x, S.moveTarget.y, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(S.moveTarget.x - 12, S.moveTarget.y);
    ctx.lineTo(S.moveTarget.x + 12, S.moveTarget.y);
    ctx.moveTo(S.moveTarget.x, S.moveTarget.y - 12);
    ctx.lineTo(S.moveTarget.x, S.moveTarget.y + 12);
    ctx.stroke();
  }
}

function drawHUD(ctx, S) {
  ctx.fillStyle = COLORS.hud;
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'left';
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(`L${S.levelIndex + 1} · ${S.level.name}`, 16, 22);
  ctx.fillStyle = COLORS.dim;
  ctx.font = `400 12px ${FONT}`;
  ctx.fillText(S.level.objective, 16, 42);

  // Timer, centre.
  const t = Math.max(0, Math.ceil(S.timeLeft));
  const mm = String(Math.floor(t / 60));
  const ss = String(t % 60).padStart(2, '0');
  ctx.fillStyle = t <= 30 ? COLORS.red : COLORS.text;
  ctx.font = `700 22px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${mm}:${ss}`, W / 2, 36);

  // Right cluster: score, loot, suspicion eye, alarm pips.
  let rx = W - 16;
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.text;
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(`Score ${S.score}`, rx, 22);
  const taken = S.loot.filter((l) => l.taken).length;
  ctx.fillStyle = COLORS.gold;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(`◆ ${taken}/${S.loot.length}${S.level.opal ? (S.opalTaken ? ' · Opal ✓' : ' · Opal ✗') : ''}`, rx, 42);

  // Suspicion eye: the highest suspicion of any detector.
  const maxSusp = Math.max(
    0,
    ...S.guards.filter((g) => g.active).map((g) => g.suspicion),
    ...S.cameras.map((c) => c.suspicion),
  );
  const ex = W / 2 + 130;
  // A drawn eye (no emoji font dependency in headless renders).
  ctx.strokeStyle = maxSusp >= 50 ? COLORS.red : COLORS.amber;
  ctx.fillStyle = maxSusp >= 50 ? COLORS.red : COLORS.amber;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(ex + 8, 19, 9, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ex + 8, 19, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(ex + 22, 12, 90, 10);
  ctx.fillStyle = maxSusp >= 50 ? COLORS.red : COLORS.amber;
  ctx.fillRect(ex + 22, 12, 90 * (maxSusp / 100), 10);
  ctx.fillStyle = COLORS.dim;
  ctx.font = `400 11px ${FONT}`;
  ctx.fillText(maxSusp >= 50 ? 'SEEN' : 'HIDDEN', ex + 22, 42);

  // Alarm pips.
  const ax = W / 2 - 190;
  ctx.fillStyle = COLORS.dim;
  ctx.font = `700 11px ${FONT}`;
  ctx.fillText('ALARM', ax, 24);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < S.alarm ? COLORS.red : 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(ax + 58 + i * 18, 20, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = COLORS.dim;
  ctx.font = `400 11px ${FONT}`;
  ctx.fillText(S.alarm === 0 ? 'Calm' : S.alarm === 1 ? 'Suspicious' : 'Alert', ax, 42);
}

function drawMessage(ctx, S) {
  ctx.fillStyle = 'rgba(10,12,18,0.75)';
  const w = ctx.measureText(S.message).width + 32;
  rr(ctx, W / 2 - w / 2, H - 96, w, 34, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.text;
  ctx.font = `600 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(S.message, W / 2, H - 73);
}

function panelBox(ctx, w, h) {
  ctx.fillStyle = 'rgba(8,10,15,0.88)';
  rr(ctx, W / 2 - w / 2, H / 2 - h / 2, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,230,223,0.25)';
  ctx.stroke();
}

function drawMenu(ctx, S) {
  // A dimmed museum backdrop behind the title.
  ctx.fillStyle = '#141824';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#232a3c';
  for (let x = 0; x < W; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText('NIGHT AT THE', W / 2, 150);
  ctx.fillText('MERIDIAN MUSEUM', W / 2, 205);
  ctx.fillStyle = COLORS.gold;
  ctx.font = `400 18px ${FONT}`;
  ctx.fillText('A top-down stealth game — steal the Starlight Opal, leave unseen.', W / 2, 245);
  ctx.fillStyle = COLORS.dim;
  ctx.font = `400 15px ${FONT}`;
  ctx.fillText('WASD / arrows to move · Shift to sneak · Click to walk there', W / 2, 300);
  ctx.fillText('Stay out of the amber cones · Shadow hides you · Light exposes you', W / 2, 326);
  ctx.fillText('P pause · M mute · R restart the wing', W / 2, 352);
  ctx.fillStyle = COLORS.text;
  ctx.font = `700 16px ${FONT}`;
  ctx.fillText('Choose a wing — 1, 2 or 3 — or press Enter for the Grand Gallery', W / 2, 410);
  const names = ['1 · The Grand Gallery', '2 · The Hall of Antiquities', '3 · The Vault Wing'];
  names.forEach((n, i) => {
    ctx.fillStyle = i === 0 ? COLORS.gold : COLORS.dim;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(n, W / 2, 446 + i * 26);
  });
  if (S.best > 0) {
    ctx.fillStyle = COLORS.gold;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(`Best score: ${S.best}`, W / 2, 540);
  }
  ctx.fillStyle = COLORS.dim;
  ctx.font = `400 13px ${FONT}`;
  ctx.fillText('All art is drawn in code. All sounds are synthesized. No network needed.', W / 2, 580);
}

function drawPaused(ctx, S) {
  ctx.fillStyle = 'rgba(8,10,15,0.6)';
  ctx.fillRect(0, 0, W, H);
  panelBox(ctx, 420, 170);
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText('Paused', W / 2, H / 2 - 28);
  ctx.fillStyle = COLORS.dim;
  ctx.font = `400 15px ${FONT}`;
  ctx.fillText('P to resume · R to restart the wing · M to mute', W / 2, H / 2 + 8);
}

function drawCaught(ctx, S) {
  ctx.fillStyle = 'rgba(60,8,8,0.55)';
  ctx.fillRect(0, 0, W, H);
  panelBox(ctx, 560, 190);
  ctx.fillStyle = COLORS.red;
  ctx.textAlign = 'center';
  ctx.font = `700 32px ${FONT}`;
  ctx.fillText('Caught!', W / 2, H / 2 - 34);
  ctx.fillStyle = COLORS.text;
  ctx.font = `400 16px ${FONT}`;
  ctx.fillText('A guard drags you back to the door. Alarm +1, score −100.', W / 2, H / 2 + 4);
  ctx.fillStyle = COLORS.dim;
  ctx.font = `400 14px ${FONT}`;
  ctx.fillText(`Caught ${S.caughtCount} of 3 times in this wing.`, W / 2, H / 2 + 34);
}

function drawLevelComplete(ctx, S) {
  ctx.fillStyle = 'rgba(8,10,15,0.62)';
  ctx.fillRect(0, 0, W, H);
  panelBox(ctx, 560, 320);
  const cx = W / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(S.levelIndex === 2 ? 'The Starlight Opal is yours.' : 'Wing cleared.', cx, H / 2 - 108);
  // Stars.
  ctx.font = '34px sans-serif';
  let stars = '';
  for (let i = 0; i < 3; i++) stars += i < S.levelStars ? '★' : '☆';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(stars, cx, H / 2 - 62);
  ctx.fillStyle = COLORS.text;
  ctx.font = `400 16px ${FONT}`;
  const timeBonus = Math.round(S.timeLeft) * 10;
  ctx.fillText(`Time bonus  ${timeBonus}  ·  Ghost bonus  ${S.ghost ? 500 : 0}  ·  Loot  ${S.lootScore}`, cx, H / 2 - 18);
  ctx.fillStyle = COLORS.gold;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(`Wing score ${S.levelScore}  ·  Total ${S.score}`, cx, H / 2 + 18);
  ctx.fillStyle = COLORS.dim;
  ctx.font = `400 14px ${FONT}`;
  ctx.fillText(
    S.levelIndex === 2 ? 'Press Enter for the final tally.' : 'Press Enter for the next wing.',
    cx,
    H / 2 + 58,
  );
}

function drawWin(ctx, S) {
  ctx.fillStyle = 'rgba(8,10,15,0.7)';
  ctx.fillRect(0, 0, W, H);
  panelBox(ctx, 600, 360);
  const cx = W / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = `700 32px ${FONT}`;
  ctx.fillText('The Opal leaves the museum.', cx, H / 2 - 122);
  ctx.fillStyle = COLORS.text;
  ctx.font = `400 17px ${FONT}`;
  ctx.fillText('Wren slips into the night. Three wings, no alarms that mattered.', cx, H / 2 - 84);
  ctx.font = `700 24px ${FONT}`;
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(`Total score ${S.score}`, cx, H / 2 - 40);
  ctx.fillStyle = COLORS.text;
  ctx.font = `400 16px ${FONT}`;
  const ghostCount = S.ghosts.filter(Boolean).length;
  ctx.fillText(`Ghost wings: ${ghostCount} of 3`, cx, H / 2 - 4);
  ctx.fillText(`Stars: ${S.stars.map((s) => '★'.repeat(s) + '☆'.repeat(3 - s)).join('   ')}`, cx, H / 2 + 28);
  ctx.fillStyle = COLORS.dim;
  ctx.font = `400 14px ${FONT}`;
  ctx.fillText('Press R to play again.', cx, H / 2 + 68);
}

export function draw(ctx, S) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0c0e13';
  ctx.fillRect(0, 0, W, H);
  if (S.screen === 'menu') {
    drawMenu(ctx, S);
    return;
  }
  drawFloor(ctx, S);
  drawLights(ctx, S);
  drawCover(ctx, S);
  drawExit(ctx, S);
  drawCones(ctx, S);
  drawLoot(ctx, S);
  drawPanel(ctx, S);
  drawGuards(ctx, S);
  drawThief(ctx, S);
  drawHUD(ctx, S);
  if (S.message && S.now < S.messageUntil) drawMessage(ctx, S);
  if (S.screen === 'paused') drawPaused(ctx, S);
  else if (S.screen === 'caught') drawCaught(ctx, S);
  else if (S.screen === 'levelComplete') drawLevelComplete(ctx, S);
  else if (S.screen === 'win') drawWin(ctx, S);
}
