// The Goldshore game state and its fixed-step simulation. One state object holds the city, the
// player (on foot or behind the wheel), traffic, the Goldshore PD, combat, the story and the camera.
// Nothing here draws and nothing here reads the keyboard: main.js hands in the controls for a step.

import { CAR, HEALTH, PED, WORLD } from './config.js';
import { createRandom } from './random.js';
import { zoneAt } from './world.js';
import { carHitsPed, carStep, createTraffic as createTrafficCars, trafficCarStep } from './vehicles.js';
import { createPedestrians, trafficStep } from './traffic.js';
import { addWanted, updatePolice } from './police.js';
import { combatStep, createCombat, fire } from './combat.js';
import { updateMission } from './missions.js';

/** The camera sees a zoomed-in slice of the 1280x720 city, so it follows the player. */
export const VIEW = { width: 960, height: 540 };

const CAR_COLORS = ['#d9b64f', '#c85b52', '#3f8f9e', '#e8e2d3', '#6b7f9c', '#c98b50', '#7d9c75', '#a875a0'];
const CLOTHES = ['#366b8c', '#a6534c', '#4f7b62', '#8a6a9c', '#b58946', '#496078'];

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function updateCamera(state, dt) {
  const targetX = clamp(state.player.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
  const targetY = clamp(state.player.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
  const ease = dt >= 1 ? 1 : 1 - Math.exp(-7 * dt);
  state.camera.x += (targetX - state.camera.x) * ease;
  state.camera.y += (targetY - state.camera.y) * ease;
}

/** A fresh, deterministic city and crew. `seed` makes the same run reproducible for screenshots. */
export function createState(world, seed, save) {
  const random = createRandom(seed ^ 0x5eed);
  const crowd = createRandom(seed ^ 0xa11ce);
  const cars = createTrafficCars(random, 16);
  cars.forEach((car, index) => {
    car.color = CAR_COLORS[index % CAR_COLORS.length];
    car.id = `traffic-${index}`;
    car.owned = false;
  });
  // A few parked cars near the starting street, so there is always something to steal.
  const parked = [
    { x: 860, y: 440, angle: 0 },
    { x: 700, y: 300, angle: Math.PI / 2 },
    { x: 400, y: 440, angle: 0 },
    { x: 1120, y: 440, angle: Math.PI },
  ];
  parked.forEach((spot, index) => {
    const car = cars[index];
    car.x = spot.x;
    car.y = spot.y;
    car.angle = spot.angle;
    car.speed = 0;
    car.state = 'park';
  });
  const peds = createPedestrians(crowd, 18);
  peds.forEach((ped, index) => {
    ped.color = CLOTHES[index % CLOTHES.length];
    ped.down = false;
  });

  const player = {
    x: 925, y: 490, angle: -Math.PI / 2, radius: PED.radius,
    health: HEALTH, inCar: null, hurt: 0, walk: 0,
  };
  const state = {
    world, seed, random, cars, peds, traffic: { peds },
    cops: [], copPeds: [], combat: createCombat(), player,
    wanted: 0, wantedTimer: 0, peaceTimer: 0,
    mission: null, ending: false, victory: false,
    message: '', messageTimer: 0, time: 0, distance: 0,
    cash: save?.cash ?? 0, score: 0,
    progress: { best: save?.best ?? 0, missions: save?.missions ?? 0, cars: 0 },
    save: save ?? { best: 0, missions: 0, cash: 0 },
    camera: { x: 0, y: 0 }, cues: [],
    cooldown: { crime: 0, shot: 0, damage: 0 },
  };
  state.combat.fire = (x, y, angle, damage, skipId) => fire(state, x, y, angle, damage, skipId);
  updateCamera(state, 1);
  return state;
}

function enterNearestCar(state) {
  const player = state.player;
  let nearest = null;
  let best = 58;
  for (const car of state.cars) {
    if (car.cop || car.dead) continue;
    const d = distance(player.x, player.y, car.x, car.y);
    if (d < best) {
      best = d;
      nearest = car;
    }
  }
  if (nearest === null) {
    state.message = 'No car close enough. Find a parked one.';
    state.messageTimer = 3;
    return;
  }
  player.inCar = nearest;
  player.x = nearest.x;
  player.y = nearest.y;
  player.angle = nearest.angle;
  nearest.speed = 0;
  if (!nearest.owned) {
    nearest.owned = true;
    state.progress.cars += 1;
    state.cash += 60;
    state.score += 150;
    state.message = 'Car stolen. Goldshore PD has been alerted.';
    state.messageTimer = 4;
    addWanted(state, 1);
    state.cues.push('crime');
  } else {
    state.message = 'Back in your car.';
    state.messageTimer = 2;
  }
  state.cues.push('enter');
}

function leaveCar(state) {
  const player = state.player;
  const car = player.inCar;
  if (car === null) return;
  const side = car.angle + Math.PI / 2;
  player.x = clamp(car.x + Math.cos(side) * 42, 12, WORLD.width - 12);
  player.y = clamp(car.y + Math.sin(side) * 42, 12, WORLD.landY - 12);
  player.angle = car.angle;
  player.inCar = null;
  car.speed *= 0.25;
  state.message = 'On foot. Watch the traffic.';
  state.messageTimer = 2.5;
  state.cues.push('enter');
}

function driveStep(state, controls, dt) {
  const car = state.player.inCar;
  const player = state.player;
  carStep(car, controls.throttle, dt);
  if (Math.abs(car.speed) > 4) {
    car.angle += controls.steer * CAR.turn * dt * Math.min(1, Math.abs(car.speed) / 90) * Math.sign(car.speed);
  }
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  const moved = Math.abs(car.speed) * dt;
  state.distance += moved;
  state.score += moved * 0.04;

  for (const ped of state.peds) {
    if (ped.down || !carHitsPed(car, ped)) continue;
    ped.down = true;
    state.score += 40;
    state.cues.push('crash');
    if (state.cooldown.crime <= 0) {
      addWanted(state, 1);
      state.cooldown.crime = 6;
      state.message = 'A witness saw that. Wanted level up.';
      state.messageTimer = 3;
      state.cues.push('crime');
    }
  }
  for (const other of state.cars) {
    if (other === car || other.dead) continue;
    if (distance(car.x, car.y, other.x, other.y) < CAR.width * 0.85) {
      car.speed *= 0.72;
      other.speed *= 0.6;
      if (state.cooldown.damage <= 0) {
        state.cooldown.damage = 0.4;
        state.cues.push('crash');
      }
    }
  }
  if (controls.enter) leaveCar(state);
}

function walkStep(state, controls, dt) {
  const player = state.player;
  let mx = controls.moveX;
  let my = controls.moveY;
  const length = Math.hypot(mx, my);
  if (length > 0) {
    mx /= length;
    my /= length;
    player.x = clamp(player.x + mx * PED.speed * dt, 12, WORLD.width - 12);
    player.y = clamp(player.y + my * PED.speed * dt, 12, WORLD.landY - 12);
    player.walk += dt * 11;
  }
  if (controls.aimX !== null && controls.aimY !== null) {
    player.angle = Math.atan2(controls.aimY - player.y, controls.aimX - player.x);
  }
  if (controls.enter) enterNearestCar(state);
}

function shootStep(state, controls) {
  if (!controls.fire || state.cooldown.shot > 0 || state.ending) return;
  state.cooldown.shot = 0.18;
  const player = state.player;
  const hit = state.combat.fire(player.x, player.y, player.angle, 34, null);
  state.cues.push('shot');
  if (state.cooldown.crime <= 0) {
    addWanted(state, 1);
    state.cooldown.crime = 6;
  }
  if (hit && hit !== true) {
    state.score += 250;
    state.cash += 40;
    addWanted(state, 1);
    state.message = hit.kind === 'car' ? 'Patrol car disabled.' : 'Officer down. Heat rising.';
    state.messageTimer = 3;
  }
}

/** Advance the whole Goldshore world by one fixed step. */
export function stepState(state, controls, dt) {
  state.time += dt;
  state.stepCount = (state.stepCount ?? 0) + 1;
  for (const key of Object.keys(state.cooldown)) state.cooldown[key] = Math.max(0, state.cooldown[key] - dt);
  state.player.hurt = Math.max(0, state.player.hurt - dt);
  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) state.message = '';
  }

  if (state.player.inCar !== null) driveStep(state, controls, dt);
  else walkStep(state, controls, dt);
  shootStep(state, controls);

  for (const car of state.cars) if (car !== state.player.inCar) trafficCarStep(car, dt);
  trafficStep(state, dt);

  if (state.wanted > 0) state.peaceTimer = 0;
  else state.peaceTimer += dt;
  updatePolice(state, dt);
  if (state.wanted === 0 && state.peaceTimer > 5) {
    state.cops.length = 0;
    state.copPeds.length = 0;
  }

  combatStep(state, dt);
  updateMission(state, dt);
  updateCamera(state, dt);
}

/** The district the player is standing (or driving) in, for the HUD. */
export function currentDistrict(state) {
  return zoneAt(state.world, state.player.x, state.player.y)?.name ?? 'Coast Road';
}
