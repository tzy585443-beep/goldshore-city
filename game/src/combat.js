// Combat: top-down hitscan fire, tracers, muzzle flashes and the spark/puff particles of the city.
// The player shoots the Goldshore PD; their officers shoot back when a wanted level is active.
// Particles come from the run's seeded random, so a staged screenshot is repeatable.

import { SHOOT_RANGE, WORLD } from './config.js';

export function createCombat() {
  return { bullets: [], particles: [], muzzle: null };
}

function spark(state, x, y, color, count, power) {
  const random = state.random ?? Math.random;
  for (let i = 0; i < count; i += 1) {
    const life = 0.2 + random() * 0.25;
    state.combat.particles.push({
      x, y,
      vx: (random() - 0.5) * power,
      vy: (random() - 0.5) * power,
      life, maxLife: life,
      color, size: 1.5 + random() * 2.5,
    });
  }
}

/** Is a circular target within `radius` of the shot ray? */
function onRay(fromX, fromY, dx, dy, targetX, targetY, radius, reach) {
  const ox = targetX - fromX;
  const oy = targetY - fromY;
  const along = ox * dx + oy * dy;
  if (along < 0 || along > reach) return false;
  return Math.abs(ox * dy - oy * dx) < radius;
}

/**
 * Fire one shot. Without `skipId` this is the player firing at the police and the hit is returned.
 * With `skipId` it is an officer firing at the player: health is lost and a hurt cue is raised.
 */
export function fire(state, fromX, fromY, angle, damage, skipId) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const hostile = skipId !== undefined && skipId !== null;
  state.combat.bullets.push({ x: fromX + dx * 16, y: fromY + dy * 16, angle, damage, life: 0.5, maxLife: 0.5 });
  if (state.combat.muzzle === null) state.combat.muzzle = { x: fromX, y: fromY, angle, age: 0 };

  if (hostile) {
    const player = state.player;
    if (onRay(fromX, fromY, dx, dy, player.x, player.y, (player.radius ?? 10) + 7, SHOOT_RANGE)) {
      player.health = Math.max(0, player.health - damage);
      player.hurt = 0.35;
      spark(state, player.x, player.y, '#ff7a6b', 7, 130);
      state.cues.push('hurt');
      return { kind: 'player', x: player.x, y: player.y };
    }
    spark(state, fromX + dx * SHOOT_RANGE, fromY + dy * SHOOT_RANGE, '#f2c94c', 2, 50);
    return null;
  }

  let hit = null;
  let best = SHOOT_RANGE;
  for (const target of [...state.cops, ...state.copPeds]) {
    if (target === null || target.dead) continue;
    const radius = target.kind === 'car' ? 25 : 15;
    if (onRay(fromX, fromY, dx, dy, target.x, target.y, radius, best)) {
      best = Math.hypot(target.x - fromX, target.y - fromY);
      hit = target;
    }
  }
  const ix = hit === null ? fromX + dx * SHOOT_RANGE : hit.x;
  const iy = hit === null ? fromY + dy * SHOOT_RANGE : hit.y;
  spark(state, ix, iy, '#f2c94c', 4, 110);
  if (hit === null) return null;
  hit.dead = true;
  spark(state, hit.x, hit.y, (state.random ?? Math.random)() > 0.5 ? '#e5534b' : '#f2c94c', 10, 170);
  return hit;
}

/** Advance tracers, muzzle flashes and particles. */
export function combatStep(state, dt) {
  const combat = state.combat;
  if (combat.muzzle !== null) {
    combat.muzzle.age += dt;
    if (combat.muzzle.age > 0.08) combat.muzzle = null;
  }
  for (let i = combat.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = combat.bullets[i];
    bullet.life -= dt;
    bullet.x += Math.cos(bullet.angle) * 520 * dt;
    bullet.y += Math.sin(bullet.angle) * 520 * dt;
    if (bullet.life <= 0 || bullet.x < 0 || bullet.x > WORLD.width || bullet.y < 0 || bullet.y > WORLD.height) {
      combat.bullets.splice(i, 1);
    }
  }
  for (let i = combat.particles.length - 1; i >= 0; i -= 1) {
    const particle = combat.particles[i];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 1 - 2.5 * dt;
    particle.vy *= 1 - 2.5 * dt;
    if (particle.life <= 0) combat.particles.splice(i, 1);
  }
}
