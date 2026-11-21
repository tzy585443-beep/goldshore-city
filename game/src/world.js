// The city: its districts, roads, buildings and landmarks. The rules live here (no drawing, no browser)
// and the world is made once, with the seeded random, so a run is one city.

import { PALETTE, WORLD } from './config.js';

export const ROAD_H = [
  { y: 140, h: 26 },
  { y: 300, h: 26 },
  { y: 440, h: 26 },
];
export const ROAD_V = [
  { x: 160, w: 26 },
  { x: 400, w: 26 },
  { x: 640, w: 26 },
  { x: 880, w: 26 },
  { x: 1120, w: 26 },
];

const ZONES = [
  { name: 'Hillside', x0: 60, y0: 0, x1: 1220, y1: 100, tint: '#7c9a6d' },
  { name: 'Downtown', x0: 300, y0: 150, x1: 700, y1: 360, tint: '#a9bcd0' },
  { name: 'Old Market', x0: 0, y0: 120, x1: 180, y1: 400, tint: '#c99a6c' },
  { name: 'The Docks', x0: 180, y0: 370, x1: 330, y1: 560, tint: '#8b9aa8' },
  { name: 'The Piers', x0: 700, y0: 90, x1: 1280, y1: 430, tint: '#9db2c2' },
];

const LANDMARK_GLYPHS = {
  lighthouse: 'L',
  stall: 'M',
  pier: 'P',
  crane: 'C',
  villa: 'V',
  tower: 'T',
};

export function createWorld(random) {
  const buildings = [];
  for (const zone of ZONES) {
    for (let i = 0; i < 7; i += 1) {
      const w = 44 + random() * 52;
      const h = 34 + random() * 54;
      const x = zone.x0 + 10 + random() * Math.max(1, zone.x1 - zone.x0 - 20 - w);
      const y = zone.y0 + 10 + random() * Math.max(1, zone.y1 - zone.y0 - 20 - h);
      if (x + w > zone.x1 - 8 || y + h > zone.y1 - 8) break;
      buildings.push({ x, y, w, h, c: PALETTE.building[(i + Math.floor(random() * PALETTE.building.length)) % PALETTE.building.length] });
    }
  }
  const landmarks = [
    { x: 1180, y: 250, kind: 'lighthouse', label: 'Beacon Hill' },
    { x: 70, y: 260, kind: 'stall', label: 'Old Market' },
    { x: 1080, y: 470, kind: 'pier', label: 'The Piers' },
    { x: 180, y: 470, kind: 'crane', label: 'The Docks' },
    { x: 720, y: 60, kind: 'villa', label: 'Hillside' },
    { x: 480, y: 250, kind: 'tower', label: 'Downtown' },
  ];
  return { buildings, landmarks, zones: ZONES };
}

export function zoneAt(world, x, y) {
  for (const zone of world.zones) {
    if (x >= zone.x0 && x < zone.x1 && y >= zone.y0 && y < zone.y1) return zone;
  }
  return null;
}

/** Paint the city under whatever is on it: sky, harbor, district tints, roads, buildings. */
export function drawGround(ctx, world, cam) {
  const w = WORLD.width;
  const h = WORLD.height;
  const horizon = WORLD.landY;
  const sky = ctx.createLinearGradient(0, cam.y, 0, cam.y + h);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(cam.x, cam.y, w, h);
  const water = ctx.createLinearGradient(0, cam.y + horizon, 0, cam.y + h);
  water.addColorStop(0, PALETTE.water);
  water.addColorStop(1, PALETTE.waterDeep);
  ctx.fillStyle = water;
  ctx.fillRect(cam.x, cam.y + horizon, w, h - horizon);
  // The low bluffs and the beach in front of the harbor.
  ctx.fillStyle = PALETTE.sandDeep;
  ctx.fillRect(cam.x, cam.y + horizon - 90, w, 90);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(cam.x, cam.y + horizon - 90, w, 90);
  // District land tints between the roads.
  for (const zone of world.zones) {
    const x0 = Math.max(cam.x, zone.x0);
    const x1 = Math.min(cam.x + w, zone.x1);
    const y0 = Math.max(cam.y, zone.y0);
    const y1 = Math.min(cam.y + h, zone.y1);
    if (x1 - x0 < 4 || y1 - y0 < 4) continue;
    ctx.fillStyle = zone.tint;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  for (const road of ROAD_H) {
    const y = road.y - road.h / 2;
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(cam.x, cam.y + y, w, road.h);
    ctx.fillStyle = PALETTE.roadLine;
    ctx.fillRect(cam.x, cam.y + y + road.h / 2 - 2, w, 4);
  }
  for (const road of ROAD_V) {
    const x = road.x - road.w / 2;
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(cam.x + x, cam.y, road.w, h);
    ctx.fillStyle = PALETTE.roadLine;
    ctx.fillRect(cam.x + x + road.w / 2 - 2, cam.y, 4, h);
  }
  // Buildings.
  for (const b of world.buildings) {
    const x = Math.max(cam.x, b.x);
    const y = Math.max(cam.y, b.y);
    const bx = Math.min(cam.x + w, b.x + b.w);
    const by = Math.min(cam.y + h, b.y + b.h);
    if (bx - x < 2 || by - y < 2) continue;
    ctx.fillStyle = b.c;
    ctx.fillRect(x, y, bx - x, by - y);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    const rows = Math.max(1, Math.floor((by - y) / 26));
    const cols = Math.max(1, Math.floor((bx - x) / 34));
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) ctx.fillRect(x + 4 + c * 34, y + 6 + r * 26, 14, 12);
    }
  }
}

/** Paint one landmark glyph: a lighthouse, a market stall, a pier, a crane, a villa or a tower. */
export function drawLandmark(ctx, x, y, kind) {
  const px = x;
  const py = y;
  if (kind === 'lighthouse') {
    ctx.fillStyle = '#f4f7fa';
    ctx.fillRect(px - 4, py - 20, 8, 20);
    ctx.fillStyle = '#d64545';
    ctx.fillRect(px - 7, py - 24, 14, 6);
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(px, py - 26, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'stall') {
    ctx.fillStyle = '#8a5a34';
    ctx.fillRect(px - 26, py - 8, 52, 8);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(px - 30, py - 14, 60, 8);
  } else if (kind === 'pier') {
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(px - 30, py - 4, 60, 4);
    ctx.fillStyle = '#6b452a';
    ctx.fillRect(px - 30, py, 60, 6);
  } else if (kind === 'crane') {
    ctx.fillStyle = '#9aa7b5';
    ctx.fillRect(px - 3, py - 40, 6, 40);
    ctx.fillStyle = '#7c8896';
    ctx.fillRect(px - 12, py - 40, 24, 6);
    ctx.fillRect(px - 12, py - 12, 14, 6);
  } else if (kind === 'villa') {
    ctx.fillStyle = '#b08a5e';
    ctx.fillRect(px - 16, py - 12, 32, 12);
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(px - 20, py - 18, 40, 6);
  } else if (kind === 'tower') {
    ctx.fillStyle = '#c8d6e2';
    ctx.fillRect(px - 18, py - 40, 36, 40);
    ctx.fillStyle = '#8fa8c0';
    ctx.fillRect(px - 22, py - 44, 44, 6);
  }
}
