// Game-style sound effects synthesized with the Web Audio API (no audio files needed).
const Sound = (() => {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('ps-muted') === '1'; } catch {}

  const ac = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  function tone(freq, start, dur, { type = 'sine', vol = 0.18, slide = 0 } = {}) {
    const c = ac();
    const t0 = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noise(start, dur, vol = 0.08) {
    const c = ac();
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource();
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1800;
    const g = c.createGain(); g.gain.value = vol;
    src.buffer = buf;
    src.connect(f).connect(g).connect(c.destination);
    src.start(c.currentTime + start);
  }

  const fx = {
    click: () => tone(660, 0, 0.06, { type: 'triangle', vol: 0.08 }),
    select: () => tone(520, 0, 0.08, { type: 'square', vol: 0.05 }),
    correct: () => { tone(784, 0, 0.12, { type: 'triangle' }); tone(1175, 0.09, 0.22, { type: 'triangle' }); },
    combo: (n = 2) => {
      const base = 523 * Math.pow(1.122, Math.min(n, 8));
      [0, 0.07, 0.14].forEach((t, i) => tone(base * [1, 1.25, 1.5][i], t, 0.14, { type: 'square', vol: 0.07 }));
    },
    wrong: () => { tone(220, 0, 0.18, { type: 'sawtooth', vol: 0.09, slide: -80 }); tone(165, 0.12, 0.25, { type: 'sawtooth', vol: 0.08, slide: -60 }); },
    whoosh: () => noise(0, 0.25, 0.06),
    xp: () => tone(1320, 0, 0.08, { type: 'sine', vol: 0.1, slide: 400 }),
    levelUp: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.3, { type: 'triangle', vol: 0.14 })),
    complete: () => {
      [523, 659, 784].forEach((f, i) => tone(f, i * 0.12, 0.2, { type: 'square', vol: 0.07 }));
      [1047, 1319, 1568].forEach((f) => tone(f, 0.4, 0.6, { type: 'triangle', vol: 0.09 }));
      noise(0.4, 0.4, 0.04);
    },
    star: (i = 0) => tone(880 * Math.pow(1.26, i), 0, 0.25, { type: 'triangle', vol: 0.12, slide: 300 }),
  };

  const api = {};
  for (const [k, f] of Object.entries(fx)) api[k] = (...a) => { if (!muted) try { f(...a); } catch {} };
  api.isMuted = () => muted;
  api.toggle = () => {
    muted = !muted;
    try { localStorage.setItem('ps-muted', muted ? '1' : '0'); } catch {}
    return muted;
  };
  return api;
})();
