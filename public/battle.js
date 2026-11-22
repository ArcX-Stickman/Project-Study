// Boss Battle mode: a game layer over the normal practice flow.
// Correct answer = your attack. Wrong answer = the boss hits you, then its "weakness" (your mistake) is revealed.
const Battle = (() => {
  const HEROES = {
    knight: { name: 'Knight', emoji: '🛡️', fx: '⚔️', move: 'SHIELD BASH', px: 'slash', blurb: '+40 HP and takes 20% less damage. Hard to knock out.', hp: 40, armor: 0.2 },
    mage: { name: 'Mage', emoji: '🧙', fx: '🔥', move: 'FIREBALL', px: 'fireball', blurb: '25% chance of a critical hit for double damage.', crit: 0.25 },
    ninja: { name: 'Ninja', emoji: '🥷', fx: '🗡️', move: 'SHADOW STRIKE', px: 'slash', blurb: 'Answer streaks hit twice as hard. Rewards combos.', comboMult: 2 },
  };
  const BOSSES = {
    math: [['The Exponent Hydra', '🐉'], ['Count Fractula', '🧛'], ['The Variable Golem', '🗿'], ['Sir Cumference', '🤖']],
    physics: [['Newton’s Nemesis', '🦖'], ['The Friction Fiend', '👹'], ['Captain Momentum', '🦈']],
    chemistry: [['The Mole King', '🐀'], ['Baron Von Bond', '🧪'], ['The Acid Wraith', '👻']],
    biology: [['The Mitosis Monster', '🦠'], ['Queen Chromosome', '🕷️']],
    history: [['General Chaos', '💂'], ['The Forgotten Emperor', '👑'], ['The Revisionist', '🦹']],
    language: [['El Conjugador', '🐲'], ['The Grammar Gremlin', '👺']],
    english: [['The Run-On Wraith', '👻'], ['Lord Thesaurus', '🦉']],
    engineering: [['The Overloaded Mech', '🤖'], ['Torque Titan', '🦾']],
    computer_science: [['The Infinite Loop', '🌀'], ['Null Pointer', '👾']],
    other: [['The Quiz Kraken', '🐙'], ['The Confusion Cyclops', '👁️']],
  };
  const TAUNTS = ['You call that studying?', 'I’ve crushed a thousand students!', 'Your notes won’t save you!', 'Prove you actually know this!'];

  const getHero = () => { try { return HEROES[localStorage.getItem('ps-hero')] ? localStorage.getItem('ps-hero') : null; } catch { return null; } };
  const setHero = (k) => { try { localStorage.setItem('ps-hero', k); } catch {} };

  function pickHero() {
    return new Promise((resolve) => {
      const m = document.createElement('div'); m.className = 'modal-backdrop';
      m.innerHTML = `<div class="modal modal-wide pop-in"><h2>Choose your hero</h2><p class="muted">Your hero levels up with your XP. You can switch anytime.</p>
        <div class="hero-pick">${Object.entries(HEROES).map(([k, h]) => `<button class="hero-card" data-k="${k}"><span class="hero-big">${h.emoji}</span><b>${h.name}</b><small>${h.blurb}</small></button>`).join('')}</div></div>`;
      m.querySelectorAll('.hero-card').forEach((b) => b.onclick = () => { Sound.select(); setHero(b.dataset.k); m.remove(); resolve(b.dataset.k); });
      document.body.appendChild(m);
    });
  }

  function bossFor(lesson, subject, idx) {
    if (lesson.boss?.name && lesson.boss?.emoji) return { name: lesson.boss.name, emoji: lesson.boss.emoji, taunt: lesson.boss.taunt || TAUNTS[idx % TAUNTS.length] };
    const pool = BOSSES[subject] || BOSSES.other;
    const [name, emoji] = pool[idx % pool.length];
    return { name, emoji, taunt: TAUNTS[idx % TAUNTS.length] };
  }

  function create({ lesson, subject, idx, level, total }) {
    const heroKey = getHero() || 'knight';
    const hero = HEROES[heroKey];
    const pmax = 100 + (hero.hp || 0) + Math.min(50, (level - 1) * 5);
    return {
      heroKey, hero, boss: bossFor(lesson, subject, idx), subject, level,
      pmax, php: pmax, bmax: 100, bhp: 100, meter: 0,
      // Scale damage so a perfect run (with combo bonuses and ultimates) brings the boss down right at the end.
      base: 100 / (Array.from({ length: Math.max(1, total) }, (_, c) => 1 + 0.1 * Math.min(c, 5) * (hero.comboMult || 1)).reduce((x, y) => x + y, 0) * 1.12),
      started: false, revives: 0, ko: false, damageDealt: 0, bossLevel: 5 + idx * 3, lastLine: '',
    };
  }

  const bar = (cur, max, cls) => `<div class="hpbar ${cls}"><div style="width:${Math.max(0, cur / max * 100)}%"></div><span>${Math.max(0, Math.round(cur))}/${Math.round(max)}</span></div>`;

  const px = () => typeof Pixel !== 'undefined' && Pixel.on();
  const UP = (t) => Render.esc(String(t).toUpperCase());

  // Pixel mode layout: retro battle scene (boss upper right, hero lower left) + a typewriter text box.
  function pixelArenaHtml(b) {
    return `
      <div class="arena px-arena" id="arena">
        <div class="px-scene">
          <canvas class="px-bg" id="pxBg"></canvas>
          <div class="px-box boss-box"><div class="px-name">${UP(b.boss.name)} <span>Lv${b.bossLevel}</span></div><div class="px-hp"><em>HP</em>${bar(b.bhp, b.bmax, 'b')}</div></div>
          <div class="fighter boss ${b.bhp <= 0 ? 'down' : ''}" id="bossSprite"></div>
          <div class="fighter hero ${b.php <= 0 ? 'down' : ''}" id="heroSprite"></div>
          <div class="px-box hero-box"><div class="px-name">${UP(b.hero.name)} <span>Lv${b.level}</span></div><div class="px-hp"><em>HP</em>${bar(b.php, b.pmax, 'p')}</div>
            <div class="meter ${b.meter >= 100 ? 'full' : ''}"><div style="width:${b.meter}%"></div><span>${b.meter >= 100 ? 'ULTIMATE READY' : 'ULT'}</span></div></div>
          <div class="px-ctrl"><button id="heroSwitch" title="Switch hero">⇄</button><button id="musicBtn" title="Music">${Pixel.music.isOn() ? '♪' : '×'}</button></div>
        </div>
        <div class="px-text done" id="pxText">${Render.esc(b.lastLine || '')}</div>
      </div>`;
  }

  function arenaHtml(b) {
    if (px()) return pixelArenaHtml(b);
    return `
      <div class="arena theme-${b.subject}" id="arena">
        <div class="arena-hud">
          <div class="fighter-hud"><b>${b.hero.emoji} ${b.hero.name} <small>Lv ${b.level}</small></b>${bar(b.php, b.pmax, 'p')}
            <div class="meter ${b.meter >= 100 ? 'full' : ''}" title="Ultimate meter: fills with correct answers"><div style="width:${b.meter}%"></div><span>${b.meter >= 100 ? 'ULTIMATE READY' : 'ULT'}</span></div></div>
          <div class="fighter-hud right"><b>${Render.esc(b.boss.name)}</b>${bar(b.bhp, b.bmax, 'b')}</div>
        </div>
        <div class="stage">
          <div class="fighter hero" id="heroSprite">${b.hero.emoji}</div>
          <div class="fighter boss ${b.bhp <= 0 ? 'down' : ''}" id="bossSprite">${Render.esc(b.boss.emoji)}</div>
          <div class="speech hidden" id="speech"></div>
        </div>
        <button class="hero-switch" id="heroSwitch" title="Switch hero">⇄</button>
      </div>`;
  }

  // ---------- effects ----------
  const arena = () => document.getElementById('arena');
  const restart = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  function floatText(text, target, cls = '') {
    const a = arena(); if (!a || !target) return;
    const r = target.getBoundingClientRect(), ar = a.getBoundingClientRect();
    const f = document.createElement('div'); f.className = `dmg ${cls}`; f.textContent = text;
    f.style.left = (r.left - ar.left + r.width / 2) + 'px'; f.style.top = (r.top - ar.top) + 'px';
    a.appendChild(f); setTimeout(() => f.remove(), 1200);
  }
  function projectile(emoji, fromEl, toEl, big) {
    const a = arena(); if (!a) return;
    const ar = a.getBoundingClientRect(), f = fromEl.getBoundingClientRect(), t = toEl.getBoundingClientRect();
    const p = document.createElement('div'); p.className = `proj ${big ? 'big' : ''}`;
    if (px()) p.appendChild(Pixel.sprite(big ? 'star' : emoji, 4)); else p.textContent = emoji;
    p.style.left = (f.left - ar.left + f.width / 2) + 'px'; p.style.top = (f.top - ar.top + f.height / 3) + 'px';
    p.style.setProperty('--dx', (t.left - f.left) + 'px'); p.style.setProperty('--dy', (t.top - f.top) + 'px');
    a.appendChild(p); setTimeout(() => p.remove(), 500);
  }
  let typing = null;
  function say(text, ms = 2200, b) {
    const box = document.getElementById('pxText');
    if (box) {
      if (b) b.lastLine = text;
      clearInterval(typing); box.classList.remove('done'); box.textContent = '';
      let i = 0;
      typing = setInterval(() => {
        box.textContent = text.slice(0, ++i);
        if (i % 2) Sound.blip();
        if (i >= text.length) { clearInterval(typing); box.classList.add('done'); }
      }, 28);
      return;
    }
    const s = document.getElementById('speech'); if (!s) return;
    s.textContent = text; s.classList.remove('hidden'); restart(s, 'pop-in');
    clearTimeout(say.t); say.t = setTimeout(() => s.classList.add('hidden'), ms);
  }
  function banner(text, cls = '') {
    return new Promise((res) => {
      const a = arena(); if (!a) return res();
      const el = document.createElement('div'); el.className = `banner ${cls}`; el.textContent = text;
      a.appendChild(el); setTimeout(() => { el.remove(); res(); }, 900);
    });
  }
  function refreshBars(b) {
    const a = arena(); if (!a) return;
    const set = (sel, cur, max) => {
      const el = a.querySelector(sel); if (!el) return;
      const pct = Math.max(0, cur / max * 100);
      el.querySelector('div').style.width = pct + '%'; el.querySelector('span').textContent = `${Math.max(0, Math.round(cur))}/${Math.round(max)}`;
      el.classList.toggle('mid', pct <= 50 && pct > 20); el.classList.toggle('low', pct <= 20);
    };
    if (px()) for (let i = 0; i < 5; i++) setTimeout(() => Sound.drain(), i * 70);
    set('.hpbar.p', b.php, b.pmax); set('.hpbar.b', b.bhp, b.bmax);
    const m = a.querySelector('.meter'); m.classList.toggle('full', b.meter >= 100);
    m.querySelector('div').style.width = b.meter + '%'; m.querySelector('span').textContent = b.meter >= 100 ? 'ULTIMATE READY' : 'ULT';
  }

  /** Called after each question renders. Plays the intro once. */
  async function mount(b, onSwitchHero) {
    const sw = document.getElementById('heroSwitch');
    if (sw) sw.onclick = async () => { const k = await pickHero(); b.heroKey = k; b.hero = HEROES[k]; onSwitchHero?.(); };
    if (px()) {
      document.getElementById('heroSprite').appendChild(Pixel.sprite(b.heroKey, 6));
      document.getElementById('bossSprite').appendChild(Pixel.sprite(Pixel.bossSprite(b.boss), 6));
      Pixel.background(document.getElementById('pxBg'), b.subject);
      // refresh HP colors for the freshly drawn bars (without drain sounds)
      for (const [sel, cur, max] of [['.hpbar.p', b.php, b.pmax], ['.hpbar.b', b.bhp, b.bmax]]) {
        const el = document.querySelector(sel), pct = cur / max * 100; el?.classList.toggle('mid', pct <= 50 && pct > 20); el?.classList.toggle('low', pct <= 20);
      }
      const mb = document.getElementById('musicBtn');
      mb.onclick = () => { const onNow = Pixel.music.toggle(); mb.textContent = onNow ? '♪' : '×'; Sound.click(); };
      if (!b.started) {
        b.started = true;
        await Pixel.encounter();
        Pixel.music.start();
        say(`${b.boss.name.toUpperCase()} blocks your path!`, 0, b);
        setTimeout(() => say(`${b.boss.name}: "${b.boss.taunt}"`, 0, b), 1900);
      } else Pixel.music.start();
      return;
    }
    if (!b.started) {
      b.started = true;
      say(`${b.boss.taunt}`, 2600);
      await banner('ROUND 1'); Sound.fight(); await banner('FIGHT!', 'fight');
    }
  }

  /** Player answered correctly. `isLast` = no more questions after this one. Returns { damage, crit, ult, ko }. */
  function attack(b, { combo, isLast }) {
    const comboBonus = 0.1 * Math.min(combo, 5) * (b.hero.comboMult || 1);
    const crit = Math.random() < (b.hero.crit || 0.08);
    const ult = b.meter >= 100;
    let dmg = b.base * (1 + comboBonus) * (crit ? 2 : 1) * (ult ? 2 : 1);
    dmg = Math.round(dmg * (0.9 + Math.random() * 0.2));
    // The boss can only be finished on the last question, and only if it's already weakened.
    if (!isLast) dmg = Math.min(dmg, b.bhp - 1);
    else if (b.bhp - dmg > 0 && b.bhp <= 45) dmg = b.bhp; // finishing blow
    dmg = Math.max(0, dmg);
    b.bhp -= dmg; b.damageDealt += dmg;
    b.meter = ult ? 0 : Math.min(100, b.meter + 25);
    const ko = b.bhp <= 0;

    const hero = document.getElementById('heroSprite'), boss = document.getElementById('bossSprite');
    restart(hero, 'lunge');
    ult ? Sound.ultimate() : crit ? Sound.crit() : Sound.slash();
    if (px()) say(`${b.hero.name.toUpperCase()} used ${ult ? 'ULTIMATE ' + b.hero.move : b.hero.move}!`, 0, b);
    setTimeout(() => {
      if (hero && boss) projectile(px() ? b.hero.px : (ult ? '🌟' : b.hero.fx), hero, boss, ult);
      setTimeout(() => {
        Sound.hit(); restart(boss, 'hurt'); restart(arena(), 'quake');
        floatText(dmg ? `-${dmg}` : '💢 Still standing!', boss, crit || ult ? 'crit' : '');
        if (ult) floatText('ULTIMATE!', boss, 'label');
        else if (crit) floatText('CRITICAL!', boss, 'label');
        else if (combo >= 2) floatText(`${combo + 1}-HIT COMBO`, boss, 'label');
        refreshBars(b);
        if (px()) setTimeout(() => say(ko ? `${b.boss.name.toUpperCase()} was defeated!` : ult ? 'ULTIMATE! A devastating blow!' : crit ? 'A critical hit!' : !dmg ? `${b.boss.name} is hanging on!` : combo >= 2 ? `${combo + 1}-hit combo!` : 'A direct hit!', 0, b), 500);
        if (ko) setTimeout(async () => { boss?.classList.add('down'); if (px()) { Pixel.music.stop(); Sound.victory(); } else { Sound.ko(); await banner('K.O.!', 'ko'); } }, 350);
        else if (!isLast && b.bhp < 30 && !px()) setTimeout(() => say('Impossible… I’m barely standing!'), 400);
      }, 260);
    }, 180);
    return { damage: dmg, crit, ult, ko };
  }

  /** Player answered wrong: the boss hits back. Returns { damage, knockedOut }. */
  function counter(b) {
    const dmg = Math.round((22 + Math.random() * 10) * (1 - (b.hero.armor || 0)));
    b.php -= dmg; b.meter = Math.max(0, b.meter - 25);
    const knockedOut = b.php <= 0;
    const hero = document.getElementById('heroSprite'), boss = document.getElementById('bossSprite');
    restart(boss, 'lunge-left');
    if (px()) say(`${b.boss.name.toUpperCase()} strikes back!`, 0, b);
    setTimeout(() => {
      Sound.hurt(); restart(hero, 'hurt'); restart(arena(), 'quake');
      floatText(`-${dmg}`, hero, 'taken'); refreshBars(b);
      if (px()) setTimeout(() => say(knockedOut ? `${b.hero.name.toUpperCase()} is knocked out! Study the weakness, then revive.` : `${b.hero.name} took ${dmg} damage! Its weakness is revealed below.`, 0, b), 450);
      else say(['Ha! Got you!', 'Wrong move!', 'Is that all?', 'Too easy!'][Math.floor(Math.random() * 4)], 1800);
      if (knockedOut) setTimeout(() => { hero?.classList.add('down'); if (!px()) banner('KNOCKED OUT', 'ko'); }, 300);
    }, 250);
    return { damage: dmg, knockedOut };
  }

  /** Revive after a knockout: back to half HP. Learning continues either way. */
  function revive(b) {
    b.revives++; b.php = Math.round(b.pmax / 2);
    const hero = document.getElementById('heroSprite'); hero?.classList.remove('down'); restart(hero, 'pop-in');
    refreshBars(b); Sound.levelUp(); floatText('+REVIVED', hero, 'heal');
    if (px()) say(`${b.hero.name.toUpperCase()} got back up! Keep fighting!`, 0, b);
  }

  return { pickHero, getHero, create, arenaHtml, mount, attack, counter, revive, HEROES };
})();
