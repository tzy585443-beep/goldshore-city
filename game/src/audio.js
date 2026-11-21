// Sound made entirely by Web Audio oscillators: an engine that follows the car's speed, a siren
// that follows the wanted level, and short generated tones for shots, hits, thefts and missions.
// No files, no network, no autoplay: the context starts on the first key or click.

export function createAudio() {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  let context = null;
  let master = null;
  let engine = null;
  let engineGain = null;
  let siren = null;
  let sirenGain = null;
  let muted = false;

  function unlock() {
    if (context !== null || AudioContextClass === undefined) return;
    try {
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.24;
      master.connect(context.destination);

      engine = context.createOscillator();
      engine.type = 'sawtooth';
      engine.frequency.value = 62;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engine.connect(engineFilter).connect(engineGain).connect(master);
      engine.start();

      siren = context.createOscillator();
      siren.type = 'square';
      siren.frequency.value = 620;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      siren.connect(sirenGain).connect(master);
      siren.start();
    } catch {
      context = null;
    }
  }

  function tone(frequency, duration, type, volume, slide, delay = 0) {
    if (context === null || muted) return;
    const now = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + slide), now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function play(cue) {
    switch (cue) {
      case 'shot': tone(210, 0.09, 'square', 0.3, -130); break;
      case 'hurt': tone(120, 0.2, 'sawtooth', 0.3, -60); break;
      case 'crash': tone(90, 0.16, 'triangle', 0.28, -40); break;
      case 'enter': tone(300, 0.1, 'triangle', 0.22, 140); break;
      case 'crime': tone(240, 0.14, 'square', 0.2, -80); break;
      case 'mission':
        tone(440, 0.13, 'triangle', 0.24, 0, 0);
        tone(660, 0.13, 'triangle', 0.24, 0, 0.1);
        tone(880, 0.22, 'triangle', 0.24, 0, 0.2);
        break;
      case 'end':
        tone(520, 0.25, 'sine', 0.22, 120, 0);
        tone(390, 0.35, 'sine', 0.22, -140, 0.18);
        break;
      default: break;
    }
  }

  function update(state, screen) {
    if (context === null) return;
    const now = context.currentTime;
    const speed = state.player.inCar === null ? 0 : Math.abs(state.player.inCar.speed);
    const playing = screen === 'play';
    engine.frequency.setTargetAtTime(58 + speed * 0.55, now, 0.08);
    engineGain.gain.setTargetAtTime(playing ? 0.012 + speed / 6000 : 0, now, 0.12);
    siren.frequency.setTargetAtTime(620 + Math.sin(now * 9) * 150, now, 0.05);
    sirenGain.gain.setTargetAtTime(playing && state.wanted > 0 ? 0.035 + state.wanted * 0.009 : 0, now, 0.12);
  }

  return {
    unlock,
    play,
    update,
    toggleMute() {
      muted = !muted;
      if (master !== null && context !== null) master.gain.setTargetAtTime(muted ? 0 : 0.24, context.currentTime, 0.05);
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
