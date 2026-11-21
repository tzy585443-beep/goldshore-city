// Deterministic screenshot scenes behind ?shot=cover|drive|wanted|mission. Each scene starts from
// the same seeded city, sets up a real situation with the game's own rules, plays a few fixed steps
// (with a simple autopilot for the steering and firing) and returns the screen to draw. The frame
// is therefore a real game frame, and the same seed always produces the same frame.

import { STEP } from './config.js';
import { addWanted } from './police.js';
import { startMission } from './missions.js';
import { stepState } from './state.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const idle = {
  moveX: 0, moveY: 0, throttle: 0, steer: 0, fire: false,
  enter: false, aimX: null, aimY: null,
};

function advance(state, steps, controls) {
  for (let i = 0; i < steps; i += 1) stepState(state, { ...idle, ...controls }, STEP);
}

function placeCar(car, x, y, angle, speed) {
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  car.state = 'park';
}

function drive(state, car) {
  state.player.inCar = car;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
}

/** Stage one named scene and return which screen to paint over it. */
export function stageShot(name, state) {
  if (name === 'drive') {
    const car = state.cars[1];
    placeCar(car, 610, 300, 0.08, 195);
    drive(state, car);
    startMission(state, 0);
    advance(state, 28, { throttle: 1, steer: 0.01 });
    state.message = 'Harbor Run · get the package to the Old Market drop.';
    state.messageTimer = 20;
    return { screen: SCREEN_PLAY };
  }

  if (name === 'wanted') {
    const car = state.cars[2];
    placeCar(car, 690, 300, 0.1, 210);
    drive(state, car);
    startMission(state, 0);
    addWanted(state, 4);
    const spots = [
      { x: 840, y: 345, angle: Math.PI + 0.3 },
      { x: 520, y: 250, angle: 0.5 },
      { x: 300, y: 440, angle: 0.1 },
    ];
    state.cops.forEach((cop, i) => {
      const spot = spots[i % spots.length];
      placeCar(cop, spot.x, spot.y, spot.angle, 100);
      cop.dead = false;
    });
    state.copPeds.forEach((ped, i) => {
      ped.x = 790 + i * 55;
      ped.y = 250 - i * 40;
      ped.dead = false;
    });
    advance(state, 12, { throttle: 1, steer: 0.02, fire: true, aimX: 900, aimY: 330 });
    state.message = 'Goldshore PD in pursuit · five stars and closing in.';
    state.messageTimer = 20;
    return { screen: SCREEN_PLAY };
  }

  if (name === 'mission') {
    state.player.x = 130;
    state.player.y = 300;
    state.player.health = 82;
    startMission(state, 1);
    addWanted(state, 2);
    state.cops.forEach((cop, i) => placeCar(cop, 360 + i * 180, 440, Math.PI, 80));
    state.copPeds.forEach((ped, i) => {
      ped.x = 205 + i * 52;
      ped.y = 255 + (i % 2) * 70;
      ped.dead = false;
    });
    advance(state, 18, { fire: true, aimX: 230, aimY: 280 });
    state.message = 'Market Vigil · hold Stall 12 against the harbor crew.';
    state.messageTimer = 20;
    return { screen: SCREEN_PLAY };
  }

  // The cover: Mara Voss in the downtown streets, the city and the live map behind the title.
  state.player.x = 520;
  state.player.y = 330;
  state.player.angle = -0.35;
  startMission(state, 0);
  advance(state, 36, { aimX: 760, aimY: 240 });
  state.message = '';
  state.messageTimer = 0;
  return { screen: SCREEN_TITLE };
}
