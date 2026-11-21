// The story: three missions with objectives, rewards, and the flow from one to the next.
// Mara Voss and her crew work their way from the harbor to the hills of Goldshore.

import { MISSIONS } from './config.js';
import { addWanted } from './police.js';

export function startMission(state, index) {
  const mission = MISSIONS[index];
  state.mission = {
    index, stage: 'active', id: mission.id, title: mission.title, where: mission.where,
    objective: mission.objective, kind: mission.kind,
    wavesLeft: mission.kind === 'defend' ? mission.waves : 0,
  };
  state.ending = false;
  state.message = `Mission ${index + 1}: ${mission.title}. ${mission.objective}`;
  state.messageTimer = 6;
  state.cues.push('mission');
  if (mission.kind === 'lose' && state.wanted <= 0) addWanted(state, 3);
}

export function completeMission(state) {
  const completed = state.mission.index + 1;
  state.progress.missions = Math.max(state.progress.missions, completed);
  state.cash += 250;
  state.score += 1000;
  state.cues.push('mission');
  const next = completed;
  if (next >= MISSIONS.length) {
    state.ending = true;
    state.victory = true;
    state.mission = null;
    state.message = 'The crew is clear. Goldshore owes you a quiet debt, Mara Voss.';
    state.messageTimer = 12;
    return;
  }
  startMission(state, next);
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Advance the active mission: drive to a drop point, survive the vigil, lose the cops. */
export function updateMission(state, dt) {
  const m = state.mission;
  if (m === null) return;
  const player = state.player;
  if (m.kind === 'drive') {
    const target = MISSIONS[m.index].target;
    if (dist(player.x, player.y, target.x, target.y) < 80) completeMission(state);
  } else if (m.kind === 'defend') {
    // Survive each wave: when the defending cops are gone, the next one arrives.
    const alive = state.copPeds.filter((p) => !p.dead).length;
    if (m.wavesLeft > 0 && alive === 0) {
      m.wavesLeft -= 1;
      if (m.wavesLeft <= 0) completeMission(state);
      else spawnWave(state, m.wavesLeft);
    }
  } else if (m.kind === 'lose') {
    if (state.wanted <= 0) completeMission(state);
  }
}

export function spawnWave(state, waves) {
  for (let i = 0; i < waves; i += 1) {
    const id = 9000 + Math.floor((state.random ?? Math.random)() * 900);
    state.copPeds.push({
      cop: true, kind: 'ped', id, dead: false,
      x: 250 + i * 200, y: 250 + (i % 2) * 120,
      fromX: 160, fromY: 160, toX: 1000, toY: 520,
      speed: 92, angle: 0, lastShot: 0,
    });
  }
  state.cues.push('crime');
}
