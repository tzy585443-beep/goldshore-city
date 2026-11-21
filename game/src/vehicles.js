// Cars: the player's stolen cars, the traffic pool and the car physics.

import { CAR, WORLD } from './config.js';

export function createCar(x, y, angle) {
  return { x, y, angle, speed: 0, width: CAR.width, height: CAR.height };
}

export function carRect(car) {
  return { x: car.x - car.width / 2, y: car.y - car.height / 2, w: car.width, h: car.height };
}

/** One car update: throttle in -1..1, the fixed step, clamped to the world. */
export function carStep(car, throttle, dt) {
  if (throttle > 0) car.speed = Math.min(CAR.maxSpeed, car.speed + CAR.accel * throttle * dt);
  else if (throttle < 0) car.speed = Math.max(-CAR.maxSpeed, car.speed - CAR.accel * Math.abs(throttle) * dt);
  else if (Math.abs(car.speed) > 1) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR.brake * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const half = Math.max(car.width, car.height) / 2 + 4;
  car.x = Math.max(half, Math.min(WORLD.width - half, car.x));
  car.y = Math.max(half, Math.min(WORLD.height - half, car.y));
}

export function carStop(car) {
  car.speed = 0;
}

/** The traffic pool: cars driving between waypoints, parked ones sitting as obstacles. */
export function createTraffic(random, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const car = createCar((random() - 0.5) * (WORLD.width - 120), (random() - 0.5) * (WORLD.height - 160), angle);
    car.speed = 0;
    car.state = random() > 0.35 ? 'drive' : 'park';
    if (car.state === 'drive') {
      car.tx = 60 + random() * (WORLD.width - 160);
      car.ty = 60 + random() * (WORLD.height - 180);
      car.throttle = 0;
    }
    cars.push(car);
  }
  return cars;
}

/** Drive a traffic car toward its waypoint; returns when it gets there. */
export function trafficCarStep(car, dt) {
  if (car.state === 'park') return;
  const dx = car.tx - car.x;
  const dy = car.ty - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 10) {
    car.state = 'park';
    car.speed = 0;
    return;
  }
  let angle = Math.atan2(dy, dx);
  car.angle = angle;
  car.throttle = Math.min(1, (CAR.maxSpeed * 0.85) / Math.max(30, d));
  carStep(car, car.throttle, dt);
}

/** Does the car's body overlap the ped's circle? */
export function carHitsPed(car, ped) {
  const rect = carRect(car);
  const cx = car.x;
  const cy = car.y;
  const nx = Math.abs(cx - ped.x);
  const ny = Math.abs(cy - ped.y);
  const rx = car.width / 2 + ped.radius;
  const ry = car.height / 2 + ped.radius;
  return nx < rx && ny < ry;
}
