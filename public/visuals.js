// Renders the structured "visual" objects Claude returns into interactive widgets.
const Visuals = (() => {
  const PALETTE = ['#7c6cff', '#00c896', '#ff7a59', '#2fa8ff', '#ffc43d', '#ff5fa2'];
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const svgEl = (tag, attrs = {}) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  const niceStep = (range) => { const raw = range / 8; const p = Math.pow(10, Math.floor(Math.log10(raw))); const n = raw / p; return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p; };
  const fmt = (v) => Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(2) : +v.toFixed(3);

  function render(container, v) {
    container.innerHTML = '';
    if (!v || !v.type || v.type === 'none') return false;
    const card = el('div', 'visual-card pop-in');
    if (v.title) card.appendChild(el('div', 'visual-title', Render.inline(v.title)));
    const body = el('div', 'visual-body');
    card.appendChild(body);
    const fn = renderers[v.type];
    if (!fn) return false;
    container.appendChild(card);
    try { fn(body, v); } catch (e) { console.error(e); body.textContent = 'Could not draw this visual.'; }
    if (v.caption) card.appendChild(el('div', 'visual-caption', '💡 ' + Render.inline(v.caption)));
    return true;
  }

  // ---------- graph ----------
  function graph(body, v) {
    const fns = (v.functions || []).map((f, i) => {
      try { const c = math.compile(String(f.expr).replace(/^\s*[yf]\s*(\(x\))?\s*=/, '')); return { ...f, color: PALETTE[i % PALETTE.length], f: (x) => { const r = c.evaluate({ x, n: x, t: x }); return typeof r === 'number' ? r : NaN; } }; }
      catch { return null; }
    }).filter(Boolean);
    const pts = v.points || [];
    let w = v.window;
    if (!w || !(w.xmax > w.xmin) || !(w.ymax > w.ymin)) {
      const xs = pts.map((p) => p.x); const xmin = Math.min(-5, ...xs) - 1, xmax = Math.max(5, ...xs) + 1;
      const ys = [...pts.map((p) => p.y)];
      fns.forEach((f) => { for (let i = 0; i <= 40; i++) { const y = f.f(xmin + (xmax - xmin) * i / 40); if (Number.isFinite(y)) ys.push(y); } });
      const lo = Math.min(-1, ...ys), hi = Math.max(1, ...ys); const pad = (hi - lo) * 0.1;
      w = { xmin, xmax, ymin: lo - pad, ymax: hi + pad };
    }
    const canvas = el('canvas', 'graph-canvas');
    body.appendChild(canvas);
    const legend = el('div', 'legend');
    fns.forEach((f) => legend.appendChild(el('span', 'legend-item', `<i style="background:${f.color}"></i>${Render.inline(f.label || f.expr)}`)));
    if (fns.length) body.appendChild(legend);

    const readout = el('div', 'graph-readout', 'Drag the slider or hover the graph to trace');
    const slider = el('input', 'trace-slider');
    Object.assign(slider, { type: 'range', min: w.xmin, max: w.xmax, step: (w.xmax - w.xmin) / 400, value: (w.xmin + w.xmax) / 2 });
    if (fns.length) { body.appendChild(slider); body.appendChild(readout); }

    const ctx = canvas.getContext('2d');
    let W, H, traceX = null, progress = 0;
    const X = (x) => (x - w.xmin) / (w.xmax - w.xmin) * W;
    const Y = (y) => H - (y - w.ymin) / (w.ymax - w.ymin) * H;
    const invX = (px) => w.xmin + px / W * (w.xmax - w.xmin);

    function size() {
      const dpr = window.devicePixelRatio || 1;
      W = body.clientWidth || 320; H = Math.min(340, Math.max(220, W * 0.62));
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      const css = getComputedStyle(document.documentElement);
      const grid = css.getPropertyValue('--grid').trim() || '#2a2f45', axis = css.getPropertyValue('--muted').trim() || '#99a';
      ctx.clearRect(0, 0, W, H);
      ctx.font = '11px system-ui'; ctx.lineWidth = 1;
      const sx = niceStep(w.xmax - w.xmin), sy = niceStep(w.ymax - w.ymin);
      ctx.strokeStyle = grid; ctx.fillStyle = axis;
      for (let x = Math.ceil(w.xmin / sx) * sx; x <= w.xmax; x += sx) { ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), H); ctx.stroke(); if (Math.abs(x) > 1e-9) ctx.fillText(fmt(x), X(x) + 2, Math.min(H - 4, Math.max(12, Y(0) + 12))); }
      for (let y = Math.ceil(w.ymin / sy) * sy; y <= w.ymax; y += sy) { ctx.beginPath(); ctx.moveTo(0, Y(y)); ctx.lineTo(W, Y(y)); ctx.stroke(); if (Math.abs(y) > 1e-9) ctx.fillText(fmt(y), Math.min(W - 30, Math.max(2, X(0) + 4)), Y(y) - 2); }
      ctx.strokeStyle = axis; ctx.lineWidth = 1.5;
      if (w.ymin < 0 && w.ymax > 0) { ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke(); }
      if (w.xmin < 0 && w.xmax > 0) { ctx.beginPath(); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), H); ctx.stroke(); }

      const N = 600, upto = Math.floor(N * progress);
      for (const f of fns) {
        ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.beginPath();
        let pen = false, prevY = null;
        for (let i = 0; i <= upto; i++) {
          const x = w.xmin + (w.xmax - w.xmin) * i / N, y = f.f(x);
          if (!Number.isFinite(y) || (prevY !== null && Math.abs(Y(y) - Y(prevY)) > H * 1.5)) { pen = false; prevY = null; continue; }
          if (!pen) { ctx.moveTo(X(x), Y(y)); pen = true; } else ctx.lineTo(X(x), Y(y));
          prevY = y;
        }
        ctx.stroke();
      }
      const ptShow = Math.floor(pts.length * Math.min(1, progress * 1.4));
      pts.slice(0, ptShow).forEach((p) => {
        ctx.fillStyle = '#ffc43d'; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 6, 0, 7); ctx.fill();
        ctx.strokeStyle = '#000a'; ctx.lineWidth = 1.5; ctx.stroke();
        if (p.label) { ctx.fillStyle = css.getPropertyValue('--text').trim() || '#fff'; ctx.font = 'bold 12px system-ui'; ctx.fillText(p.label, X(p.x) + 8, Y(p.y) - 8); }
      });
      if (traceX !== null && progress >= 1) {
        ctx.strokeStyle = axis; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(traceX), 0); ctx.lineTo(X(traceX), H); ctx.stroke(); ctx.setLineDash([]);
        const parts = [];
        fns.forEach((f) => { const y = f.f(traceX); if (Number.isFinite(y)) { ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(X(traceX), Y(y), 6, 0, 7); ctx.fill(); parts.push(`<span style="color:${f.color}">● ${fmt(y)}</span>`); } });
        readout.innerHTML = `x = <b>${fmt(traceX)}</b> &nbsp; ${parts.join(' &nbsp; ')}`;
      }
    }

    size();
    const t0 = performance.now();
    (function anim(t) { progress = Math.min(1, (t - t0) / 900); draw(); if (progress < 1) requestAnimationFrame(anim); })(t0);
    const setTrace = (x) => { traceX = Math.max(w.xmin, Math.min(w.xmax, x)); slider.value = traceX; draw(); };
    canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); setTrace(invX(e.clientX - r.left)); });
    slider.addEventListener('input', () => setTrace(Number(slider.value)));
    new ResizeObserver(() => { size(); draw(); }).observe(body);
  }

  // ---------- number line ----------
  function numberLine(body, v) {
    const pts = v.points || [];
    const xs = pts.map((p) => p.x);
    let lo = v.window?.xmin, hi = v.window?.xmax;
    if (!(hi > lo)) { lo = Math.min(...xs, 0) - 1; hi = Math.max(...xs, 0) + 1; }
    const W = 600, H = 120, pad = 30, X = (x) => pad + (x - lo) / (hi - lo) * (W - 2 * pad);
    const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'nl-svg' });
    s.appendChild(svgEl('line', { x1: pad - 10, y1: 70, x2: W - pad + 10, y2: 70, class: 'nl-axis' }));
    const step = niceStep(hi - lo);
    for (let x = Math.ceil(lo / step) * step; x <= hi + 1e-9; x += step) {
      s.appendChild(svgEl('line', { x1: X(x), y1: 63, x2: X(x), y2: 77, class: 'nl-tick' }));
      const t = svgEl('text', { x: X(x), y: 96, class: 'nl-label' }); t.textContent = fmt(x); s.appendChild(t);
    }
    pts.forEach((p, i) => {
      const g = svgEl('g', { class: 'nl-point', style: `animation-delay:${i * 0.18}s` });
      g.appendChild(svgEl('circle', { cx: X(p.x), cy: 70, r: 8, fill: PALETTE[i % PALETTE.length] }));
      const t = svgEl('text', { x: X(p.x), y: 46 - (i % 2) * 14, class: 'nl-plabel' }); t.textContent = p.label || fmt(p.x);
      g.appendChild(t);
      s.appendChild(g);
    });
    body.appendChild(s);
  }

  // ---------- vectors ----------
  function vectors(body, v) {
    const vs = v.vectors || [];
    let w = v.window;
    if (!w || !(w.xmax > w.xmin)) {
      const xs = vs.flatMap((a) => [a.from_x, a.from_x + a.x]), ys = vs.flatMap((a) => [a.from_y, a.from_y + a.y]);
      w = { xmin: Math.min(0, ...xs) - 1, xmax: Math.max(0, ...xs) + 1, ymin: Math.min(0, ...ys) - 1, ymax: Math.max(0, ...ys) + 1 };
    }
    const W = 600, H = Math.round(600 * Math.min(0.62, Math.max(0.35, (w.ymax - w.ymin) / (w.xmax - w.xmin))));
    const X = (x) => (x - w.xmin) / (w.xmax - w.xmin) * W, Y = (y) => H - (y - w.ymin) / (w.ymax - w.ymin) * H;
    const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'vec-svg' });
    const defs = svgEl('defs');
    vs.forEach((_, i) => {
      const m = svgEl('marker', { id: `ah${i}-${uid}`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
      m.appendChild(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', fill: PALETTE[i % PALETTE.length] }));
      defs.appendChild(m);
    });
    s.appendChild(defs);
    for (let x = Math.ceil(w.xmin); x <= w.xmax; x++) s.appendChild(svgEl('line', { x1: X(x), y1: 0, x2: X(x), y2: H, class: x === 0 ? 'vec-axis' : 'vec-grid' }));
    for (let y = Math.ceil(w.ymin); y <= w.ymax; y++) s.appendChild(svgEl('line', { x1: 0, y1: Y(y), x2: W, y2: Y(y), class: y === 0 ? 'vec-axis' : 'vec-grid' }));
    const comps = svgEl('g', { class: 'vec-comps hidden' });
    const ends = vs.flatMap((a) => [[X(a.from_x), Y(a.from_y)], [X(a.from_x + a.x), Y(a.from_y + a.y)]]);
    const cx = ends.reduce((t, e) => t + e[0], 0) / (ends.length || 1), cy = ends.reduce((t, e) => t + e[1], 0) / (ends.length || 1);
    vs.forEach((a, i) => {
      const c = PALETTE[i % PALETTE.length];
      const x1 = X(a.from_x), y1 = Y(a.from_y), x2 = X(a.from_x + a.x), y2 = Y(a.from_y + a.y);
      comps.appendChild(svgEl('line', { x1, y1, x2, y2: y1, stroke: c, class: 'vec-comp' }));
      comps.appendChild(svgEl('line', { x1: x2, y1, x2, y2, stroke: c, class: 'vec-comp' }));
      const len = Math.hypot(x2 - x1, y2 - y1);
      const line = svgEl('line', { x1, y1, x2, y2, stroke: c, 'stroke-width': 4, 'marker-end': `url(#ah${i}-${uid})`, class: 'vec-line', style: `stroke-dasharray:${len};stroke-dashoffset:${len};animation-delay:${i * 0.35}s` });
      s.appendChild(line);
      // Put the label beside the arrow's midpoint, on the side facing away from the figure's center.
      let nx = len ? -(y2 - y1) / len : 0, ny = len ? (x2 - x1) / len : -1;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }
      const lx = mx + nx * 16, ly = my + ny * 16 + (ny > 0.3 ? 10 : 0);
      const t = svgEl('text', { x: lx, y: ly, fill: c, class: 'vec-label', 'text-anchor': nx < -0.3 ? 'end' : nx > 0.3 ? 'start' : 'middle' });
      t.textContent = `${a.label} (${fmt(a.x)}, ${fmt(a.y)})`;
      s.appendChild(t);
    });
    s.appendChild(comps);
    uid++;
    body.appendChild(s);
    const btn = el('button', 'btn btn-ghost btn-sm', '↔ Show x/y components');
    btn.onclick = () => { Sound.click(); comps.classList.toggle('hidden'); };
    body.appendChild(btn);
  }
  let uid = 0;

  // ---------- timeline ----------
  function timeline(body, v) {
    const list = el('div', 'timeline');
    (v.events || []).forEach((e, i) => {
      const item = el('div', 'tl-item', `<div class="tl-dot"></div><div class="tl-date">${Render.esc(e.date)}</div><div class="tl-label">${Render.inline(e.label)}</div>`);
      item.style.animationDelay = `${i * 0.12}s`;
      item.onclick = () => { Sound.select(); list.querySelectorAll('.tl-item').forEach((x) => x.classList.remove('active')); item.classList.add('active'); };
      list.appendChild(item);
    });
    body.appendChild(list);
  }

  // ---------- image with citation ----------
  async function image(body, v) {
    body.innerHTML = '<div class="img-loading">🔎 Finding an image…</div>';
    try {
      const r = await fetch('/api/image?q=' + encodeURIComponent(v.image_query || v.title));
      const { image: img } = await r.json();
      if (!img || !/^https:\/\/upload\.wikimedia\.org\//.test(img.url)) { body.innerHTML = '<div class="img-loading">No freely licensed image found for this one.</div>'; return; }
      body.innerHTML = '';
      const fig = el('figure', 'cited-figure');
      const im = el('img'); im.src = img.url; im.alt = img.title; im.loading = 'lazy';
      fig.appendChild(im);
      const cap = el('figcaption', 'citation');
      const safe = (u) => (/^https:\/\//.test(u || '') ? Render.esc(u) : '#');
      cap.innerHTML = `<b>${Render.esc(img.title)}</b><br>By ${Render.esc(img.artist)} · <a href="${safe(img.license_url || img.page)}" target="_blank" rel="noopener noreferrer">${Render.esc(img.license)}</a> · via <a href="${safe(img.page)}" target="_blank" rel="noopener noreferrer">${Render.esc(img.source)}</a>${img.article ? ` (from Wikipedia: <a href="${safe(img.article_url)}" target="_blank" rel="noopener noreferrer">${Render.esc(img.article)}</a>)` : ''}`;
      fig.appendChild(cap);
      body.appendChild(fig);
    } catch { body.innerHTML = '<div class="img-loading">Image unavailable offline.</div>'; }
  }

  // ---------- table ----------
  function table(body, v) {
    const t = el('table', 'vtable');
    if (v.table_headers?.length) t.appendChild(el('thead', '', '<tr>' + v.table_headers.map((h) => `<th>${Render.inline(h)}</th>`).join('') + '</tr>'));
    const tb = el('tbody');
    (v.table_rows || []).forEach((row, i) => { const tr = el('tr', 'row-in', row.map((c) => `<td>${Render.inline(c)}</td>`).join('')); tr.style.animationDelay = `${i * 0.08}s`; tb.appendChild(tr); });
    t.appendChild(tb);
    const wrap = el('div', 'table-wrap'); wrap.appendChild(t); body.appendChild(wrap);
  }

  // ---------- step-by-step reveal ----------
  function steps(body, v) {
    const list = el('ol', 'step-list');
    const items = (v.steps || []).map((s) => { const li = el('li', 'step hidden', Render.inline(s)); list.appendChild(li); return li; });
    body.appendChild(list);
    let shown = 0;
    const bar = el('div', 'step-controls');
    const next = el('button', 'btn btn-primary btn-sm', 'Next step ▶');
    const all = el('button', 'btn btn-ghost btn-sm', 'Show all');
    const reveal = () => { if (shown < items.length) { items[shown].classList.remove('hidden'); items[shown].classList.add('pop-in'); shown++; Sound.select(); } if (shown >= items.length) { next.disabled = true; next.textContent = 'Done ✓'; } };
    next.onclick = reveal;
    all.onclick = () => { while (shown < items.length) reveal(); };
    bar.append(next, all); body.appendChild(bar);
    reveal();
  }

  // ---------- flashcards ----------
  function flashcards(body, v) {
    const grid = el('div', 'flash-grid');
    (v.cards || []).forEach((c) => {
      const card = el('div', 'flash', `<div class="flash-inner"><div class="flash-face flash-front">${Render.inline(c.front)}</div><div class="flash-face flash-back">${Render.inline(c.back)}</div></div>`);
      card.onclick = () => { Sound.whoosh(); card.classList.toggle('flipped'); };
      grid.appendChild(card);
    });
    body.appendChild(el('div', 'hint-text', 'Tap a card to flip it'));
    body.appendChild(grid);
  }

  // ---------- bar chart ----------
  function barChart(body, v) {
    const bars = v.bars || [];
    const max = Math.max(...bars.map((b) => Math.abs(b.value)), 1);
    const wrap = el('div', 'bars');
    bars.forEach((b, i) => {
      const row = el('div', 'bar-row', `<div class="bar-label">${Render.inline(b.label)}</div><div class="bar-track"><div class="bar-fill" style="background:${PALETTE[i % PALETTE.length]};--w:${Math.abs(b.value) / max * 100}%;animation-delay:${i * 0.1}s"></div></div><div class="bar-val">${fmt(b.value)}</div>`);
      wrap.appendChild(row);
    });
    body.appendChild(wrap);
  }

  const renderers = { graph, number_line: numberLine, vectors, timeline, image, table, steps, flashcards, bar_chart: barChart };
  return { render };
})();
