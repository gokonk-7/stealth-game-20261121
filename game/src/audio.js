// Synthesized sound only: every effect is an oscillator or filtered noise
// through WebAudio. No audio files, no network. Guard footsteps carry the
// distance and direction of the guard relative to the thief, so you can hear
// where a patrol is before you see its cone.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (_e) {
      return false;
    }
    return true;
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function thud(vol, pan, low) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const dur = 0.09;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(filter);
    filter.connect(gain);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner);
      panner.connect(master);
    } else {
      gain.connect(master);
    }
    src.start(t0);
  }

  // A footstep whose loudness falls with distance and whose stereo pan
  // follows the step's direction from the thief.
  function footstep(fromX, fromY, thiefX, thiefY, loud) {
    if (!ensure() || muted) return;
    const dx = fromX - thiefX;
    const dy = fromY - thiefY;
    const dist = Math.hypot(dx, dy);
    if (dist > 520) return;
    const vol = loud * Math.max(0, 1 - dist / 520);
    const pan = Math.max(-0.9, Math.min(0.9, dx / 360));
    thud(vol, pan, 320);
  }

  return {
    unlock,
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    guardStep(gx, gy, tx, ty) {
      footstep(gx, gy, tx, ty, 0.5);
    },
    thiefStep(tx, ty) {
      // The thief's own steps are quieter; sneaking is silent.
      thud(0.12, 0, 420);
    },
    suspicionSting() {
      tone(620, 0.28, 'sine', 0.16, 0, 880);
    },
    spottedSting() {
      tone(220, 0.5, 'sawtooth', 0.2, 0, 110);
      tone(440, 0.4, 'square', 0.1, 0.05, 660);
    },
    alarmTone() {
      tone(520, 0.22, 'square', 0.14, 0);
      tone(392, 0.22, 'square', 0.14, 0.24);
      tone(520, 0.22, 'square', 0.14, 0.48);
    },
    pickupChime() {
      tone(880, 0.14, 'sine', 0.16, 0);
      tone(1318, 0.22, 'sine', 0.16, 0.09);
    },
    levelComplete() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.16, i * 0.11));
    },
    winFanfare() {
      [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.42, 'triangle', 0.16, i * 0.13));
    },
    caughtBuzz() {
      tone(180, 0.4, 'sawtooth', 0.18, 0, 90);
    },
  };
}
