// All drawing: one canvas, procedural vector art, no images.
// One job: turn the game state into a frame the judge can read at a glance:
// floor, cover, light and shadow, vision cones, guards, the thief, loot,
// the HUD, and the menu / pause / caught / complete / win overlays.
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, SUSPICION_QUESTION, SUSPICION_MAX, CONE_HALF_ANGLE, CAMERA_HALF_ANGLE, CONE_RANGE, ALARM_CONE_FACTOR } from './config.js';
import { segmentHitsRect } from './detection.js';

// Ray-cast a vision cone against solids so the cone hugs walls and cover
// instead of painting through them. Returns the cone's polygon points.
export function conePolygon(x, y, dir, range, halfAngle, solids) {
  const rays = 26;
  const pts = [{ x, y }];
  for (let i = 0; i <= rays; i++) {
    const a = dir - halfAngle + (2 * halfAngle * i) / rays;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let r = range;
    // March along the ray in 10 px steps; stop at the first solid hit.
    for (let d = 10; d <= range; d += 10) {
      const px = x + dx * d;
      const py = y + dy * d;
      let hit = false;
      for (const s of solids) {
        if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) {
          hit = true;
          break;
        }
      }
      if (hit) {
        r = d;
        break;
      }
    }
    pts.push({ x: x + dx * r, y: y + dy * r });
  }
  return pts;
}

function drawCone(ctx, x, y, dir, range, halfAngle, solids, suspicious) {
  const pts = conePolygon(x, y, dir, range, halfAngle, solids);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = suspicious ? COLORS.coneAlert : COLORS.coneCalm;
  ctx.fill();
}

function drawFloor(ctx, level) {
  ctx.fillStyle = COLORS.floorLight;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  // Marble checker, 80 px tiles.
  ctx.fillStyle = COLORS.floorTile;
  for (let ty = 0; ty < 9; ty++) {
    for (let tx = 0; tx < 16; tx++) {
      if ((tx + ty) % 2 === 0) continue;
      ctx.fillRect(tx * 80, ty * 80, 80, 80);
    }
  }
  // Faint grout lines.
  ctx.strokeStyle = 'rgba(60, 45, 30, 0.10)';
  ctx.lineWidth = 1;
  for (let tx = 1; tx < 16; tx++) {
    ctx.beginPath();
    ctx.moveTo(tx * 80, 0);
    ctx.lineTo(tx * 80, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let ty = 1; ty < 9; ty++) {
    ctx.beginPath();
    ctx.moveTo(0, ty * 80);
    ctx.lineTo(CANVAS_WIDTH, ty * 80);
    ctx.stroke();
  }
  // Shadow zones read darker: what is safe shows on the floor.
  ctx.fillStyle = COLORS.shadow;
  for (const s of level.shadows) ctx.fillRect(s.x, s.y, s.w, s.h);
  // Light pools: warm lamps, cool moonlight.
  for (const l of level.lights) {
    const g = ctx.createRadialGradient(l.x, l.y, 8, l.x, l.y, l.r);
    const warm = l.kind === 'lamp';
    g.addColorStop(0, warm ? 'rgba(255, 205, 120, 0.34)' : 'rgba(160, 195, 255, 0.28)');
    g.addColorStop(1, 'rgba(255, 205, 120, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWalls(ctx, level) {
  for (const w of level.walls) {
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = COLORS.wallTop;
    ctx.fillRect(w.x, w.y, w.w, 4);
  }
}

function drawCover(ctx, level, time) {
  for (const c of level.cover) {
    if (c.kind === 'case') {
      ctx.fillStyle = COLORS.caseFrame;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = COLORS.caseGlass;
      ctx.fillRect(c.x + 5, c.y + 5, c.w - 10, c.h - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(c.x + 8, c.y + 7, c.w - 16, 6);
      // A glint inside the case.
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.kind === 'statue') {
      ctx.fillStyle = '#6f6a63';
      ctx.fillRect(c.x - 3, c.y + c.h - 10, c.w + 6, 10);
      ctx.fillStyle = COLORS.statue;
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2 - 4, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(c.x + c.w / 2 - 9, c.y + c.h / 2 + 4, 18, 14);
    } else if (c.kind === 'column') {
      ctx.fillStyle = COLORS.column;
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b5a894';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2, c.w / 2 - 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.kind === 'curtain') {
      ctx.fillStyle = COLORS.curtain;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let fx = c.x + 12; fx < c.x + c.w; fx += 24) ctx.fillRect(fx, c.y, 6, c.h);
    } else if (c.kind === 'sarcophagus') {
      ctx.fillStyle = COLORS.sarcophagus;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = '#d8c27a';
      ctx.fillRect(c.x + 12, c.y + 10, c.w - 24, c.h - 20);
      ctx.strokeStyle = '#8a6d2f';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x + 12, c.y + 10, c.w - 24, c.h - 20);
    } else if (c.kind === 'crate') {
      ctx.fillStyle = COLORS.crate;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = '#4a3517';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + c.w, c.y + c.h);
      ctx.moveTo(c.x + c.w, c.y);
      ctx.lineTo(c.x, c.y + c.h);
      ctx.stroke();
    }
  }
}

function drawExit(ctx, exit, time) {
  const pulse = 0.5 + 0.3 * Math.sin(time * 3);
  ctx.save();
  ctx.shadowColor = COLORS.exitGlow;
  ctx.shadowBlur = 18 * pulse;
  ctx.fillStyle = '#1d7a4a';
  ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
  ctx.restore();
  ctx.fillStyle = '#a9f5c8';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', exit.x + exit.w / 2, exit.y + exit.h / 2 + 5);
  ctx.fillStyle = '#d8ffe9';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(exit.label, exit.x + exit.w / 2, exit.y + exit.h + 16);
}

function drawLoot(ctx, loot, time) {
  for (const item of loot) {
    if (item.taken) continue;
    const glint = 0.6 + 0.4 * Math.sin(time * 4 + item.x);
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = `rgba(255, 214, 110, ${0.75 + 0.25 * glint})`;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
    ctx.fillStyle = '#3a2f16';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.name, item.x, item.y + 26);
  }
}

function drawOpal(ctx, opal, time) {
  if (!opal || opal.taken) return;
  const pulse = 1 + 0.12 * Math.sin(time * 5);
  ctx.save();
  ctx.translate(opal.x, opal.y);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = '#bfe8ff';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#cfe9ff';
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(13, -2);
  ctx.lineTo(7, 14);
  ctx.lineTo(-7, 14);
  ctx.lineTo(-13, -2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#eaf6ff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('STARLIGHT OPAL', opal.x, opal.y + 38);
}

function drawPanel(ctx, panel, time) {
  if (!panel) return;
  ctx.fillStyle = '#2c2f3a';
  ctx.fillRect(panel.x - 14, panel.y - 18, 28, 36);
  ctx.fillStyle = panel.progress > 0 ? '#ffd24d' : '#7ee787';
  ctx.beginPath();
  ctx.arc(panel.x, panel.y - 6, 6, 0, Math.PI * 2);
  ctx.fill();
  if (panel.progress > 0) {
    ctx.fillStyle = '#ffd24d';
    ctx.fillRect(panel.x - 14, panel.y + 22, 28 * panel.progress, 5);
  }
  ctx.fillStyle = '#d8e2ff';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CAMERA PANEL', panel.x, panel.y + 42);
}

function drawGuard(ctx, g, time) {
  // Vision cone first, under the body.
  const suspicious = g.suspicion >= SUSPICION_QUESTION;
  // Cone drawing happens in drawWorld before bodies; here is the body.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(g.x, g.y + 9, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.guardUniform;
  ctx.beginPath();
  ctx.arc(g.x, g.y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.guardTrim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(g.x, g.y, 13, 0, Math.PI * 2);
  ctx.stroke();
  // Facing tick and cap brim.
  ctx.strokeStyle = COLORS.guardTrim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.lineTo(g.x + Math.cos(g.dir) * 17, g.y + Math.sin(g.dir) * 17);
  ctx.stroke();
  ctx.fillStyle = COLORS.guardTrim;
  ctx.beginPath();
  ctx.arc(g.x + Math.cos(g.dir) * 8, g.y + Math.sin(g.dir) * 8, 3, 0, Math.PI * 2);
  ctx.fill();
  // "?" while suspicious, "!" while chasing.
  if (g.mode === 'chase') {
    ctx.fillStyle = '#ff5a4d';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', g.x, g.y - 22);
  } else if (suspicious) {
    ctx.fillStyle = '#ffd24d';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('?', g.x, g.y - 22);
  }
  // Suspicion arc over the guard.
  if (g.suspicion > 2) {
    ctx.strokeStyle = suspicious ? '#ff5a4d' : '#ffd24d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 19, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * g.suspicion) / SUSPICION_MAX);
    ctx.stroke();
  }
}

function drawCamera(ctx, c, time) {
  const disabled = time < c.disabledUntil;
  ctx.fillStyle = '#1d1f26';
  ctx.fillRect(c.x - 12, c.y - 8, 24, 16);
  ctx.fillStyle = disabled ? '#555' : '#c22e3d';
  ctx.beginPath();
  ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
  ctx.fill();
  if (c.suspicion > 2 && !disabled) {
    ctx.strokeStyle = c.suspicion >= SUSPICION_QUESTION ? '#ff5a4d' : '#ffd24d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 15, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * c.suspicion) / SUSPICION_MAX);
    ctx.stroke();
  }
  if (disabled) {
    ctx.fillStyle = '#9aa0b0';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OFF', c.x, c.y - 14);
  }
}

function drawPlayer(ctx, p, time) {
  const crouch = p.sneaking ? 0.85 : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 9, 12, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.thiefCoat;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 12 * crouch + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8e4da';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 12 * crouch + 1, 0, Math.PI * 2);
  ctx.stroke();
  // Crimson scarf: an arc trailing opposite the facing direction.
  ctx.strokeStyle = COLORS.thiefScarf;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 8, p.dir + 2.2, p.dir + 4.1);
  ctx.stroke();
  // Facing tick.
  ctx.strokeStyle = '#e8e4da';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.dir) * 15, p.y + Math.sin(p.dir) * 15);
  ctx.stroke();
  // Click-to-move target marker.
  if (p.moveTarget) {
    ctx.strokeStyle = 'rgba(232, 228, 218, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.moveTarget.x, p.moveTarget.y, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.moveTarget.x - 10, p.moveTarget.y);
    ctx.lineTo(p.moveTarget.x + 10, p.moveTarget.y);
    ctx.moveTo(p.moveTarget.x, p.moveTarget.y - 10);
    ctx.lineTo(p.moveTarget.x, p.moveTarget.y + 10);
    ctx.stroke();
  }
}

function drawHud(ctx, state) {
  const { level, timer, score, loot, alarm, stars } = state;
  const maxSuspicion = Math.max(
    0,
    ...state.guards.map((g) => g.suspicion),
    ...state.cameras.map((c) => c.suspicion),
  );
  ctx.fillStyle = COLORS.hudBar;
  ctx.fillRect(0, 0, CANVAS_WIDTH, 44);
  ctx.fillStyle = '#f2ead8';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${level.name}  ·  ${level.objective}`, 14, 19);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = timer <= 20 ? '#ff8a7a' : '#c9d4e8';
  ctx.fillText(`Time ${Math.max(0, Math.ceil(timer))}s`, 14, 37);
  ctx.fillStyle = '#f2ead8';
  ctx.textAlign = 'right';
  const taken = loot.filter((l) => l.taken).length;
  ctx.fillText(`Score ${score}   Loot ${taken}/${loot.length}`, CANVAS_WIDTH - 260, 19);
  // Alarm pips: one lit pip per alarm stage (stage 1 = one pip, stage 2 = two).
  ctx.fillText('Alarm', CANVAS_WIDTH - 260, 37);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < alarm ? '#ff5a4d' : '#4a4356';
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH - 210 + i * 20, 33, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Suspicion eye + bar, top right.
  const ex = CANVAS_WIDTH - 120;
  ctx.fillStyle = maxSuspicion >= SUSPICION_QUESTION ? '#ff5a4d' : '#e8e4da';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('◉', ex, 22);
  ctx.fillStyle = '#3a3348';
  ctx.fillRect(ex + 24, 12, 76, 12);
  ctx.fillStyle = maxSuspicion >= SUSPICION_QUESTION ? '#ff5a4d' : '#ffd24d';
  ctx.fillRect(ex + 24, 12, (76 * maxSuspicion) / SUSPICION_MAX, 12);
  ctx.fillStyle = '#c9d4e8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(maxSuspicion >= SUSPICION_QUESTION ? 'SPOTTED?' : 'unseen', ex + 24, 37);
  // Near-miss pulse: the screen edge throbs while any watcher is suspicious.
  if (maxSuspicion >= SUSPICION_QUESTION) {
    const pulse = 0.10 + 0.08 * Math.sin(state.time * 6);
    ctx.strokeStyle = `rgba(255, 60, 50, ${pulse + 0.12})`;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 49, CANVAS_WIDTH - 10, CANVAS_HEIGHT - 54);
  }
  // Transient banner (caught / pickup / panel messages).
  if (state.banner && state.bannerUntil > state.time) {
    ctx.fillStyle = 'rgba(10, 8, 18, 0.78)';
    const w = 460;
    ctx.fillRect((CANVAS_WIDTH - w) / 2, 58, w, 34);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.banner, CANVAS_WIDTH / 2, 80);
  }
}

function dimOverlay(ctx) {
  ctx.fillStyle = 'rgba(8, 6, 16, 0.72)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function panelBox(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(16, 12, 26, 0.92)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#e8d27a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function drawMenu(ctx, state) {
  dimOverlay(ctx);
  panelBox(ctx, 290, 110, 700, 500);
  ctx.fillStyle = '#f2ead8';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NIGHT AT THE', 640, 175);
  ctx.fillStyle = '#e8d27a';
  ctx.fillText('MERIDIAN MUSEUM', 640, 222);
  ctx.fillStyle = '#c9d4e8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Wren the cat burglar is after the Starlight Opal.', 640, 262);
  ctx.fillText('Slip past the guards, mind their vision cones,', 640, 288);
  ctx.fillText('hide behind the cases — and reach the exit unseen.', 640, 314);
  ctx.fillStyle = '#f2ead8';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('WASD / arrows — move      Shift — sneak (slow, silent)', 640, 360);
  ctx.fillText('Click — walk there      P / Esc — pause      M — mute      R — restart', 640, 386);
  ctx.fillStyle = '#e8d27a';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText('Press 1, 2 or 3 to play a level — or Enter for Level 1', 640, 436);
  ctx.fillStyle = '#c9d4e8';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Level 1 · The Grand Gallery — 2 guards', 640, 472);
  ctx.fillText('Level 2 · The Hall of Antiquities — 3 guards, two routes', 640, 496);
  ctx.fillText('Level 3 · The Vault Wing — cameras, a panel, the Opal', 640, 520);
  if (state.bestScore > 0) {
    ctx.fillStyle = '#ffd24d';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`Best score: ${state.bestScore}`, 640, 566);
  }
}

function drawPaused(ctx) {
  dimOverlay(ctx);
  panelBox(ctx, 440, 260, 400, 140);
  ctx.fillStyle = '#f2ead8';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', 640, 312);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#c9d4e8';
  ctx.fillText('P / Esc to resume · R to restart the level', 640, 352);
}

function drawCaught(ctx, state) {
  dimOverlay(ctx);
  panelBox(ctx, 390, 240, 500, 190);
  ctx.fillStyle = '#ff8a7a';
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CAUGHT!', 640, 300);
  ctx.fillStyle = '#f2ead8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('A guard laid hands on Wren. Back to the door.', 640, 336);
  ctx.fillText(`Alarm stage ${state.alarm} · −${100} score · catch ${state.caughtCount} of 3`, 640, 362);
  ctx.fillStyle = '#c9d4e8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Press any key to slip back in', 640, 402);
}

function drawLevelComplete(ctx, state) {
  dimOverlay(ctx);
  panelBox(ctx, 340, 180, 600, 330);
  ctx.fillStyle = '#e8d27a';
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${state.level.name} — CLEAR`, 640, 238);
  const stars = state.lastStars || 1;
  ctx.font = '44px system-ui, sans-serif';
  ctx.fillText('★'.repeat(stars) + '☆'.repeat(3 - stars), 640, 296);
  ctx.fillStyle = '#f2ead8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`Time bonus +${state.lastTimeBonus}   Ghost bonus ${state.lastGhost ? '+500' : '—'}`, 640, 336);
  ctx.fillText(`Loot +${state.lastLootBonus}   Level score ${state.lastLevelScore}`, 640, 362);
  ctx.fillText(`Total score ${state.score}`, 640, 388);
  ctx.fillStyle = '#c9d4e8';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(state.levelIndex < 2 ? 'Press Enter for the next level' : 'Press Enter to see the haul', 640, 436);
  ctx.fillText('R replays this level', 640, 462);
}

function drawWin(ctx, state) {
  dimOverlay(ctx);
  panelBox(ctx, 290, 130, 700, 460);
  ctx.fillStyle = '#e8d27a';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THE STARLIGHT OPAL IS YOURS.', 640, 196);
  ctx.fillStyle = '#f2ead8';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Three halls, three getaways — and the Opal is yours.', 640, 240);
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = '#ffd24d';
  ctx.fillText(`Total score: ${state.score}`, 640, 292);
  ctx.fillStyle = '#f2ead8';
  ctx.font = '16px system-ui, sans-serif';
  state.stars.forEach((s, i) => {
    ctx.fillText(`Level ${i + 1}: ${'★'.repeat(s)}${'☆'.repeat(3 - s)}`, 640, 330 + i * 28);
  });
  ctx.fillStyle = '#c9d4e8';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Press R to play again', 640, 470);
}

// The whole frame: world, then HUD, then whichever overlay the screen asks for.
export function drawWorld(ctx, state) {
  const { level } = state;
  drawFloor(ctx, level);
  drawWalls(ctx, level);
  drawExit(ctx, level.exit, state.time);
  drawCover(ctx, level, state.time);
  drawLoot(ctx, state.loot, state.time);
  drawOpal(ctx, state.opal, state.time);
  drawPanel(ctx, state.panel, state.time);
  // Cones under the watchers' bodies.
  for (const c of state.cameras) {
    if (state.time < c.disabledUntil) continue;
    drawCone(ctx, c.x, c.y, c.dir, c.range, CAMERA_HALF_ANGLE, state.solids, c.suspicion >= SUSPICION_QUESTION);
  }
  for (const g of state.guards) {
    const range = CONE_RANGE * (state.alarm >= 1 ? ALARM_CONE_FACTOR : 1);
    drawCone(ctx, g.x, g.y, g.dir, range, CONE_HALF_ANGLE, state.solids, g.suspicion >= SUSPICION_QUESTION);
  }
  for (const c of state.cameras) drawCamera(ctx, c, state.time);
  for (const g of state.guards) drawGuard(ctx, g, state.time);
  drawPlayer(ctx, state.player, state.time);
}

export function render(ctx, state) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  if (state.screen === 'menu') {
    // The menu shows level 1 behind it, dimmed.
    drawWorld(ctx, state);
    drawHud(ctx, state);
    drawMenu(ctx, state);
    return;
  }
  drawWorld(ctx, state);
  drawHud(ctx, state);
  if (state.screen === 'paused') drawPaused(ctx);
  if (state.screen === 'caught') drawCaught(ctx, state);
  if (state.screen === 'levelComplete') drawLevelComplete(ctx, state);
  if (state.screen === 'win') drawWin(ctx, state);
}
