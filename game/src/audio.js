// Synthesized sounds — WebAudio oscillators and filtered noise, no audio files.
// Everything is a no-op until ensure() runs after the first key press or click,
// so the game never touches audio before the player interacts.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, freq, pan = 0) {
    if (!ctx || !master) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      src.connect(f);
      f.connect(g);
      g.connect(p);
      p.connect(master);
    } else {
      src.connect(f);
      f.connect(g);
      g.connect(master);
    }
    src.start();
  }

  return {
    ensure,
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    // A guard footstep: volume falls with distance, pan follows direction.
    step(pan, vol) {
      noiseBurst(0.09, vol, 420, pan);
    },
    thiefStep() {
      noiseBurst(0.06, 0.05, 300, 0);
    },
    sting() {
      tone(660, 0.16, 'sine', 0.16);
      tone(880, 0.2, 'sine', 0.12, 0.08);
    },
    spotted() {
      tone(220, 0.28, 'square', 0.14, 0, 440);
      tone(440, 0.3, 'sawtooth', 0.08, 0.05);
    },
    alarm() {
      tone(520, 0.22, 'square', 0.12);
      tone(392, 0.26, 'square', 0.12, 0.22);
    },
    pickup() {
      tone(880, 0.1, 'sine', 0.14);
      tone(1318, 0.18, 'sine', 0.12, 0.09);
    },
    complete() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'sine', 0.14, i * 0.11));
    },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.15, i * 0.13));
    },
    click() {
      tone(700, 0.05, 'sine', 0.08);
    },
  };
}
