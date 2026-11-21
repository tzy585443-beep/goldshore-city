// Drawing only: the Goldshore state and current screen go in, pixels come out. The 960x540
// camera view is scaled to the window; the renderer paints the city through a following camera,
// then the HUD (wanted stars, health, cash, mission and minimap) and the title/pause/end panels.

import { FONT, MISSIONS, WORLD } from './config.js';
import { ROAD_H, ROAD_V, drawGround, drawLandmark } from './world.js';
import { VIEW, currentDistrict } from './state.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const HUD_DARK = 'rgba(8, 22, 32, 0.84)';
const HUD_LINE = 'rgba(226, 240, 242, 0.16)';
const GOLD = '#f2c94c';

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function starPath(ctx, x, y, radius) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 === 0 ? radius : radius * 0.44;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  let pointer = { x: -1000, y: -1000 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(window.innerWidth * ratio));
    const height = Math.max(1, Math.round(window.innerHeight * ratio));
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function font(size, weight) {
    const key = `${weight ?? ''}/${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align = 'left', weight = '') {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function panel(x, y, w, h, fill = HUD_DARK, stroke = HUD_LINE) {
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke !== null) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function shadow(x, y, rx, ry) {
    ctx.fillStyle = 'rgba(12, 26, 34, 0.24)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 5, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function toCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function toWorld(clientX, clientY, camera) {
    const point = toCanvas(clientX, clientY);
    return {
      x: (point.x - view.x) / view.scale + camera.x,
      y: (point.y - view.y) / view.scale + camera.y,
    };
  }

  function drawSea(camera, time) {
    ctx.strokeStyle = 'rgba(226, 246, 250, 0.28)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 34; i += 1) {
      const x = camera.x + ((i * 167 + Math.sin(time * 0.4 + i) * 20) % WORLD.width);
      const y = WORLD.landY + 14 + ((i * 53) % 140);
      if (x < camera.x || x > camera.x + VIEW.width) continue;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 16 + (i % 4) * 7, y);
      ctx.stroke();
    }
  }

  // A warm, low coastal sun: a light wash over the whole slice and a glow over Beacon Hill.
  function drawSunlight(camera) {
    const wash = ctx.createLinearGradient(camera.x, camera.y, camera.x + VIEW.width, camera.y + VIEW.height);
    wash.addColorStop(0, 'rgba(255, 241, 199, 0.13)');
    wash.addColorStop(0.5, 'rgba(255, 248, 224, 0.04)');
    wash.addColorStop(1, 'rgba(255, 216, 154, 0.09)');
    ctx.fillStyle = wash;
    ctx.fillRect(camera.x, camera.y, WORLD.width, WORLD.height);
    const glow = ctx.createRadialGradient(1080, 40, 10, 1080, 40, 260);
    glow.addColorStop(0, 'rgba(255, 246, 196, 0.3)');
    glow.addColorStop(1, 'rgba(255, 246, 196, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(820, camera.y, 520, 520);
  }

  // Side faces and roof edges give the flat blocks some afternoon depth.
  function drawBuildingDepth(camera, buildings) {
    for (const b of buildings) {
      if (b.x + b.w < camera.x || b.x > camera.x + VIEW.width || b.y + b.h < camera.y || b.y > camera.y + VIEW.height) continue;
      ctx.fillStyle = 'rgba(20, 38, 48, 0.2)';
      ctx.fillRect(b.x + b.w - 7, b.y + 5, 7, b.h - 5);
      ctx.fillRect(b.x + 5, b.y + b.h - 6, b.w - 5, 6);
      ctx.fillStyle = 'rgba(255, 252, 236, 0.22)';
      ctx.fillRect(b.x, b.y, b.w, 3);
    }
  }

  // Palms along the beachfront: an original Goldshore touch, with a long afternoon shadow.
  function drawPalms(camera) {
    for (const x of [130, 290, 470, 650, 830, 1010, 1210]) {
      if (x < camera.x - 50 || x > camera.x + VIEW.width + 50) continue;
      const y = 508;
      ctx.strokeStyle = 'rgba(28, 46, 48, 0.2)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 34, y + 12);
      ctx.stroke();
      ctx.strokeStyle = '#7d5c3b';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 4, y - 24, x + 2, y - 44);
      ctx.stroke();
      ctx.strokeStyle = '#3f7d5f';
      ctx.lineWidth = 4;
      for (let frond = 0; frond < 6; frond += 1) {
        const angle = -Math.PI + frond * (Math.PI / 5);
        ctx.beginPath();
        ctx.moveTo(x + 2, y - 44);
        ctx.quadraticCurveTo(x + 2 + Math.cos(angle) * 18, y - 52 + Math.sin(angle) * 12, x + 2 + Math.cos(angle) * 30, y - 38 + Math.sin(angle) * 18);
        ctx.stroke();
      }
      ctx.fillStyle = '#8a6a43';
      ctx.beginPath();
      ctx.arc(x + 2, y - 41, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLandmarks(state) {
    for (const landmark of state.world.landmarks) {
      shadow(landmark.x, landmark.y, 24, 7);
      drawLandmark(ctx, landmark.x, landmark.y, landmark.kind);
      ctx.font = font(12);
      const width = ctx.measureText(landmark.label).width + 16;
      roundRectPath(ctx, landmark.x - width / 2, landmark.y + 10, width, 19, 6);
      ctx.fillStyle = 'rgba(9, 24, 34, 0.78)';
      ctx.fill();
      text(landmark.label, landmark.x, landmark.y + 24, 12, '#fff5d9', 'center', 'bold');
    }
  }

  function drawDrop(target, time) {
    const pulse = 1 + Math.sin(time * 4) * 0.1;
    ctx.fillStyle = 'rgba(242, 201, 76, 0.16)';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 30 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    text('DROP', target.x, target.y - 42, 14, GOLD, 'center', 'bold');
  }

  function drawCar(car, state) {
    if (car.dead) return;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    shadow(0, 0, 26, 12);
    ctx.fillStyle = car.cop ? '#f3f6f8' : (car.color ?? '#d9b64f');
    roundRectPath(ctx, -23, -12, 46, 24, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(18, 30, 38, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(44, 78, 98, 0.85)';
    ctx.fillRect(-5, -9, 14, 18);
    ctx.fillStyle = 'rgba(44, 78, 98, 0.6)';
    ctx.fillRect(-17, -9, 8, 18);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(-20, -11, 34, 3);
    ctx.fillStyle = '#ffe8a3';
    ctx.fillRect(20, -9, 3, 5);
    ctx.fillRect(20, 4, 3, 5);
    ctx.fillStyle = '#cf4f49';
    ctx.fillRect(-23, -9, 3, 5);
    ctx.fillRect(-23, 4, 3, 5);
    if (car.cop) {
      ctx.fillStyle = '#223a5b';
      ctx.fillRect(-13, -12, 8, 24);
      ctx.fillRect(6, -12, 8, 24);
      const flash = Math.sin(state.time * 15) > 0;
      ctx.fillStyle = flash ? '#ea4c43' : '#3d70d6';
      ctx.fillRect(-5, -15, 8, 5);
      ctx.fillStyle = flash ? '#3d70d6' : '#ea4c43';
      ctx.fillRect(2, -15, 8, 5);
      text('PD', 0, 5, 9, '#f6f9fb', 'center', 'bold');
    }
    ctx.restore();
  }

  function drawPed(ped, state, cop) {
    if (ped.down) {
      ctx.fillStyle = cop ? '#223a5b' : 'rgba(70, 90, 100, 0.8)';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const bob = Math.sin(state.time * 9 + ped.x * 0.1) * 1.1;
    shadow(ped.x, ped.y, 8, 4);
    ctx.fillStyle = cop ? '#223a5b' : (ped.color ?? '#4a7c94');
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 3 + bob, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#edc8a4';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 11 + bob, 3.8, 0, Math.PI * 2);
    ctx.fill();
    if (cop) {
      ctx.fillStyle = GOLD;
      ctx.fillRect(ped.x - 3, ped.y - 6 + bob, 6, 3);
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.inCar !== null) return;
    shadow(player.x, player.y, 10, 5);
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.fillStyle = player.hurt > 0 ? '#e5685c' : '#1f5f7a';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.fillRect(-6, -9, 12, 4);
    ctx.fillStyle = '#f0cda8';
    ctx.beginPath();
    ctx.arc(2, 0, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b343d';
    ctx.fillRect(9, -2, 15, 4);
    ctx.restore();
  }

  function drawCombat(state) {
    const combat = state.combat;
    ctx.lineWidth = 2;
    for (const bullet of combat.bullets) {
      ctx.strokeStyle = 'rgba(255, 238, 168, 0.95)';
      ctx.beginPath();
      ctx.moveTo(bullet.x, bullet.y);
      ctx.lineTo(bullet.x + Math.cos(bullet.angle) * 18, bullet.y + Math.sin(bullet.angle) * 18);
      ctx.stroke();
    }
    for (const particle of combat.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
    if (combat.muzzle !== null) {
      const m = combat.muzzle;
      ctx.fillStyle = '#fff2b0';
      starPath(ctx, m.x + Math.cos(m.angle) * 22, m.y + Math.sin(m.angle) * 22, 10);
      ctx.fill();
    }
  }

  function drawWorld(state) {
    const camera = state.camera;
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawGround(ctx, state.world, camera);
    drawSea(camera, state.time);
    drawSunlight(camera);
    drawBuildingDepth(camera, state.world.buildings);
    drawPalms(camera);

    for (const zone of state.world.zones) {
      text(zone.name.toUpperCase(), (zone.x0 + zone.x1) / 2, (zone.y0 + zone.y1) / 2, 13, 'rgba(255,255,255,0.36)', 'center', 'bold');
    }
    drawLandmarks(state);
    if (state.mission !== null && state.mission.kind === 'drive') drawDrop(MISSIONS[state.mission.index].target, state.time);

    for (const car of state.cars) drawCar(car, state);
    for (const car of state.cops) drawCar(car, state);
    for (const ped of state.peds) drawPed(ped, state, false);
    for (const ped of state.copPeds) drawPed(ped, state, true);
    drawPlayer(state);
    drawCombat(state);
    ctx.restore();
  }

  function drawMinimap(state) {
    const m = { x: 14, y: VIEW.height - 140, w: 190, h: 126 };
    panel(m.x, m.y, m.w, m.h, 'rgba(7, 20, 29, 0.88)');
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.x + 4, m.y + 4, m.w - 8, m.h - 8);
    ctx.clip();
    ctx.translate(m.x + 4, m.y + 4);
    ctx.scale((m.w - 8) / WORLD.width, (m.h - 8) / WORLD.height);
    ctx.fillStyle = '#293e47';
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = '#1d4e6b';
    ctx.fillRect(0, WORLD.landY, WORLD.width, WORLD.height - WORLD.landY);
    for (const zone of state.world.zones) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = zone.tint;
      ctx.fillRect(zone.x0, zone.y0, zone.x1 - zone.x0, zone.y1 - zone.y0);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#cdd3da';
    for (const road of ROAD_H) ctx.fillRect(0, road.y - road.h / 2, WORLD.width, road.h);
    for (const road of ROAD_V) ctx.fillRect(road.x - road.w / 2, 0, road.w, WORLD.height);
    ctx.fillStyle = GOLD;
    for (const landmark of state.world.landmarks) {
      ctx.beginPath();
      ctx.arc(landmark.x, landmark.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cars) {
      if (car.dead) continue;
      ctx.fillStyle = car === state.player.inCar ? GOLD : '#dfe8ea';
      ctx.fillRect(car.x - 13, car.y - 7, 26, 14);
    }
    for (const car of state.cops) {
      if (car.dead) continue;
      ctx.fillStyle = Math.sin(state.time * 15) > 0 ? '#e8483f' : '#4d82e6';
      ctx.fillRect(car.x - 15, car.y - 8, 30, 16);
    }
    ctx.fillStyle = '#e8483f';
    for (const ped of state.copPeds) if (!ped.dead) ctx.fillRect(ped.x - 5, ped.y - 5, 10, 10);
    if (state.mission !== null && state.mission.kind === 'drive') {
      const target = MISSIONS[state.mission.index].target;
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 28, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(state.player.x, state.player.y);
    ctx.rotate(state.player.angle);
    ctx.fillStyle = '#fff8dd';
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-14, -14);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    text('GOLDSHORE · LIVE MAP', m.x + 12, m.y + 17, 10, '#dce9eb', 'left', 'bold');
  }

  function wrap(value, maxWidth) {
    const words = value.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line === '' ? word : `${line} ${word}`;
      if (ctx.measureText(next).width > maxWidth && line !== '') {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line !== '') lines.push(line);
    return lines;
  }

  function drawMissionPanel(state) {
    const p = { x: VIEW.width - 322, y: VIEW.height - 126, w: 308, h: 112 };
    panel(p.x, p.y, p.w, p.h);
    text('CURRENT JOB', p.x + 14, p.y + 22, 11, GOLD, 'left', 'bold');
    const mission = state.mission;
    text(mission === null ? 'FREE ROAM' : `${mission.index + 1}/3  ${mission.title}`, p.x + 14, p.y + 44, 16, '#f4f8f7', 'left', 'bold');
    ctx.font = font(12.5);
    const objective = mission === null ? 'Explore Goldshore. Steal a car, take a job, stay ahead of the PD.' : mission.objective;
    const lines = wrap(objective, p.w - 28).slice(0, 2);
    lines.forEach((line, i) => text(line, p.x + 14, p.y + 64 + i * 16, 12.5, '#bcd0d5'));
    const status = state.player.inCar === null
      ? 'ON FOOT · E TO ENTER A CAR'
      : `DRIVING · ${Math.round(Math.abs(state.player.inCar.speed) * 1.4)} KM/H · E TO EXIT`;
    text(status, p.x + 14, p.y + 101, 11, '#8fa9b1');
  }

  function drawHud(state) {
    panel(14, 12, 250, 58);
    text('GOLDSHORE', 26, 34, 17, GOLD, 'left', 'bold');
    text(`CASH $${state.cash.toLocaleString()}   SCORE ${Math.round(state.score).toLocaleString()}`, 26, 56, 12.5, '#e9f2f3');

    panel(VIEW.width / 2 - 106, 12, 212, 46);
    text('WANTED', VIEW.width / 2, 29, 10.5, '#cbd9dd', 'center');
    for (let i = 0; i < 5; i += 1) {
      const x = VIEW.width / 2 - 54 + i * 27;
      starPath(ctx, x, 45, 10);
      ctx.fillStyle = i < state.wanted ? GOLD : 'rgba(232, 240, 240, 0.2)';
      ctx.fill();
    }

    panel(VIEW.width - 252, 12, 238, 58);
    text(currentDistrict(state).toUpperCase(), VIEW.width - 240, 32, 13, GOLD, 'left', 'bold');
    text('HP', VIEW.width - 240, 54, 11, '#cbd9dd', 'left');
    const bx = VIEW.width - 210;
    const by = 43;
    const bw = 180;
    roundRectPath(ctx, bx, by, bw, 12, 6);
    ctx.fillStyle = 'rgba(220, 232, 234, 0.18)';
    ctx.fill();
    const health = Math.max(0, state.player.health) / 100;
    if (health > 0) {
      roundRectPath(ctx, bx, by, Math.max(6, bw * health), 12, 6);
      ctx.fillStyle = health > 0.5 ? '#65c58a' : health > 0.25 ? '#e2b24c' : '#e26055';
      ctx.fill();
    }
    text(`${Math.max(0, Math.round(state.player.health))}`, VIEW.width - 22, 54, 11, '#e9f2f3', 'right');

    drawMinimap(state);
    drawMissionPanel(state);

    if (state.message !== '' && state.messageTimer > 0) {
      ctx.font = font(13);
      const width = Math.min(VIEW.width - 460, ctx.measureText(state.message).width + 34);
      const x = (VIEW.width - width) / 2;
      const y = VIEW.height - 162;
      panel(x, y, width, 32, 'rgba(7, 20, 29, 0.9)', 'rgba(242, 201, 76, 0.5)');
      text(state.message, VIEW.width / 2, y + 21, 13, '#fff2c9', 'center');
    }
  }

  function drawCrosshair() {
    if (pointer.x < -500) return;
    const point = toCanvas(pointer.x, pointer.y);
    ctx.strokeStyle = 'rgba(255, 248, 220, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
    ctx.moveTo(point.x - 15, point.y);
    ctx.lineTo(point.x - 5, point.y);
    ctx.moveTo(point.x + 5, point.y);
    ctx.lineTo(point.x + 15, point.y);
    ctx.moveTo(point.x, point.y - 15);
    ctx.lineTo(point.x, point.y - 5);
    ctx.moveTo(point.x, point.y + 5);
    ctx.lineTo(point.x, point.y + 15);
    ctx.stroke();
  }

  function dim() {
    ctx.fillStyle = 'rgba(4, 14, 23, 0.66)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function titlePanel(state) {
    const x = VIEW.width / 2;
    const y = 72;
    panel(170, y, 620, 292, 'rgba(6, 20, 30, 0.94)', 'rgba(242, 201, 76, 0.5)');
    ctx.fillStyle = 'rgba(242, 201, 76, 0.9)';
    ctx.fillRect(210, y + 22, 540, 3);
    text('GOLDSHORE', x, y + 92, 62, '#f7d77a', 'center', 'bold');
    text('A SUN-SOAKED COASTAL CRIME STORY', x, y + 118, 13, '#a9c8d2', 'center');
    text('MARA VOSS  ·  CHAPTER ONE: HARBOR RUN', x, y + 154, 15, '#f1f4f2', 'center', 'bold');
    text('WASD move  ·  E steal or exit a car  ·  Mouse aim + click shoot', x, y + 187, 13, '#bcd0d5', 'center');
    text('P pause  ·  M mute  ·  Outrun the Goldshore PD', x, y + 208, 13, '#bcd0d5', 'center');
    text(`SAVED  ${state.progress.missions}/3 MISSIONS  ·  BEST ${Math.round(state.progress.best)}`, x, y + 240, 13, GOLD, 'center');
    text('PRESS ENTER OR CLICK TO START', x, y + 272, 16, '#ffffff', 'center', 'bold');
  }

  function simplePanel(title, lines, prompt, state) {
    const x = VIEW.width / 2;
    const y = 126;
    panel(226, y, 508, 288, 'rgba(6, 20, 30, 0.94)', 'rgba(242, 201, 76, 0.45)');
    text(title, x, y + 82, 44, '#f7d77a', 'center', 'bold');
    lines.forEach((line, i) => text(line, x, y + 132 + i * 28, 15, '#c7d9dd', 'center'));
    text(prompt, x, y + 250, 15, '#ffffff', 'center', 'bold');
    text(`SCORE ${Math.round(state.score)}  ·  BEST ${Math.round(state.progress.best)}`, x, y + 272, 12, GOLD, 'center');
  }

  /** Paint one frame: the following camera over the city, the HUD, then a screen panel if needed. */
  function draw(state, screen) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#071420';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    drawWorld(state);
    if (screen !== SCREEN_PLAY) dim();
    drawHud(state);
    if (screen === SCREEN_TITLE) titlePanel(state);
    else if (screen === SCREEN_PAUSED) {
      simplePanel('PAUSED', ['Goldshore is holding its breath.', 'The traffic and the PD will wait.'], 'PRESS P TO RESUME', state);
    } else if (screen === SCREEN_OVER) {
      simplePanel(
        state.victory ? 'GOLDSHORE IS YOURS' : 'BUSTED',
        state.victory
          ? ['The Harbor Run is complete. The crew is clear.', 'Three jobs, one city, a quiet debt owed to Mara Voss.']
          : ['The Goldshore PD got their cuffs on you.', 'Your cash and missions are saved. Try a cleaner run.'],
        'PRESS ENTER OR CLICK FOR A NEW RUN',
        state,
      );
    }
    if (screen === SCREEN_PLAY) drawCrosshair();
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    toWorld,
    setPointer(x, y) {
      pointer = { x, y };
    },
    view,
  };
}
