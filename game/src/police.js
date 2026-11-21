// Wanted levels and the police: stars, cop cars that pursue and hold the line, cop pedestrians that shoot.

import { COP, WANTED } from './config.js';
import { carStep, createCar } from './vehicles.js';

let copSeq = 1;

export function createCopCar(x, y, angle) {
  const car = createCar(x, y, angle);
  car.cop = true;
  car.kind = 'car';
  car.id = copSeq;
  copSeq += 1;
  car.state = 'chase';
  return car;
}

/** Raise the wanted level and put the Goldshore PD after the player. */
export function addWanted(state, amount) {
  state.wanted = Math.min(WANTED.max, state.wanted + amount);
  state.wantedTimer = 0;
  if (state.wanted > 0) {
    spawnCops(state);
    // Officers on the beat join the pursuit when the alert goes out.
    if (state.copPeds.filter((p) => !p.dead).length < 2) state.copPeds.push(...createCopPeds(2));
  }
}

export function spawnCops(state) {
  const cops = state.cops;
  if (cops.filter((c) => !c.dead).length >= 3) return;
  const spots = [
    { x: 80, y: 300, angle: 0 },
    { x: 1200, y: 380, angle: Math.PI },
    { x: 640, y: 120, angle: Math.PI / 2 },
  ];
  for (const spot of spots) {
    if (cops.filter((c) => !c.dead).length >= 3) break;
    const car = createCopCar(spot.x, spot.y, spot.angle);
    cops.push(car);
  }
}

export function createCopPeds(count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    peds.push({ cop: true, kind: 'ped', id: copSeq + i, dead: false, x: 200 + i * 160, y: 200 + (i % 3) * 90, fromX: 160, fromY: 160, toX: 1000, toY: 500, speed: COP.speed, angle: 0, lastShot: 0 });
  }
  return peds;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Advance the wanted level and the police: cops pursue, then hold the line (blockade). */
export function updatePolice(state, dt) {
  state.wantedTimer += dt;
  const player = state.player;
  const px = player.x;
  const py = player.y;

  const alive = state.cops.filter((c) => !c.dead);
  const nearCop = alive.some((c) => dist(c.x, c.y, px, py) < WANTED.copDistance) || state.copPeds.some((p) => !p.dead && dist(p.x, p.y, px, py) < WANTED.copDistance);
  if (!nearCop && state.wanted > 0) {
    if (state.wantedTimer > WANTED.decayAfter) {
      state.wanted = Math.max(0, state.wanted - 1);
      state.wantedTimer = 0;
    }
  } else {
    state.wantedTimer = 0;
  }

  // Cop cars: drive at the player and hold the line.
  for (const cop of state.cops) {
    if (cop.dead || state.wanted <= 0) continue;
    const d = dist(cop.x, cop.y, px, py);
    if (cop.state === 'chase') {
      if (d < 70) {
        cop.speed = 0;
        continue;
      }
      cop.angle = Math.atan2(py - cop.y, px - cop.x);
      cop.throttle = Math.min(1, (60 / (d || 1)) * 0.9);
      carStep(cop, cop.throttle, dt);
      cop.x = Math.max(30, Math.min(1250, cop.x));
      cop.y = Math.max(30, Math.min(690, cop.y));
    }
  }

  // Cop pedestrians: pursue the player and shoot when they have them.
  for (const ped of state.copPeds) {
    if (ped.dead || state.wanted <= 0) continue;
    const d = dist(ped.x, ped.y, px, py);
    const stepLen = Math.min(ped.speed * dt * (state.wanted > 0 ? 2.2 : 1), d);
    ped.x += ((px - ped.x) / (d || 1)) * stepLen;
    ped.y += ((py - ped.y) / (d || 1)) * stepLen;
    ped.angle = Math.atan2(py - ped.y, px - ped.x);
    ped.lastShot -= dt;
    if (d < COP.shootRange && ped.lastShot <= 0 && state.wanted > 0) {
      ped.lastShot = 0.25;
      const angle = Math.atan2(py - ped.y, px - ped.x);
      state.combat.fire(ped.x, ped.y, angle, COP.damage, ped.id);
    }
  }
}
