// Pixel mode (beta): hand-made pixel sprites, an animated pixel background, and a chiptune battle loop.
// Every sprite is drawn by hand as a text grid below — one character per pixel.
const Pixel = (() => {
  // ---------- palette ----------
  const PAL = {
    K: '#1b1a2e', // outline
    W: '#f4f4f4', S: '#c3c9d6', s: '#8a93a8', // white, steel, dark steel
    B: '#3b6fd8', b: '#26479a', Y: '#ffd23f', y: '#d99a1e', // blue, yellow
    R: '#e23b4a', r: '#9e2335', F: '#f2c19a', f: '#c98b66', // red, skin
    P: '#7b4fd6', p: '#53309c', N: '#3a3f5c', n: '#262a40', // purple, ninja navy
    G: '#4fbf5a', g: '#2f8a45', D: '#2d6b4a', d: '#1d4a33', // greens
    C: '#5fd3e8', c: '#2f97b8', O: '#ff8a2a', o: '#ffdc6a', // slime cyan, orange glow
    T: '#a39c8e', t: '#6f6a60', L: '#8c5a33', l: '#5e3a20', // stone, wood
    V: '#e6e1ff', v: '#b6acd9', // ghost
  };

  // ---------- sprites (heroes face right, bosses face left) ----------
  const SPRITES = {
    knight: [
      '......KKKK......',
      '.....KSSSSK.....',
      '....KSWSSSSK....',
      '....KSSSSSSK..K.',
      '....KKKKKKSK.KWK',
      '....KSYKYKSK.KWK',
      '.....KSSSSK..KWK',
      '...KKRRRRRKK.KWK',
      '..KBBKRRRRRKKKWK',
      '..KBYBKRRRKSSKKK',
      '..KBYBKRRRKSSK..',
      '..KBBBKSSSKKK...',
      '...KBKKSKSK.....',
      '....K.KSKSK.....',
      '.....KKsKsK.....',
      '.....KKK.KKK....',
    ],
    mage: [
      '.......KK.......',
      '......KPPK......',
      '.....KPPPK......',
      '....KPPYPPK.....',
      '...KPPPPPPPK..K.',
      '..KKKKKKKKKKKKOK',
      '....KFFFFFK.KOoK',
      '....KFKFKFK..KK.',
      '....KWWWWWK..KL.',
      '...KPPWWWPPKKFL.',
      '..KPPPPWPPPPKKL.',
      '..KPPPPPPPPPK.L.',
      '..KPPPYYPPPPK.L.',
      '..KPPPPPPPPPK.L.',
      '...KPPPPPPPK..L.',
      '...KKKKKKKKK..K.',
    ],
    ninja: [
      '................',
      '.....KKKKKK.....',
      '....KNNNNNNK....',
      '...KNNNNNNNNK...',
      '...KNKKKKKKNKRR.',
      '...KNKFFFFFKRRRK',
      '...KNKFKFKFKKRK.',
      '...KNNNNNNNNK...',
      '....KNNNNNNK....',
      '..KKKNNRRNNKKK..',
      '.KFKNNNNNNNNKFK.',
      '.KKKKNNNNNNKKKK.',
      '....KNNNKNNNK...',
      '....KNNK.KNNK...',
      '...KKNNK.KNNKK..',
      '...KKKKK.KKKKK..',
    ],
    dragon: [
      '........................',
      '........................',
      '...K.K..................',
      '...KWKK.................',
      '..KGGGGKK.....KK........',
      '.KGGWKGGGK...KDDK.......',
      'KGGGKKGGGGK.KDDDDK......',
      'KRGGGGGGGGK.KDDDDDKK....',
      'KWKGGGGGGGK.KDDKDDDDK...',
      '.KKKKKGGGGGKKDDKKDDDDK..',
      '.....KGGGGGGKDDK.KKDDDK.',
      '.....KYYGGGGGKKK...KKK..',
      '....KYYYYGGGGGGK........',
      '....KYYYYYGGGGGGK.......',
      '...KYYYYYYGGGGGGGK......',
      '...KYYYYYYGGGGGGGGK.....',
      '...KYYYYYYGGGGGGGGGK.KK.',
      '....KYYYYGGGGGGGGGGGKGGK',
      '....KKYYGGGKKGGGGGGGGGK.',
      '....KGGGGGKKGGGKKKKKKK..',
      '....KGGGKK.KGGGK........',
      '...KWKWKK..KWKWK........',
      '...KKKKK...KKKKK........',
      '........................',
    ],
    blob: [
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '......K..........K......',
      '.....KWK........KWK.....',
      '.....KWK..KKKK..KWK.....',
      '......KKKKPPPPKKKK......',
      '....KKPPPPPPPPPPPPKK....',
      '...KPPPPPPPPPPPPPPPPK...',
      '..KPPPPPPKKKKKPPPPPPPK..',
      '..KPPPPPKWWWWWKPPPPPPK..',
      '.KPPPPPKWWWKKWWKPPPPPPK.',
      '.KPPPPPKWWWKKWWKPPPPPPK.',
      '.KPPPPPPKWWWWWKPPPPPPPK.',
      '.KPPPPPPPKKKKKPPPPPPPPK.',
      '.KPPPPPPPPPPPPPPPPPPPPK.',
      '.KPPPPKKKKKKKKKKKPPPPPK.',
      '.KPPPPKWKWKWKWKWKPPPPPK.',
      '..KPPPPKKKKKKKKKPPPPPK..',
      '..KPPPPPPPPPPPPPPPPPPK..',
      '...KKPPKKPPPKKPPPKKPK...',
      '.....KK..KKK..KKK..K....',
    ],
    golem: [
      '........................',
      '........KKKKKKK.........',
      '.......KTTTTTTTK........',
      '......KTTTTTTTTTK.......',
      '......KTKKTTTKKTK.......',
      '......KTKOKTKOKTK.......',
      '......KTTTTTTTTTK.......',
      '......KTTKKKKKTTK.......',
      '...KKKKKTTTTTTTKKKKK....',
      '..KTTTTKKKKKKKKKTTTTK...',
      '.KTTTTTTTTTTTTTTTTTTTK..',
      '.KTTTKTTTTTOOTTTTKTTTK..',
      '.KTTTKTTTTOooOTTTKTTTK..',
      '.KTTTKTTTTTOOTTTTKTTTK..',
      '.KTTTKTTTTTTTTTTTKTTTK..',
      'KTTTTKKTTTTTTTTTKKTTTTK.',
      'KTTTTK.KTTTTTTTK.KTTTTK.',
      'KKKKKK.KTTTKTTTK.KKKKKK.',
      '.......KTTTKTTTK........',
      '......KTTTK.KTTTK.......',
      '......KTTTK.KTTTK.......',
      '.....KTTTTK.KTTTTK......',
      '.....KKKKKK.KKKKKK......',
      '........................',
    ],
    ghost: [
      '........................',
      '........................',
      '.........KKKKKK.........',
      '.......KKVVVVVVKK.......',
      '......KVVVVVVVVVVK......',
      '.....KVVVVVVVVVVVVK.....',
      '.....KVVKKVVVVKKVVK.....',
      '....KVVKKKKVVKKKKVVK....',
      '....KVVKPKKVVKPKKVVK....',
      '....KVVVKKVVVVKKVVVK....',
      '....KVVVVVVKKVVVVVVK....',
      '..K.KVVVVVKRRKVVVVVK.K..',
      '.KVKKVVVVVVKKVVVVVVKKVK.',
      '..KVVVVVVVVVVVVVVVVVVK..',
      '....KVVVVVVVVVVVVVVK....',
      '....KVVVVVVVVVVVVVVK....',
      '....KVVVVVVVVVVVVVVK....',
      '....KVVKVVVKKVVVKVVK....',
      '....KVK.KVK..KVK.KVK....',
      '.....K...K....K...K.....',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    fireball: ['..KKK...', '.KOooK..', 'KOoWoOKK', 'KOoooOOK', 'KOOooOK.', '.KOOOK..', '..KKK...', '........'],
    slash: ['......KK', '.....KWK', '....KWK.', '...KWK..', '..KWK...', '.KWK....', 'KWK.....', 'KK......'],
    star: ['...KK...', '...KYK..', 'KKKYYKKK', 'KYYWYYYK', '.KYYYYK.', '.KYKKYK.', 'KYK..KYK', 'KK....KK'],
  };

  // Shade once at load: bottom/right edges get a darker tone, top-left edges a highlight (one light source, top-left).
  const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(v + amt * (amt > 0 ? 255 - v : v))));
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('');
  };
  const cache = new Map();
  function imageFor(name) {
    if (cache.has(name)) return cache.get(name);
    const rows = SPRITES[name];
    const h = rows.length, w = rows[0].length;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    const at = (i, j) => (rows[j] && rows[j][i]) || '.';
    const edge = (c) => c === '.' || c === 'K';
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const c = at(i, j); if (c === '.') continue;
      let col = PAL[c] || '#ff00ff';
      if (c !== 'K' && c !== 'W' && c !== 'o') {
        if (edge(at(i, j + 1)) || edge(at(i + 1, j))) col = shade(col, -0.28);
        else if (edge(at(i, j - 1)) && edge(at(i - 1, j))) col = shade(col, 0.25);
      }
      x.fillStyle = col; x.fillRect(i, j, 1, 1);
    }
    cache.set(name, cv); return cv;
  }

  /** A crisp, scaled canvas of a sprite. */
  function sprite(name, scale = 5) {
    const img = imageFor(name);
    const cv = document.createElement('canvas');
    cv.width = img.width * scale; cv.height = img.height * scale;
    cv.className = 'px-sprite';
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(img, 0, 0, cv.width, cv.height);
    return cv;
  }

  const BOSS_BY_EMOJI = { '🐉': 'dragon', '🐲': 'dragon', '🦖': 'dragon', '🦕': 'dragon', '🐍': 'dragon', '🦈': 'dragon',
    '👻': 'ghost', '💀': 'ghost', '☠️': 'ghost', '🧛': 'ghost', '👁️': 'ghost', '🦹': 'ghost', '💂': 'ghost',
    '🗿': 'golem', '🤖': 'golem', '🦾': 'golem', '👑': 'golem', '🦉': 'golem',
    '🦠': 'blob', '🐙': 'blob', '🧪': 'blob', '👾': 'blob', '🌀': 'blob', '🐀': 'blob', '🕷️': 'blob', '👺': 'blob', '👹': 'blob' };
  function bossSprite(boss) {
    if (BOSS_BY_EMOJI[boss.emoji]) return BOSS_BY_EMOJI[boss.emoji];
    const kinds = ['dragon', 'blob', 'golem', 'ghost'];
    let h = 0; for (const ch of boss.name || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return kinds[h % kinds.length];
  }

  // ---------- animated background (drawn at low resolution, scaled up crisp) ----------
  const THEMES = {
    math:      { sky: ['#1d1640', '#2b1d5c', '#4b2a86', '#7b4fd6', '#c86fc9'], far: '#2a1a4a', near: '#3d2a6b', ground: '#241a44', grass: '#3a2d6e', stars: true, orb: '#fff3c4' },
    physics:   { sky: ['#0a1430', '#0d2346', '#13375e', '#1f5a86', '#3f86b0'], far: '#0e2440', near: '#173a5a', ground: '#0f2236', grass: '#1d4466', stars: true, orb: '#dfe9ff' },
    history:   { sky: ['#3a1f2b', '#6b2f36', '#a04a3a', '#e08a4a', '#f6c36b'], far: '#5a2e2a', near: '#6b3a24', ground: '#3a2414', grass: '#5a3a1c', stars: false, orb: '#ffe29a' },
    chemistry: { sky: ['#3f8fd0', '#5fb3e8', '#8fd0f0', '#b8e4f6', '#dcf4fb'], far: '#5e9a86', near: '#3d7a4a', ground: '#2f5d34', grass: '#4f8f3e', stars: false, orb: '#fff6c8' },
    language:  { sky: ['#1a0b26', '#33114a', '#5c1d4a', '#8a2b6e', '#d15a9a'], far: '#3b0f3a', near: '#5a1a50', ground: '#2a0b28', grass: '#4a1a46', stars: true, orb: '#ffd6f0' },
  };
  THEMES.engineering = THEMES.physics; THEMES.biology = THEMES.chemistry; THEMES.english = THEMES.history;
  THEMES.computer_science = THEMES.language; THEMES.other = THEMES.chemistry;

  function background(canvas, subject) {
    const T = THEMES[subject] || THEMES.other;
    const W = 192, H = 108; canvas.width = W; canvas.height = H;
    const x = canvas.getContext('2d');
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const stars = Array.from({ length: 40 }, () => [Math.floor(rnd() * W), Math.floor(rnd() * H * 0.5), rnd() * 6]);
    const clouds = Array.from({ length: 5 }, () => [rnd() * W, 8 + rnd() * 30, 10 + rnd() * 16]);
    const ridge = (t, amp, base, f1, f2) => Array.from({ length: W }, (_, i) => Math.round(base + Math.sin((i + t) * f1) * amp + Math.sin((i + t) * f2) * amp * 0.5));
    let t = 0, last = 0, raf;
    function frame(now) {
      if (!canvas.isConnected) return cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
      if (now - last < 66) return; // ~15 fps: choppy on purpose, like real retro hardware
      last = now; t += 1;
      // sky: hard color bands with a checker dither between them
      const bands = T.sky, bh = Math.ceil((H * 0.62) / bands.length);
      bands.forEach((c, k) => { x.fillStyle = c; x.fillRect(0, k * bh, W, bh); });
      for (let k = 1; k < bands.length; k++) { x.fillStyle = bands[k]; for (let i = 0; i < W; i += 2) x.fillRect(i + ((k) % 2), k * bh - 1, 1, 1); }
      x.fillStyle = bands[bands.length - 1]; x.fillRect(0, bands.length * bh, W, H);
      if (T.stars) stars.forEach(([sx, sy, ph]) => { if (Math.sin(t * 0.3 + ph) > -0.3) { x.fillStyle = '#ffffff'; x.fillRect(sx, sy, 1, 1); } });
      // sun / moon
      x.fillStyle = T.orb; const ox = 150, oy = 20;
      for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) if (i * i + j * j <= 36) x.fillRect(ox + i, oy + j, 1, 1);
      // drifting clouds
      x.fillStyle = '#ffffff55';
      clouds.forEach((c) => { c[0] -= 0.25; if (c[0] < -30) c[0] = W + 10; const [cx, cy, cw] = c;
        x.fillRect(Math.round(cx), Math.round(cy), Math.round(cw), 3); x.fillRect(Math.round(cx + 3), Math.round(cy - 2), Math.round(cw - 6), 2); });
      // parallax mountains and hills
      const far = ridge(t * 0.2, 7, 52, 0.06, 0.17), near = ridge(t * 0.5, 4, 64, 0.09, 0.23);
      x.fillStyle = T.far; far.forEach((y, i) => x.fillRect(i, y, 1, H - y));
      x.fillStyle = T.near; near.forEach((y, i) => x.fillRect(i, y, 1, H - y));
      // ground + grass tufts that sway
      x.fillStyle = T.ground; x.fillRect(0, 70, W, H - 70);
      x.fillStyle = T.grass; for (let i = 0; i < W; i += 7) { const sway = (Math.floor(t / 6 + i) % 2); x.fillRect(i + sway, 72 + (i * 13) % 30, 2, 1); x.fillRect(i, 73 + (i * 13) % 30, 1, 1); }
      // battle platforms (boss upper right, hero lower left)
      const plat = (cx, cy, rx, ry) => { for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) if ((i * i) / (rx * rx) + (j * j) / (ry * ry) <= 1) {
        x.fillStyle = j < -ry / 3 ? T.grass : T.near; x.fillRect(cx + i, cy + j, 1, 1); } };
      plat(140, 56, 30, 6); plat(52, 96, 34, 7);
    }
    raf = requestAnimationFrame(frame);
  }

  // ---------- encounter transition (stripes wipe across the screen) ----------
  function encounter() {
    return new Promise((res) => {
      const o = document.createElement('div'); o.className = 'px-encounter';
      for (let i = 0; i < 8; i++) { const b = document.createElement('i'); b.style.animationDelay = (i % 2 ? 0.05 : 0) + i * 0.03 + 's'; o.appendChild(b); }
      document.body.appendChild(o); Sound.encounter();
      setTimeout(() => { o.classList.add('out'); setTimeout(() => { o.remove(); res(); }, 350); }, 650);
    });
  }

  // ---------- original chiptune battle loop (square lead, triangle bass, noise drums) ----------
  const NOTE = (n) => { const m = n.match(/^([A-G])(#?)(\d)$/); const k = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12; return 440 * Math.pow(2, k / 12); };
  const LEAD = [
    'A4 - C5 - E5 - A5 = G5 - E5 - C5 - D5 E5', 'F5 - E5 - C5 - A4 = C5 - F5 - A5 - G5 F5',
    'G5 - D5 - B4 - G4 = B4 - D5 - G5 - A5 B5', 'G#5 = = - E5 - B4 - G#4 - B4 - E5 - D5 -',
    'A4 - C5 - E5 - A5 = G5 - E5 - C5 - D5 E5', 'F5 - E5 - C5 - A4 = C5 - F5 - A5 - G5 F5',
    'D5 E5 G5 - D5 E5 G5 - B5 = A5 - G5 - D5 -', 'E5 = = = G#5 = = = B5 = = = - - - -',
  ].join(' ').split(' ');
  const BASS = ['A2', 'F2', 'G2', 'E2', 'A2', 'F2', 'G2', 'E2'];
  let musicOn = true; try { musicOn = localStorage.getItem('ps-music') !== '0'; } catch {}
  let mctx = null, timer = null, step = 0, nextT = 0;
  function voice(type, f, t, d, v) {
    const o = mctx.createOscillator(), g = mctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(mctx.destination); o.start(t); o.stop(t + d + 0.02);
  }
  function drum(t, kind) {
    if (kind === 'kick') { const o = mctx.createOscillator(), g = mctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); o.connect(g).connect(mctx.destination); o.start(t); o.stop(t + 0.15); return; }
    const len = kind === 'snare' ? 0.12 : 0.03, buf = mctx.createBuffer(1, mctx.sampleRate * len, mctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = mctx.createBufferSource(), g = mctx.createGain(), f = mctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = kind === 'snare' ? 1200 : 6000;
    g.gain.setValueAtTime(kind === 'snare' ? 0.06 : 0.025, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.buffer = buf; src.connect(f).connect(g).connect(mctx.destination); src.start(t);
  }
  function startMusic() {
    if (!musicOn || Sound.isMuted() || timer) return;
    mctx = mctx || new (window.AudioContext || window.webkitAudioContext)(); mctx.resume();
    const sixteenth = 60 / 150 / 4; step = 0; nextT = mctx.currentTime + 0.1;
    timer = setInterval(() => {
      if (!document.querySelector('.px-arena')) return stopMusic();
      while (nextT < mctx.currentTime + 0.12) {
        const i = step % LEAD.length, bar = Math.floor(i / 16), s16 = i % 16, n = LEAD[i];
        if (n !== '-' && n !== '=') { let len = 1; while (LEAD[(i + len) % LEAD.length] === '=') len++; voice('square', NOTE(n), nextT, sixteenth * len * 0.95, 0.035); }
        if (s16 % 2 === 0) voice('triangle', NOTE(BASS[bar]) * (s16 % 4 === 2 ? 2 : 1), nextT, sixteenth * 1.8, 0.09);
        if (s16 % 8 === 0) drum(nextT, 'kick'); if (s16 % 8 === 4) drum(nextT, 'snare'); if (s16 % 2 === 1) drum(nextT, 'hat');
        nextT += sixteenth; step++;
      }
    }, 25);
  }
  function stopMusic() { clearInterval(timer); timer = null; }
  const music = {
    start: startMusic, stop: stopMusic, isOn: () => musicOn,
    toggle() { musicOn = !musicOn; try { localStorage.setItem('ps-music', musicOn ? '1' : '0'); } catch {} musicOn ? startMusic() : stopMusic(); return musicOn; },
  };

  let enabled = false;
  try { enabled = localStorage.getItem('ps-pixel') === '1'; } catch {}
  const on = () => enabled;
  const setOn = (v) => { enabled = !!v; try { localStorage.setItem('ps-pixel', v ? '1' : '0'); } catch {} };

  return { sprite, bossSprite, on, setOn, background, encounter, music, SPRITES, PAL };
})();
