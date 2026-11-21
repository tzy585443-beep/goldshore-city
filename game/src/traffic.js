// Pedestrians and traffic: bodies that move through the city while the player is elsewhere.

import { PED, WORLD } from './config.js';

/** A pedestrian walks a segment back and forth: {fromX, fromY, toX, toY} corners in world units. */
export function createPed(x, y, fromX, fromY, toX, toY) {
  return { x, y, angle: Math.atan2(y - fromY, x - fromX), fromX, fromY, toX, toY, speed: PED.speed };
}

/** Advance a pedestrian along its segment; turn around at either end. */
export function pedStep(ped, dt) {
  const dx = ped.toX - ped.fromX;
  const dy = ped.toY - ped.fromY;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  ped.x += ux * ped.speed * dt;
  ped.y += uy * ped.speed * dt;
  const dTo = Math.hypot(ped.x - ped.toX, ped.y - ped.toY);
  const dFrom = Math.hypot(ped.x - ped.fromX, ped.y - ped.fromY);
  if (dTo < 8 || dFrom < 8) {
    const fx = ped.fromX;
    const fy = ped.fromY;
    ped.fromX = ped.toX;
    ped.fromY = ped.toY;
    ped.toX = fx;
    ped.toY = fy;
  }
}

export function createPedestrians(random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const x = 40 + random() * (WORLD.width - 80);
    const y = 40 + random() * (WORLD.height - 120);
    peds.push(createPed(x, y, Math.max(20, x - 40), Math.max(20, y - 40), Math.min(WORLD.width - 20, x + 40), Math.min(WORLD.height - 20, y + 40)));
  }
  return peds;
}

/** The live traffic: driving cars plus wandering pedestrians. */
export function createTraffic(cars, peds) {
  return { cars, peds };
}

/** Advance traffic: peds walk (cars drive in the vehicle layer). */
export function trafficStep(state, dt) {
  for (const ped of state.traffic.peds) {
    if (!ped.down) pedStep(ped, dt);
  }
}
