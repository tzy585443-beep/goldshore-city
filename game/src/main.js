// Goldshore boots here: one loop reads mouse and keyboard, advances the city in fixed 1/60 s
// steps (several in a slow frame, none in a fast one) and paints the result. The screens are
// title, play, paused and over. ?seed=N fixes the city; ?shot=cover|drive|wanted|mission stages
// a deterministic scene, paints it twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, HEALTH, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_FIRE, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { createState, stepState } from './state.js';
import { startMission } from './missions.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

/** The save is JSON now: best score, story progress and cash under the original key. */
function readSave() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    if (raw === null) return { best: 0, missions: 0, cash: 0 };
    const parsed = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object') {
      return {
        best: Number(parsed.best) || 0,
        missions: Number(parsed.missions) || 0,
        cash: Number(parsed.cash) || 0,
      };
    }
    return { best: Number(raw) || 0, missions: 0, cash: 0 };
  } catch {
    return { best: 0, missions: 0, cash: 0 };
  }
}

const save = readSave();
let state = createState(world, seed, save);

function writeSave() {
  state.progress.best = Math.max(state.progress.best, Math.round(state.score));
  state.save = {
    best: state.progress.best,
    missions: state.progress.missions,
    cash: state.cash,
  };
  try {
    window.localStorage.setItem(BEST_KEY, JSON.stringify(state.save));
  } catch {
    // Storage can be off (private windows): the run still plays, it just is not remembered.
  }
}

function runShot(name) {
  const scene = stageShot(name, state);
  window.__goldshore = { state, renderer, shot: name, screen: scene.screen };
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let enterQueued = false;
  let fireQueued = false;
  let lastWanted = 0;
  let lastHealth = HEALTH;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    state = createState(world, seed, save);
    startMission(state, 0);
    audio.unlock();
    screen = SCREEN_PLAY;
    accumulator = 0;
    enterQueued = false;
    fireQueued = false;
    lastWanted = 0;
    lastHealth = HEALTH;
    state.cues.length = 0;
    announce('Goldshore. Mission 1: Harbor Run. Move with WASD, press E to steal a car, click to shoot.');
  }

  function endGame(victory) {
    state.victory = victory;
    writeSave();
    screen = SCREEN_OVER;
    audio.play('end');
    announce(victory ? 'Story complete. Goldshore is yours.' : 'Busted. Press Enter for a new run.');
  }

  function controls() {
    return {
      moveX: input.moveX(),
      moveY: input.moveY(),
      throttle: input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']),
      steer: input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']),
      fire: input.mouseDown || input.pressed('Space') || fireQueued,
      enter: false,
      aimX: null,
      aimY: null,
    };
  }

  function handleActions() {
    const actions = input.takeActions();
    let started = false;
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame();
      started = true;
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_ENTER && screen === SCREEN_PLAY) enterQueued = true;
    if (actions & ACTION_FIRE && screen === SCREEN_PLAY && !started) fireQueued = true;
    if (actions & ACTION_MUTE) announce(audio.toggleMute() ? 'Sound muted.' : 'Sound on.');
  }

  function step() {
    const control = controls();
    if (enterQueued) {
      control.enter = true;
      enterQueued = false;
    }
    if (fireQueued) {
      fireQueued = false;
    }
    const aim = renderer.toWorld(input.mouseX, input.mouseY, state.camera);
    control.aimX = aim.x;
    control.aimY = aim.y;
    stepState(state, control, STEP);

    if (state.wanted !== lastWanted) {
      announce(state.wanted > lastWanted ? `Wanted level ${state.wanted}. Goldshore PD is responding.` : 'The heat is cooling off.');
      lastWanted = state.wanted;
    }
    if (state.player.health < lastHealth) {
      announce(`Hit. ${Math.round(state.player.health)} health left.`);
      lastHealth = state.player.health;
    }
    if (screen === SCREEN_PLAY) {
      if (state.ending) endGame(true);
      else if (state.player.health <= 0) endGame(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    renderer.setPointer(input.mouseX, input.mouseY);

    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else accumulator = 0;

    for (const cue of state.cues.splice(0)) audio.play(cue);
    audio.update(state, screen);
    renderer.draw(state, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  window.addEventListener('beforeunload', writeSave);

  // A small hook for play-testing from the browser console (and for checking staged scenes).
  window.__goldshore = {
    get state() { return state; },
    get screen() { return screen; },
    renderer, input,
  };

  announce('Goldshore. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

window.addEventListener('error', (event) => {
  status.textContent = `Goldshore error: ${event.message}`;
});

if (shot) runShot(shot);
else runGame();
