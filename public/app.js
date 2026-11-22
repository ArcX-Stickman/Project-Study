// Project Study — single-page app. Hash routes: #/, #/course/:id, #/unit/:id, #/lesson/:unitId/:idx, #/building/:unitId
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const esc = Render.esc;
  let me = null, aiOn = false;

  // ---------- helpers ----------
  async function api(path, opts = {}) {
    const init = { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: {} };
    if (opts.body instanceof FormData) init.body = opts.body;
    else if (opts.body) { init.body = JSON.stringify(opts.body); init.headers['Content-Type'] = 'application/json'; }
    const r = await fetch('/api' + path, init);
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && path !== '/login') { me = null; renderAuth(); throw new Error('Please log in.'); }
    if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
    return j;
  }
  const levelOf = (xp) => Math.floor(Math.sqrt(xp / 40)) + 1;
  const levelFloor = (lvl) => 40 * (lvl - 1) ** 2;
  function toast(msg, kind = '') { const t = document.createElement('div'); t.className = `toast ${kind}`; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3500); }
  function floatXp(amount, anchor) {
    const f = document.createElement('div'); f.className = 'xp-float'; f.textContent = `+${amount} XP`;
    const r = (anchor || $('.hud-xp') || document.body).getBoundingClientRect();
    f.style.left = r.left + r.width / 2 + 'px'; f.style.top = r.top + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 1300);
  }
  const burst = (opts = {}) => { try { confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 }, ...opts }); } catch {} };

  function updateUser(u) {
    const before = me ? levelOf(me.xp) : null;
    me = u;
    renderHud();
    const after = levelOf(u.xp);
    if (before && after > before) {
      Sound.levelUp(); burst({ particleCount: 180, spread: 120 });
      modal(`<div class="levelup"><div class="levelup-badge">${after}</div><h2>Level up!</h2><p>You reached level ${after}. Keep stacking those reps.</p><button class="btn btn-primary" data-close>Let's go</button></div>`);
    }
  }

  function modal(html) {
    const m = document.createElement('div'); m.className = 'modal-backdrop';
    m.innerHTML = `<div class="modal pop-in">${html}</div>`;
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) m.remove(); });
    document.body.appendChild(m); return m;
  }

  // ---------- HUD ----------
  function renderHud() {
    const hud = $('#hud');
    if (!me) { hud.innerHTML = ''; return; }
    const lvl = levelOf(me.xp), lo = levelFloor(lvl), hi = levelFloor(lvl + 1);
    const pct = Math.round((me.xp - lo) / (hi - lo) * 100);
    hud.innerHTML = `
      <a href="#/" class="logo">📚 <span>Project Study</span></a>
      <div class="hud-right">
        <div class="hud-streak" title="Daily streak">🔥 ${me.streak}</div>
        <div class="hud-xp" title="${me.xp} XP total">
          <div class="lvl">${lvl}</div>
          <div class="xpbar"><div style="width:${pct}%"></div></div>
          <small>${me.xp - lo}/${hi - lo}</small>
        </div>
        <button class="icon-btn" id="mute" title="Sound">${Sound.isMuted() ? '🔇' : '🔊'}</button>
        <button class="icon-btn" id="logout" title="Log out">⎋</button>
      </div>`;
    $('#mute').onclick = () => { Sound.toggle(); renderHud(); Sound.click(); };
    $('#logout').onclick = async () => { await api('/logout', { body: {} }); me = null; renderAuth(); };
  }

  // ---------- auth ----------
  function renderAuth() {
    renderHud();
    app.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-hero">
          <div class="hero-emoji bounce">📚</div>
          <h1>Project Study</h1>
          <p>Upload your class material. Claude turns it into a game-like practice unit that actually explains what you got wrong.</p>
        </div>
        <form class="card auth-card" id="authForm">
          <div class="tabs"><button type="button" class="tab active" data-mode="login">Log in</button><button type="button" class="tab" data-mode="signup">Sign up</button></div>
          <label>Username<input name="username" autocomplete="username" required minlength="3"></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" required minlength="8"></label>
          <div class="form-error" id="authErr"></div>
          <button class="btn btn-primary btn-lg" type="submit" id="authBtn">Log in</button>
        </form>
      </div>`;
    let mode = 'login';
    app.querySelectorAll('.tab').forEach((t) => t.onclick = () => {
      Sound.click(); mode = t.dataset.mode;
      app.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
      $('#authBtn').textContent = mode === 'login' ? 'Log in' : 'Create account';
      $('[name=password]').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    });
    $('#authForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try { await api('/' + mode, { body: { username: fd.get('username'), password: fd.get('password') } }); Sound.correct(); await boot(); }
      catch (err) { Sound.wrong(); $('#authErr').textContent = err.message; }
    };
  }

  // ---------- upload widget (used on home + course pages) ----------
  function uploadWidget(courses, fixedCourseId = null) {
    const opts = courses.filter((c) => c.name !== 'Organizing…').map((c) => `<option value="${c.id}">${esc(c.emoji)} ${esc(c.name)}</option>`).join('');
    return `
      <div class="card upload-card">
        <h2>⬆️ Add class material</h2>
        <p class="muted">Upload a test, review sheet, or notes (PDF). ${aiOn ? 'AI builds lessons + practice from it.' : '<b>No AI key set:</b> "Build my unit" creates a sample unit. Use the free chatbot option to build a unit from your real material.'}</p>
        <label class="dropzone" id="drop">
          <input type="file" id="file" accept="application/pdf,.pdf,.txt,text/plain" hidden>
          <div class="dz-icon">📄</div>
          <div id="dzText">Drop a PDF here or <u>browse</u></div>
        </label>
        <details class="paste"><summary>…or paste notes / questions instead</summary><textarea id="paste" rows="5" placeholder="Paste your study guide, problems, vocab list…"></textarea></details>
        <div class="row">
          ${fixedCourseId ? `<input type="hidden" id="courseSel" value="${fixedCourseId}">` : `<label class="grow">Class<select id="courseSel"><option value="">✨ Let AI decide / create it</option>${opts}</select></label>`}
          <label class="grow">Unit name <span class="muted">(optional)</span><input id="unitTitle" placeholder="e.g. Unit 5 – Geometric Sequences"></label>
        </div>
        <div class="row">
          <button class="btn btn-primary btn-lg" id="go">Build my unit 🚀</button>
          <button class="btn btn-ghost" id="importBtn">🆓 Free: build it with any chatbot</button>
        </div>
      </div>`;
  }
  function wireUpload() {
    const drop = $('#drop'), file = $('#file');
    const show = () => { $('#dzText').innerHTML = file.files[0] ? `✅ <b>${esc(file.files[0].name)}</b>` : 'Drop a PDF here or <u>browse</u>'; };
    file.onchange = () => { Sound.select(); show(); };
    ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) { file.files = e.dataTransfer.files; Sound.select(); show(); } });
    $('#importBtn').onclick = () => openImport();
    $('#go').onclick = async () => {
      const fd = new FormData();
      if (file.files[0]) fd.append('file', file.files[0]);
      fd.append('text', $('#paste').value);
      fd.append('courseId', $('#courseSel').value);
      fd.append('unitTitle', $('#unitTitle').value);
      if (aiOn && !file.files[0] && !$('#paste').value.trim()) { Sound.wrong(); toast('Add a PDF or paste some notes first.', 'bad'); return; }
      $('#go').disabled = true; $('#go').textContent = 'Uploading…'; Sound.whoosh();
      try { const r = await api('/upload', { body: fd }); location.hash = `#/building/${r.unitId}`; }
      catch (e) { Sound.wrong(); toast(e.message, 'bad'); $('#go').disabled = false; $('#go').textContent = 'Build my unit 🚀'; }
    };
  }

  // ---------- free path: build the unit in any chatbot, paste the JSON back ----------
  async function openImport() {
    Sound.click();
    const courseId = $('#courseSel')?.value || '';
    const unitTitle = $('#unitTitle')?.value || '';
    let prompt = '';
    try { prompt = (await api(`/import-prompt?courseId=${encodeURIComponent(courseId)}&unitTitle=${encodeURIComponent(unitTitle)}`)).prompt; }
    catch (e) { toast(e.message, 'bad'); return; }
    const m = modal(`
      <h2>🆓 Build a unit with a free chatbot</h2>
      <ol class="import-steps">
        <li><button class="btn btn-primary btn-sm" id="copyPrompt">📋 Copy the prompt</button></li>
        <li>Open a free chatbot: <a href="https://claude.ai" target="_blank" rel="noopener noreferrer">Claude</a>, <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer">Gemini</a>, or <a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer">ChatGPT</a>.</li>
        <li><b>Attach your PDF</b> (or paste your notes), paste the prompt, and send.</li>
        <li>Copy its whole reply and paste it below. If it got cut off, type <i>continue</i> there and paste both parts.</li>
      </ol>
      <textarea id="importJson" rows="7" placeholder="Paste the chatbot's reply here…"></textarea>
      <div class="form-error" id="importErr"></div>
      <div class="row"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="doImport">Import unit ▶</button></div>
      <p class="muted small">Grading still works without a key: answers are checked instantly, and wrong answers show the mistake explanations and visuals the chatbot wrote. Only answer-specific feedback and the tutor need a key.</p>`);
    m.querySelector('.modal').classList.add('modal-wide');
    $('#copyPrompt', m).onclick = async () => {
      try { await navigator.clipboard.writeText(prompt); Sound.correct(); $('#copyPrompt', m).textContent = '✅ Copied!'; }
      catch {
        const ta = document.createElement('textarea'); ta.value = prompt; ta.rows = 6; ta.readOnly = true;
        $('#copyPrompt', m).replaceWith(ta); ta.select(); toast('Select all and copy this prompt.');
      }
    };
    $('#doImport', m).onclick = async () => {
      const btn = $('#doImport', m); btn.disabled = true; btn.textContent = 'Importing…';
      try {
        const r = await api('/import', { body: { json: $('#importJson', m).value, courseId, unitTitle } });
        m.remove(); Sound.complete(); burst(); location.hash = `#/unit/${r.unitId}`;
      } catch (e) { Sound.wrong(); $('#importErr', m).textContent = e.message; btn.disabled = false; btn.textContent = 'Import unit ▶'; }
    };
  }

  // ---------- home ----------
  async function renderHome() {
    const { courses } = await api('/courses');
    app.innerHTML = `
      <div class="page">
        <h1 class="greet">Hey ${esc(me.username)} 👋</h1>
        ${uploadWidget(courses)}
        <div class="section-head"><h2>Your classes</h2><button class="btn btn-ghost" id="newCourse">+ New class</button></div>
        <div class="grid">
          ${courses.length ? courses.map((c) => `
            <a class="course-card pop-in" href="#/course/${c.id}" style="--c:${esc(c.color)}">
              <div class="cc-emoji">${esc(c.emoji)}</div>
              <div class="cc-name">${esc(c.name)}</div>
              <div class="cc-meta">${c.unit_count} unit${c.unit_count === 1 ? '' : 's'}</div>
            </a>`).join('') : '<div class="empty">No classes yet — upload something above, or create a class like <b>AP Precalc</b>.</div>'}
        </div>
      </div>`;
    wireUpload();
    $('#newCourse').onclick = () => {
      Sound.click();
      const m = modal(`<h2>New class</h2><label>Name<input id="cName" placeholder="AP Precalculus"></label><label>Emoji<input id="cEmoji" value="📘" maxlength="4"></label><div class="row"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="cSave">Create</button></div>`);
      $('#cName', m).focus();
      $('#cSave', m).onclick = async () => { try { const r = await api('/courses', { body: { name: $('#cName', m).value, emoji: $('#cEmoji', m).value } }); m.remove(); Sound.correct(); location.hash = `#/course/${r.id}`; } catch (e) { toast(e.message, 'bad'); } };
    };
  }

  // ---------- course ----------
  async function renderCourse(id) {
    const [{ course, units }, { courses }] = await Promise.all([api(`/courses/${id}`), api('/courses')]);
    app.innerHTML = `
      <div class="page">
        <a href="#/" class="back">← All classes</a>
        <div class="course-head" style="--c:${esc(course.color)}">
          <span class="ch-emoji">${esc(course.emoji)}</span>
          <h1>${esc(course.name)}</h1>
          <button class="icon-btn" id="rename" title="Rename">✏️</button>
          <button class="icon-btn" id="delCourse" title="Delete class">🗑️</button>
        </div>
        <div class="unit-list">
          ${units.length ? units.map((u) => `
            <div class="unit-card pop-in ${u.status}">
              <a href="${u.status === 'processing' ? `#/building/${u.id}` : u.status === 'ready' ? `#/unit/${u.id}` : '#'}" class="uc-main">
                <div class="uc-title">${esc(u.title)}</div>
                <div class="uc-meta">${u.status === 'ready' ? `${u.lesson_count} lessons · ⭐ ${u.stars}/${u.max_stars}` : u.status === 'processing' ? '⏳ Building…' : '⚠️ ' + esc(u.error || 'Failed')} · <span class="muted">${esc(u.source_name || '')}</span></div>
                ${u.status === 'ready' ? `<div class="mini-bar"><div style="width:${u.max_stars ? u.stars / u.max_stars * 100 : 0}%"></div></div>` : ''}
              </a>
              ${u.status === 'error' ? `<button class="btn btn-ghost btn-sm" data-retry="${u.id}">↻ Retry</button>` : ''}
              <button class="icon-btn" data-del="${u.id}" title="Delete unit">🗑️</button>
            </div>`).join('') : '<div class="empty">No units yet. Upload your first test or review sheet below.</div>'}
        </div>
        ${uploadWidget(courses, course.id)}
      </div>`;
    wireUpload();
    $('#rename').onclick = async () => { const n = prompt('Rename class', course.name); if (n) { await api(`/courses/${id}`, { method: 'PATCH', body: { name: n } }); renderCourse(id); } };
    $('#delCourse').onclick = async () => { if (confirm(`Delete "${course.name}" and all its units?`)) { await api(`/courses/${id}`, { method: 'DELETE' }); location.hash = '#/'; } };
    app.querySelectorAll('[data-retry]').forEach((b) => b.onclick = () => retryUnit(b.dataset.retry));
    app.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { if (confirm('Delete this unit?')) { await api(`/units/${b.dataset.del}`, { method: 'DELETE' }); renderCourse(id); } });
  }

  // ---------- building (generation progress) ----------
  const TIPS = ['Reading your material like a teacher would…', 'Finding the skills your test is really checking…', 'Writing explanations that start with the intuition…', 'Designing wrong answers from real common mistakes…', 'Double-checking every answer key…', 'Picking visuals that make it click…'];
  let pollTimer = null;
  function renderBuilding(unitId) {
    app.innerHTML = `
      <div class="page center">
        <div class="builder">
          <div class="orbit"><span>📄</span><span>🧠</span><span>✨</span></div>
          <h1>Building your unit</h1>
          <p class="tip" id="tip">${TIPS[0]}</p>
          <div class="indeterminate"><div></div></div>
          <p class="muted small">${aiOn ? 'This usually takes 1–3 minutes for a full test. You can leave this page — it keeps building.' : 'Demo mode: creating the sample unit…'}</p>
        </div>
      </div>`;
    let i = 0;
    const tipT = setInterval(() => { const t = $('#tip'); if (!t) return clearInterval(tipT); i = (i + 1) % TIPS.length; t.classList.remove('fade'); void t.offsetWidth; t.classList.add('fade'); t.textContent = TIPS[i]; }, 4000);
    const poll = async () => {
      if (!location.hash.startsWith(`#/building/${unitId}`)) return clearInterval(tipT);
      try {
        const s = await api(`/units/${unitId}/status`);
        if (s.status === 'ready') { clearInterval(tipT); Sound.complete(); burst(); location.hash = `#/unit/${unitId}`; return; }
        if (s.status === 'error') {
          clearInterval(tipT); Sound.wrong();
          app.innerHTML = `<div class="page center"><div class="card"><h2>⚠️ Couldn't build that unit</h2><p>${esc(s.error)}</p><p class="muted small">Your file is saved, so you don't need to upload it again.</p><div class="row" style="justify-content:center"><a class="btn btn-ghost" href="#/course/${s.course_id}">Back</a><button class="btn btn-primary" id="retryUnit">↻ Retry</button></div></div></div>`;
          $('#retryUnit').onclick = () => retryUnit(unitId);
          return;
        }
      } catch {}
      pollTimer = setTimeout(poll, 2500);
    };
    clearTimeout(pollTimer); poll();
  }

  async function retryUnit(unitId) {
    Sound.whoosh();
    try {
      await api(`/units/${unitId}/retry`, { body: {} });
      const target = `#/building/${unitId}`;
      if (location.hash === target) route(); else location.hash = target; // same hash fires no hashchange
    }
    catch (e) { Sound.wrong(); toast(e.message, 'bad'); }
  }

  // ---------- unit (lesson map) ----------
  async function renderUnit(id) {
    const { unit, results, course } = await api(`/units/${id}`);
    const lessons = unit.data.lessons;
    const starsOf = (i) => results.find((r) => r.lesson_idx === i)?.stars || 0;
    const firstOpen = lessons.findIndex((_, i) => !starsOf(i));
    app.innerHTML = `
      <div class="page">
        <a href="#/course/${course.id}" class="back">← ${esc(course.emoji)} ${esc(course.name)}</a>
        <div class="unit-head"><h1 id="uTitle">${esc(unit.title)}</h1><button class="icon-btn" id="renameUnit" title="Rename">✏️</button></div>
        <p class="muted">${Render.inline(unit.summary || '')}</p>
        <div class="path">
          ${lessons.map((l, i) => {
            const s = starsOf(i);
            return `<a class="node ${s ? 'done' : ''} ${i === firstOpen ? 'current' : ''}" href="#/lesson/${id}/${i}" style="--off:${[0, 60, 0, -60][i % 4]}px">
              <div class="node-btn">${esc(l.emoji || '⭐')}</div>
              <div class="node-stars">${[0, 1, 2].map((k) => `<span class="${k < s ? 'on' : ''}">★</span>`).join('')}</div>
              <div class="node-title">${esc(l.title)}</div>
            </a>`;
          }).join('<div class="path-line"></div>')}
          <div class="path-line"></div>
          <div class="node trophy ${lessons.every((_, i) => starsOf(i) === 3) ? 'done' : ''}"><div class="node-btn">🏆</div><div class="node-title">Unit mastery</div></div>
        </div>
      </div>`;
    $('#renameUnit').onclick = async () => { const n = prompt('Rename unit', unit.title); if (n) { await api(`/units/${id}`, { method: 'PATCH', body: { title: n } }); $('#uTitle').textContent = n; } };
  }

  // ---------- lesson: learn phase ----------
  async function renderLesson(unitId, idx) {
    const { unit } = await api(`/units/${unitId}`);
    const lesson = unit.data.lessons[idx];
    if (!lesson) { location.hash = `#/unit/${unitId}`; return; }
    const ctx = { unitId, idx, unit, lesson };
    app.innerHTML = `
      <div class="page narrow">
        <a href="#/unit/${unitId}" class="back">← ${esc(unit.title)}</a>
        <div class="lesson-head"><span class="lh-emoji bounce">${esc(lesson.emoji)}</span><h1>${esc(lesson.title)}</h1></div>
        <div class="card learn prose">${Render.md(lesson.explanation)}</div>
        <div id="lessonVisual"></div>
        ${lesson.key_points?.length ? `<div class="card keypoints"><h3>🔑 Key points</h3><ul>${lesson.key_points.map((k) => `<li>${Render.inline(k)}</li>`).join('')}</ul></div>` : ''}
        <div class="card worked">
          <h3>🧪 Worked example</h3>
          <div class="prose">${Render.md(lesson.worked_example.problem)}</div>
          <p class="muted small">Try to predict each step before revealing it.</p>
          <div id="workedSteps"></div>
          <div class="worked-answer hidden" id="workedAns">✅ Answer: ${Render.inline(lesson.worked_example.answer)}</div>
        </div>
        ${tutorBox()}
        <div class="sticky-cta mode-pick">
          <button class="btn btn-primary btn-lg pulse" id="startBattle">⚔️ Boss Battle <small>${lesson.questions.length} questions</small></button>
          <button class="btn btn-ghost" id="startPractice">📝 Classic practice</button>
        </div>
      </div>`;
    Visuals.render($('#lessonVisual'), lesson.visual);
    Visuals.render($('#workedSteps'), { type: 'steps', title: '', caption: '', steps: lesson.worked_example.steps });
    const obs = new MutationObserver(() => { if ($('#workedSteps .step-controls button[disabled]')) { $('#workedAns').classList.remove('hidden'); $('#workedAns').classList.add('pop-in'); obs.disconnect(); } });
    obs.observe($('#workedSteps'), { subtree: true, attributes: true });
    wireTutor(ctx, () => null);
    $('#startPractice').onclick = () => { Sound.whoosh(); startPractice(ctx, 'classic'); };
    $('#startBattle').onclick = () => { Sound.whoosh(); startPractice(ctx, 'battle'); };
  }

  function tutorBox() {
    return `<details class="card tutor"><summary>🙋 Confused? Ask the AI tutor</summary>
      <div class="tutor-log" id="tutorLog"></div>
      <form class="row" id="tutorForm"><input class="grow" id="tutorMsg" placeholder="e.g. Why is the exponent n−1?" maxlength="2000"><button class="btn btn-primary">Ask</button></form></details>`;
  }
  function wireTutor(ctx, getQuestionText) {
    const form = $('#tutorForm'); if (!form) return;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const msg = $('#tutorMsg').value.trim(); if (!msg) return;
      const log = $('#tutorLog');
      log.insertAdjacentHTML('beforeend', `<div class="bubble me">${esc(msg)}</div>`);
      const pending = document.createElement('div'); pending.className = 'bubble ai typing'; pending.innerHTML = '<span></span><span></span><span></span>'; log.appendChild(pending);
      $('#tutorMsg').value = ''; Sound.click();
      try {
        const r = await api('/tutor', { body: { unitId: ctx.unitId, lessonIdx: ctx.idx, message: msg, questionText: getQuestionText() } });
        pending.className = 'bubble ai'; pending.innerHTML = Render.md(r.answer);
        const vis = document.createElement('div'); pending.appendChild(vis); Visuals.render(vis, r.visual);
        Sound.select();
      } catch (err) { pending.className = 'bubble ai'; pending.textContent = '⚠️ ' + err.message; }
    };
  }

  // ---------- lesson: practice phase ----------
  function shuffleMcq(q) {
    if (q.kind !== 'mcq') return q;
    const order = q.choices.map((_, i) => i).sort(() => Math.random() - 0.5);
    return { ...q, choices: order.map((i) => q.choices[i]), choice_feedback: order.map((i) => q.choice_feedback[i]), correct_index: order.indexOf(q.correct_index) };
  }

  async function startPractice(ctx, mode = 'classic') {
    const { lesson } = ctx;
    const state = {
      queue: lesson.questions.map((q, i) => ({ q, qIdx: i, attempts: 0, original: true })),
      pos: 0, combo: 0, bestCombo: 0, firstTry: 0, total: lesson.questions.length, xp: 0, missed: [], similarAsked: new Set(),
      battle: null,
    };
    if (mode === 'battle') {
      if (!Battle.getHero()) await Battle.pickHero();
      state.battle = Battle.create({ lesson, subject: ctx.unit.subject || ctx.unit.data.subject, idx: ctx.idx, level: levelOf(me.xp), total: state.total });
    }
    renderQuestion(ctx, state);
  }

  function renderQuestion(ctx, state) {
    const item = state.queue[state.pos];
    if (!item) return renderResults(ctx, state);
    const q = item.q;
    const pct = Math.round(state.pos / state.queue.length * 100);
    let hintUsed = false, chosen = null;
    window.scrollTo(0, 0);
    app.innerHTML = `
      <div class="page narrow practice">
        <div class="practice-top">
          <button class="icon-btn" id="quit" title="Leave">✕</button>
          <div class="progress"><div style="width:${pct}%"></div></div>
          <div class="combo ${state.combo >= 2 ? 'hot' : ''}" id="combo">${state.combo >= 2 ? `🔥 ×${state.combo}` : ''}</div>
        </div>
        ${state.battle ? Battle.arenaHtml(state.battle) : ''}
        ${item.original ? '' : `<div class="tag mastery">🔁 ${state.battle ? 'Rematch move' : 'Mastery check'} — same skill, new problem</div>`}
        <div class="card question pop-in" id="qCard">
          <div class="q-kind">${state.battle ? '⚔️ Your move · ' : ''}${q.kind === 'mcq' ? 'Multiple choice' : 'Free response'}</div>
          <div class="q-prompt prose">${Render.md(q.prompt)}</div>
          ${q.kind === 'mcq'
            ? `<div class="choices">${q.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="key">${i + 1}</span><span>${Render.inline(c)}</span></button>`).join('')}</div>`
            : `${q.answer_type === 'long_text' ? '<textarea id="frq" rows="4" placeholder="Explain your answer…"></textarea>' : '<input id="frq" autocomplete="off" placeholder="Type your answer">'}
               <div class="math-preview" id="preview"></div>`}
          <div class="hint-area" id="hintArea"></div>
        </div>
        <div id="feedback"></div>
        <div class="action-bar" id="actions">
          ${q.hint ? '<button class="btn btn-ghost" id="hintBtn">💡 Hint</button>' : '<span></span>'}
          <button class="btn btn-primary btn-lg" id="check" disabled>Check</button>
        </div>
        ${tutorBox()}
      </div>`;
    wireTutor(ctx, () => q.prompt);
    if (state.battle) Battle.mount(state.battle, () => renderQuestion(ctx, state));
    $('#quit').onclick = () => { if (confirm('Leave this lesson? Progress in this round is lost.')) location.hash = `#/unit/${ctx.unitId}`; };
    const check = $('#check');

    if (q.kind === 'mcq') {
      app.querySelectorAll('.choice').forEach((b) => b.onclick = () => {
        if (check.dataset.locked) return;
        Sound.select(); chosen = Number(b.dataset.i);
        app.querySelectorAll('.choice').forEach((x) => x.classList.toggle('selected', x === b));
        check.disabled = false;
      });
    } else {
      const inp = $('#frq'); inp.focus();
      inp.oninput = () => {
        check.disabled = !inp.value.trim();
        const pv = $('#preview');
        if (['numeric', 'expression'].includes(q.answer_type) && /[\^*/]|sqrt|pi/.test(inp.value)) {
          try { pv.innerHTML = katex.renderToString(math.parse(inp.value).toTex({ parenthesis: 'auto' }), { throwOnError: false }); } catch { pv.innerHTML = ''; }
        } else pv.innerHTML = '';
      };
    }
    if ($('#hintBtn')) $('#hintBtn').onclick = () => { hintUsed = true; Sound.whoosh(); $('#hintArea').innerHTML = `<div class="hint pop-in">💡 ${Render.inline(q.hint)}</div>`; $('#hintBtn').remove(); };

    const keyHandler = (e) => {
      if (!document.body.contains(check)) return document.removeEventListener('keydown', keyHandler);
      if (q.kind === 'mcq' && /^[1-9]$/.test(e.key) && !check.dataset.locked) app.querySelector(`.choice[data-i="${Number(e.key) - 1}"]`)?.click();
      if (e.key === 'Enter' && !e.shiftKey && !(e.target.tagName === 'TEXTAREA') && !e.target.closest('#tutorForm')) { e.preventDefault(); const primary = $('#actions .btn-primary:not([disabled])'); primary?.click(); }
    };
    document.addEventListener('keydown', keyHandler);

    check.onclick = async () => {
      check.disabled = true; check.dataset.locked = '1'; check.textContent = q.kind === 'frq' ? 'Checking…' : 'Check';
      const answer = q.kind === 'frq' ? $('#frq').value : null;
      item.attempts++;
      const attempt = hintUsed ? Math.max(2, item.attempts) : item.attempts;
      let r;
      try {
        r = await api('/answer', { body: { unitId: ctx.unitId, lessonIdx: ctx.idx, qIdx: item.original ? item.qIdx : -1, question: item.original ? undefined : q, answer, choice: chosen, attempt, combo: state.combo } });
      } catch (e) { toast(e.message, 'bad'); check.disabled = false; delete check.dataset.locked; check.textContent = 'Check'; item.attempts--; return; }
      if ($('#frq')) $('#frq').disabled = true;
      if (r.correct) onCorrect(ctx, state, item, r, chosen);
      else onWrong(ctx, state, item, r, chosen, answer);
    };
  }

  function onCorrect(ctx, state, item, r, chosen) {
    const q = item.q;
    if (item.attempts === 1 && item.original) state.firstTry++;
    const hit = state.battle ? Battle.attack(state.battle, { combo: state.combo, isLast: state.pos === state.queue.length - 1 }) : null;
    state.combo++; state.bestCombo = Math.max(state.bestCombo, state.combo); state.xp += r.xp;
    if (!hit) state.combo >= 2 ? Sound.combo(state.combo) : Sound.correct();
    if (state.combo > 0 && state.combo % 3 === 0) burst({ particleCount: 60 });
    setTimeout(() => Sound.xp(), 180);
    floatXp(r.xp, $('#check'));
    updateUser(r.user);
    $('#qCard').classList.add('flash-good');
    if (q.kind === 'mcq') app.querySelector(`.choice[data-i="${chosen}"]`).classList.add('correct');
    $('#combo').className = `combo ${state.combo >= 2 ? 'hot pop-in' : ''}`; $('#combo').textContent = state.combo >= 2 ? `🔥 ×${state.combo}` : '';
    const praise = ['Nailed it!', 'Correct!', 'Clean!', 'Yes!', 'Locked in!'][Math.floor(Math.random() * 5)];
    $('#feedback').innerHTML = `
      <div class="fb good pop-in"><div class="fb-head">${hit ? `💥 ${hit.ko ? 'K.O.! Boss defeated!' : hit.ult ? `ULTIMATE! ${hit.damage} damage` : hit.crit ? `Critical hit! ${hit.damage} damage` : hit.damage ? `${praise} ${hit.damage} damage` : `${praise} The boss is hanging on!`}` : `✅ ${praise}`} <span class="xp-chip">+${r.xp} XP</span></div>
      ${r.partial && r.grade ? `<div class="prose">${Render.md(r.grade.feedback)}</div>` : ''}
      ${q.kind === 'mcq' && q.choice_feedback?.[chosen] ? `<div class="prose small">${Render.inline(q.choice_feedback[chosen])}</div>` : ''}
      <details><summary>See full solution</summary><ol>${q.solution_steps.map((s) => `<li>${Render.inline(s)}</li>`).join('')}</ol></details></div>`;
    setActions(`<span></span><button class="btn btn-primary btn-lg" id="next">Continue ▶</button>`);
    $('#next').onclick = () => { Sound.click(); state.pos++; renderQuestion(ctx, state); };
  }

  function onWrong(ctx, state, item, r, chosen, answer) {
    const q = item.q;
    state.combo = 0;
    const blow = state.battle ? Battle.counter(state.battle) : null;
    if (!blow) Sound.wrong();
    $('#qCard').classList.add('shake');
    $('#combo').textContent = '';
    if (q.kind === 'mcq') {
      app.querySelector(`.choice[data-i="${chosen}"]`).classList.add('wrong');
      app.querySelectorAll('.choice').forEach((b) => b.disabled = true);
    }
    const g = r.grade || {
      feedback: [q.choice_feedback?.[chosen], q.common_mistake && `**Common trap:** ${q.common_mistake}`].filter(Boolean).join('\n\n'),
      misconception: '', fix_steps: [], visual: q.visual, encouragement: 'Study the visual — then prove it on the next one.',
    };
    state.missed.push(g.misconception || q.common_mistake || q.prompt.slice(0, 60));
    $('#feedback').innerHTML = `
      <div class="fb bad pop-in">
        <div class="fb-head">${blow ? `🔍 Boss weakness revealed <small class="muted">(you took ${blow.damage} damage)</small>` : "🧐 Let's see what happened"}</div>
        ${g.misconception ? `<div class="miscon">Likely mix-up: <b>${Render.inline(g.misconception)}</b></div>` : ''}
        <div class="prose">${Render.md(g.feedback)}</div>
        ${g.fix_steps?.length ? `<div class="fix"><b>How to fix it</b><ol>${g.fix_steps.map((s) => `<li>${Render.inline(s)}</li>`).join('')}</ol></div>` : ''}
        <div id="fbVisual"></div>
        <div class="encourage">${esc(g.encouragement || '')}</div>
      </div>`;
    Visuals.render($('#fbVisual'), g.visual && g.visual.type !== 'none' ? g.visual : q.visual);
    // In battle mode, let the player see the boss's hit before scrolling to the explanation.
    setTimeout(() => $('#feedback')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), blow ? 1100 : 0);

    // Mastery loop: queue a fresh problem on the same skill (AI) or a reshuffled repeat (demo).
    const key = item.original ? item.qIdx : `s${state.pos}`;
    if (!state.similarAsked.has(key) && state.queue.length < state.total * 2 + 2) {
      state.similarAsked.add(key);
      const slot = { q: shuffleMcq(q), qIdx: item.qIdx, attempts: 0, original: false, pending: true };
      state.queue.push(slot);
      if (aiOn) api('/similar', { body: { unitId: ctx.unitId, lessonIdx: ctx.idx, qIdx: item.original ? item.qIdx : -1, question: item.original ? undefined : q, answer: answer ?? q.choices?.[chosen] } })
        .then((res) => { if (res.question) slot.q = res.question; }).catch(() => {}).finally(() => { slot.pending = false; });
      else slot.pending = false;
    }

    const nextSteps = () => {
      if (q.kind === 'frq' && item.attempts < 3) {
        setActions(`<button class="btn btn-ghost" id="skip">Show answer & move on</button><button class="btn btn-primary btn-lg" id="retry">${state.battle ? '⚔️ Counterattack ↻' : 'Try again ↻'}</button>`);
        $('#retry').onclick = () => { Sound.click(); renderQuestion(ctx, state); };
        $('#skip').onclick = () => revealAndContinue(ctx, state, q);
      } else revealAndContinue(ctx, state, q, false);
    };
    if (blow?.knockedOut) {
      // Knocked out: you still learn from the explanation, then revive at half HP and keep going.
      $('#feedback').insertAdjacentHTML('afterbegin', '<div class="fb ko-panel pop-in"><div class="fb-head">💀 You were knocked out!</div>Read the boss\'s weakness below, then get back up.</div>');
      setActions(`<span></span><button class="btn btn-primary btn-lg" id="revive">❤️ Revive and keep fighting</button>`);
      $('#revive').onclick = () => { Battle.revive(state.battle); $('.ko-panel')?.remove(); nextSteps(); };
    } else nextSteps();
  }

  function revealAndContinue(ctx, state, q, sound = true) {
    if (sound) Sound.whoosh();
    $('#feedback').insertAdjacentHTML('beforeend', `<div class="fb neutral pop-in"><div class="fb-head">📘 Solution</div><ol>${q.solution_steps.map((s) => `<li>${Render.inline(s)}</li>`).join('')}</ol><div><b>Answer:</b> ${Render.inline(q.kind === 'mcq' ? q.choices[q.correct_index] : q.answer)}</div><p class="muted small">You'll get a fresh problem on this skill at the end of the lesson.</p></div>`);
    if (q.kind === 'mcq') app.querySelector(`.choice[data-i="${q.correct_index}"]`)?.classList.add('correct');
    setActions(`<span></span><button class="btn btn-primary btn-lg" id="next">Got it — continue ▶</button>`);
    $('#next').onclick = async () => {
      Sound.click(); state.pos++;
      const nxt = state.queue[state.pos];
      if (nxt?.pending) { $('#next').disabled = true; $('#next').textContent = 'Writing a new problem…'; while (nxt.pending) await new Promise((r) => setTimeout(r, 300)); }
      renderQuestion(ctx, state);
    };
  }

  function setActions(html) { $('#actions').innerHTML = html; }

  async function renderResults(ctx, state) {
    const acc = state.total ? state.firstTry / state.total : 0;
    let res;
    try { res = await api('/lesson-complete', { body: { unitId: ctx.unitId, lessonIdx: ctx.idx, accuracy: acc } }); } catch (e) { toast(e.message, 'bad'); return; }
    const hasNext = ctx.idx + 1 < ctx.unit.data.lessons.length;
    app.innerHTML = `
      <div class="page narrow center">
        <div class="card results pop-in">
          ${state.battle ? (state.battle.bhp <= 0
            ? `<div class="result-boss">${esc(state.battle.boss.emoji)}</div><h1>🏆 Victory!</h1><p class="muted">${esc(state.battle.boss.name)} has been defeated.</p>`
            : `<div class="result-boss alive">${esc(state.battle.boss.emoji)}</div><h1>🏃 ${esc(state.battle.boss.name)} escaped!</h1><p class="muted">It had ${Math.round(state.battle.bhp)} HP left. Fewer mistakes = more damage. Replay to finish it off.</p>`)
            : '<h1>Lesson complete!</h1>'}
          <div class="big-stars">${[0, 1, 2].map((i) => `<span class="star" data-i="${i}">★</span>`).join('')}</div>
          <div class="stats">
            <div><b>${Math.round(acc * 100)}%</b><small>first-try accuracy</small></div>
            <div><b>${state.xp + res.bonus}</b><small>XP earned</small></div>
            <div><b>🔥 ${state.bestCombo}</b><small>best combo</small></div>
            ${state.battle ? `<div><b>💥 ${state.battle.damageDealt}</b><small>damage dealt</small></div><div><b>❤️ ${state.battle.revives}</b><small>revives used</small></div>` : ''}
          </div>
          ${state.missed.length ? `<div class="review"><h3>Review these before your test</h3><ul>${[...new Set(state.missed)].map((m) => `<li>${Render.inline(m)}</li>`).join('')}</ul></div>` : '<p class="perfect">Flawless. You own this skill. 💪</p>'}
          <div class="row">
            <button class="btn btn-ghost" id="again">↻ Replay</button>
            <a class="btn btn-ghost" href="#/unit/${ctx.unitId}">Map</a>
            ${hasNext ? `<a class="btn btn-primary" href="#/lesson/${ctx.unitId}/${ctx.idx + 1}">Next lesson ▶</a>` : ''}
          </div>
        </div>
      </div>`;
    Sound.complete(); burst({ particleCount: 140 });
    app.querySelectorAll('.star').forEach((s, i) => { if (i < res.stars) setTimeout(() => { s.classList.add('on'); Sound.star(i); }, 500 + i * 380); });
    setTimeout(() => { floatXp(res.bonus, $('.results h1')); updateUser(res.user); }, 1700);
    $('#again').onclick = () => (state.battle ? startPractice(ctx, 'battle') : renderLesson(ctx.unitId, ctx.idx));
  }

  // ---------- router ----------
  async function route() {
    if (!me) return renderAuth();
    const h = location.hash.replace(/^#/, '') || '/';
    const parts = h.split('/').filter(Boolean);
    window.scrollTo(0, 0);
    try {
      if (!parts.length) await renderHome();
      else if (parts[0] === 'course') await renderCourse(parts[1]);
      else if (parts[0] === 'unit') await renderUnit(parts[1]);
      else if (parts[0] === 'lesson') await renderLesson(parts[1], Number(parts[2]));
      else if (parts[0] === 'building') renderBuilding(parts[1]);
      else location.hash = '#/';
    } catch (e) {
      if (me) app.innerHTML = `<div class="page center"><div class="card"><h2>Something went wrong</h2><p>${esc(e.message)}</p><a class="btn btn-primary" href="#/">Home</a></div></div>`;
    }
  }

  async function boot() {
    try { const r = await api('/me'); me = r.user; aiOn = r.ai; renderHud(); } catch { me = null; }
    route();
  }

  window.addEventListener('hashchange', () => { document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove()); route(); });
  document.addEventListener('click', (e) => { if (e.target.closest('a.btn, .course-card, .node, .unit-card a')) Sound.click(); });
  boot();
})();
