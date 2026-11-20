import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, UPLOAD_DIR } from './lib/db.js';
import { aiEnabled, MODEL, generateUnit, gradeAnswer, similarQuestion, tutor } from './lib/ai.js';
import { findImage } from './lib/images.js';
import { demoUnit, demoGrade } from './lib/demo.js';
import { quickCheck } from './lib/check.js';

const PORT = Number(process.env.PORT || 3000);
const AI_CALLS_PER_HOUR = Number(process.env.AI_CALLS_PER_HOUR || 80);
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// ---------- security headers ----------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://upload.wikimedia.org", "font-src 'self' data:", "connect-src 'self'",
    "worker-src blob:", "object-src 'none'", "frame-ancestors 'none'",
  ].join('; '));
  next();
});

// ---------- static files + vendored libraries ----------
app.use(express.static('public'));
const vendor = {
  'katex.min.js': 'katex/dist/katex.min.js',
  'katex.min.css': 'katex/dist/katex.min.css',
  'marked.min.js': 'marked/marked.min.js',
  'purify.min.js': 'dompurify/dist/purify.min.js',
  'math.js': 'mathjs/lib/browser/math.js',
  'confetti.js': 'canvas-confetti/dist/confetti.browser.js',
};
for (const [name, p] of Object.entries(vendor)) {
  app.get(`/vendor/${name}`, (req, res) => res.sendFile(path.resolve('node_modules', p)));
}
app.use('/vendor/fonts', express.static(path.resolve('node_modules/katex/dist/fonts')));

// ---------- auth ----------
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const today = () => new Date().toISOString().slice(0, 10);

function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, Date.now() + 30 * 864e5);
  res.cookie('sid', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 864e5 });
}

function auth(req, res, next) {
  const s = req.cookies.sid && db.prepare('SELECT user_id, expires_at FROM sessions WHERE token=?').get(req.cookies.sid);
  if (!s || s.expires_at < Date.now()) return res.status(401).json({ error: 'Please log in.' });
  req.userId = s.user_id;
  next();
}

const publicUser = (u) => ({ id: u.id, username: u.username, xp: u.xp, streak: u.streak, last_day: u.last_day });

app.post('/api/signup', (req, res) => {
  const { username, password } = req.body || {};
  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username || '')) return res.status(400).json({ error: 'Username: 3–24 letters, numbers, _ . -' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) return res.status(409).json({ error: 'That username is taken.' });
  const salt = crypto.randomBytes(16).toString('hex');
  const { lastInsertRowid } = db.prepare('INSERT INTO users (username, pass_hash, salt) VALUES (?, ?, ?)').run(username, hash(password, salt), salt);
  startSession(res, Number(lastInsertRowid));
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(String(username || ''));
  const ok = u && crypto.timingSafeEqual(Buffer.from(hash(String(password || ''), u.salt), 'hex'), Buffer.from(u.pass_hash, 'hex'));
  if (!ok) return res.status(401).json({ error: 'Wrong username or password.' });
  startSession(res, u.id);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  if (req.cookies.sid) db.prepare('DELETE FROM sessions WHERE token=?').run(req.cookies.sid);
  res.clearCookie('sid');
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.userId);
  res.json({ user: publicUser(u), ai: aiEnabled, model: aiEnabled ? MODEL : null });
});

// ---------- AI rate limiting (protects your API bill) ----------
const LIMIT_MSG = { error: 'AI limit reached for this hour. Take a break and come back soon!' };
function consumeAiCall(userId) {
  db.prepare('DELETE FROM ai_usage WHERE ts < ?').run(Date.now() - 3600e3);
  const { n } = db.prepare('SELECT COUNT(*) n FROM ai_usage WHERE user_id=?').get(userId);
  if (n >= AI_CALLS_PER_HOUR) return false;
  db.prepare('INSERT INTO ai_usage (user_id, ts) VALUES (?, ?)').run(userId, Date.now());
  return true;
}
function aiBudget(req, res, next) {
  if (!aiEnabled || consumeAiCall(req.userId)) return next();
  res.status(429).json(LIMIT_MSG);
}

const aiError = (res, e) => {
  console.error('AI error:', e);
  res.status(502).json({ error: e?.message?.slice(0, 300) || 'AI request failed.' });
};

// ---------- courses & units ----------
const COLORS = ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#fdcb6e', '#e84393', '#00cec9', '#d63031'];

app.get('/api/courses', auth, (req, res) => {
  const courses = db.prepare(`
    SELECT c.*, COUNT(u.id) AS unit_count FROM courses c LEFT JOIN units u ON u.course_id=c.id
    WHERE c.user_id=? GROUP BY c.id ORDER BY c.created_at DESC`).all(req.userId);
  res.json({ courses });
});

app.post('/api/courses', auth, (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: 'Name your class.' });
  const emoji = String(req.body?.emoji || '📘').slice(0, 4);
  const n = db.prepare('SELECT COUNT(*) n FROM courses WHERE user_id=?').get(req.userId).n;
  const { lastInsertRowid } = db.prepare('INSERT INTO courses (user_id, name, emoji, color) VALUES (?, ?, ?, ?)').run(req.userId, name, emoji, COLORS[n % COLORS.length]);
  res.json({ id: Number(lastInsertRowid) });
});

app.patch('/api/courses/:id', auth, (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 60);
  if (name) db.prepare('UPDATE courses SET name=? WHERE id=? AND user_id=?').run(name, req.params.id, req.userId);
  res.json({ ok: true });
});

app.delete('/api/courses/:id', auth, (req, res) => {
  db.prepare('DELETE FROM courses WHERE id=? AND user_id=?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

app.get('/api/courses/:id', auth, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!course) return res.status(404).json({ error: 'Not found' });
  const units = db.prepare('SELECT id, title, status, error, source_name, subject, summary, created_at, data FROM units WHERE course_id=? ORDER BY created_at').all(course.id);
  const results = db.prepare('SELECT unit_id, lesson_idx, stars FROM lesson_results WHERE user_id=?').all(req.userId);
  for (const u of units) {
    const lessons = u.data ? JSON.parse(u.data).lessons.length : 0;
    const mine = results.filter((r) => r.unit_id === u.id);
    u.lesson_count = lessons;
    u.stars = mine.reduce((s, r) => s + r.stars, 0);
    u.max_stars = lessons * 3;
    delete u.data;
  }
  res.json({ course, units });
});

app.patch('/api/units/:id', auth, (req, res) => {
  const title = String(req.body?.title || '').trim().slice(0, 100);
  if (title) db.prepare('UPDATE units SET title=? WHERE id=? AND user_id=?').run(title, req.params.id, req.userId);
  res.json({ ok: true });
});

app.delete('/api/units/:id', auth, (req, res) => {
  db.prepare('DELETE FROM units WHERE id=? AND user_id=?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

function loadUnit(req) {
  const u = db.prepare('SELECT * FROM units WHERE id=? AND user_id=?').get(req.params.id ?? req.body?.unitId, req.userId);
  if (u?.data) u.data = JSON.parse(u.data);
  return u;
}

app.get('/api/units/:id', auth, (req, res) => {
  const u = loadUnit(req);
  if (!u) return res.status(404).json({ error: 'Not found' });
  const results = db.prepare('SELECT lesson_idx, stars, best_accuracy FROM lesson_results WHERE user_id=? AND unit_id=?').all(req.userId, u.id);
  const course = db.prepare('SELECT id, name, emoji, color FROM courses WHERE id=?').get(u.course_id);
  res.json({ unit: u, results, course });
});

// ---------- upload & generation ----------
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /pdf|text\/plain/.test(file.mimetype)),
});

app.post('/api/upload', auth, aiBudget, upload.single('file'), (req, res) => {
  const text = String(req.body?.text || '').slice(0, 200_000);
  if (!req.file && !text.trim() && aiEnabled) return res.status(400).json({ error: 'Upload a PDF or paste your notes.' });
  if (req.file && req.file.mimetype === 'application/pdf') {
    const head = fs.readFileSync(req.file.path).subarray(0, 5).toString();
    if (head !== '%PDF-') { fs.rmSync(req.file.path, { force: true }); return res.status(400).json({ error: 'That file is not a valid PDF.' }); }
  }

  let courseId = Number(req.body?.courseId) || null;
  if (courseId && !db.prepare('SELECT 1 FROM courses WHERE id=? AND user_id=?').get(courseId, req.userId)) courseId = null;
  const courseName = courseId ? db.prepare('SELECT name FROM courses WHERE id=?').get(courseId).name : null;
  const unitHint = String(req.body?.unitTitle || '').trim().slice(0, 100);

  // A unit must belong to a course; until AI names it, park it in a placeholder.
  const placeholderCourse = courseId || Number(db.prepare('INSERT INTO courses (user_id, name, emoji, color) VALUES (?, ?, ?, ?)')
    .run(req.userId, 'Organizing…', '✨', COLORS[0]).lastInsertRowid);
  const sourceName = req.file?.originalname?.slice(0, 120) || (text ? 'Pasted notes' : 'Demo');
  const unitId = Number(db.prepare('INSERT INTO units (course_id, user_id, title, status, source_name) VALUES (?, ?, ?, ?, ?)')
    .run(placeholderCourse, req.userId, unitHint || 'Building your unit…', 'processing', sourceName).lastInsertRowid);
  res.json({ unitId, courseId: placeholderCourse });

  (async () => {
    try {
      let plan;
      if (!aiEnabled) {
        await new Promise((r) => setTimeout(r, 2500));
        plan = structuredClone(demoUnit);
      } else {
        let pdfBase64 = null, fileText = '';
        if (req.file?.mimetype === 'application/pdf') pdfBase64 = fs.readFileSync(req.file.path).toString('base64');
        else if (req.file) fileText = fs.readFileSync(req.file.path, 'utf8').slice(0, 200_000);
        plan = await generateUnit({ pdfBase64, text: [fileText, text].filter(Boolean).join('\n\n'), filename: sourceName, courseName, unitHint });
      }
      plan.lessons = plan.lessons.filter((l) => l.questions?.length);
      for (const l of plan.lessons) for (const q of l.questions) {
        if (q.kind === 'mcq' && !(q.correct_index >= 0 && q.correct_index < q.choices.length)) q.kind = 'frq';
      }
      if (!plan.lessons.length) throw new Error('No lessons could be built from this material.');

      let finalCourse = courseId;
      if (!finalCourse) {
        const existing = db.prepare('SELECT id FROM courses WHERE user_id=? AND name=? COLLATE NOCASE AND id<>?').get(req.userId, plan.course_suggestion, placeholderCourse);
        if (existing) {
          finalCourse = existing.id;
          db.prepare('UPDATE units SET course_id=? WHERE id=?').run(finalCourse, unitId);
          db.prepare('DELETE FROM courses WHERE id=?').run(placeholderCourse);
        } else {
          finalCourse = placeholderCourse;
          db.prepare('UPDATE courses SET name=?, emoji=? WHERE id=?').run(plan.course_suggestion.slice(0, 60), (plan.course_emoji || '📘').slice(0, 4), finalCourse);
        }
      }
      db.prepare('UPDATE units SET title=?, status=?, subject=?, summary=?, data=? WHERE id=?')
        .run(unitHint || plan.unit_title, 'ready', plan.subject, plan.summary, JSON.stringify(plan), unitId);
    } catch (e) {
      console.error('generation failed:', e);
      db.prepare('UPDATE units SET status=?, error=? WHERE id=?').run('error', String(e.message || e).slice(0, 300), unitId);
      if (!courseId) db.prepare("UPDATE courses SET name='Unsorted' WHERE id=? AND name='Organizing…'").run(placeholderCourse);
    } finally {
      if (req.file) fs.rmSync(req.file.path, { force: true });
    }
  })();
});

app.get('/api/units/:id/status', auth, (req, res) => {
  const u = db.prepare('SELECT id, course_id, status, error, title FROM units WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json(u);
});

// ---------- practice ----------
function getQuestion(unit, lessonIdx, qIdx, provided) {
  const lesson = unit.data?.lessons?.[lessonIdx];
  if (!lesson) return {};
  // Similar questions are generated on the fly and sent back by the client (qIdx = -1).
  const q = qIdx >= 0 ? lesson.questions[qIdx] : provided;
  return { lesson, q };
}

function awardXp(userId, amount) {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  const t = today();
  let streak = u.streak;
  if (u.last_day !== t) {
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    streak = u.last_day === y ? streak + 1 : 1;
  }
  db.prepare('UPDATE users SET xp=xp+?, streak=?, last_day=? WHERE id=?').run(amount, streak, t, userId);
  return publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(userId));
}

app.post('/api/answer', auth, async (req, res) => {
  const { lessonIdx, qIdx, answer, choice, attempt = 1, combo = 0, question: provided } = req.body || {};
  const unit = loadUnit(req);
  if (!unit?.data) return res.status(404).json({ error: 'Unit not found' });
  const { lesson, q } = getQuestion(unit, Number(lessonIdx), Number(qIdx), provided);
  if (!q) return res.status(400).json({ error: 'Question not found' });

  let correct, grade = null;
  if (q.kind === 'mcq') {
    correct = Number(choice) === q.correct_index;
  } else {
    const ans = String(answer || '').slice(0, 2000);
    const quick = quickCheck(q, ans);
    if (quick === true) correct = true;
    else if (!aiEnabled) { correct = false; grade = demoGrade(q, ans); }
    else {
      // Budget check inline so instant local checks never count against the limit.
      if (!consumeAiCall(req.userId)) return res.status(429).json(LIMIT_MSG);
      try {
        grade = await gradeAnswer({ question: q, studentAnswer: ans, lessonTitle: lesson.title, subject: unit.subject });
        correct = grade.verdict === 'correct';
      } catch (e) { return aiError(res, e); }
    }
  }

  const xp = correct ? (attempt === 1 ? 20 : 10) + 5 * Math.min(Math.max(Number(combo) || 0, 0), 5) : 0;
  db.prepare('INSERT INTO attempts (user_id, unit_id, lesson_idx, q_idx, correct) VALUES (?, ?, ?, ?, ?)').run(req.userId, unit.id, lessonIdx, qIdx, correct ? 1 : 0);
  const user = xp ? awardXp(req.userId, xp) : publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.userId));
  res.json({ correct, xp, user, grade, partial: grade?.verdict === 'partially_correct' });
});

app.post('/api/similar', auth, aiBudget, async (req, res) => {
  const { lessonIdx, qIdx, answer, question: provided } = req.body || {};
  const unit = loadUnit(req);
  if (!unit?.data) return res.status(404).json({ error: 'Unit not found' });
  const { lesson, q } = getQuestion(unit, Number(lessonIdx), Number(qIdx), provided);
  if (!q) return res.status(400).json({ error: 'Question not found' });
  if (!aiEnabled) return res.json({ question: null });
  try {
    const nq = await similarQuestion({ question: q, studentAnswer: answer, lessonTitle: lesson.title, subject: unit.subject });
    if (nq.kind === 'mcq' && !(nq.correct_index >= 0 && nq.correct_index < nq.choices.length)) nq.kind = 'frq';
    res.json({ question: nq });
  } catch (e) { aiError(res, e); }
});

app.post('/api/tutor', auth, aiBudget, async (req, res) => {
  const { lessonIdx, message, questionText } = req.body || {};
  const unit = loadUnit(req);
  const lesson = unit?.data?.lessons?.[Number(lessonIdx)];
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  if (!String(message || '').trim()) return res.status(400).json({ error: 'Ask something!' });
  if (!aiEnabled) return res.json({ answer: '*(Demo mode)* Add an `ANTHROPIC_API_KEY` to chat with your AI tutor about this lesson.', visual: { type: 'none' } });
  try { res.json(await tutor({ lesson, questionText, message: String(message).slice(0, 2000), subject: unit.subject })); }
  catch (e) { aiError(res, e); }
});

app.post('/api/lesson-complete', auth, (req, res) => {
  const { lessonIdx, accuracy } = req.body || {};
  const unit = loadUnit(req);
  if (!unit?.data?.lessons?.[Number(lessonIdx)]) return res.status(404).json({ error: 'Not found' });
  const acc = Math.max(0, Math.min(1, Number(accuracy) || 0));
  const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1;
  const prev = db.prepare('SELECT stars, best_accuracy FROM lesson_results WHERE user_id=? AND unit_id=? AND lesson_idx=?').get(req.userId, unit.id, lessonIdx);
  db.prepare(`INSERT INTO lesson_results (user_id, unit_id, lesson_idx, stars, best_accuracy) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, unit_id, lesson_idx) DO UPDATE SET stars=MAX(stars, excluded.stars), best_accuracy=MAX(best_accuracy, excluded.best_accuracy)`)
    .run(req.userId, unit.id, lessonIdx, stars, acc);
  const bonus = prev ? 15 : 50;
  const user = awardXp(req.userId, bonus);
  res.json({ stars, bonus, user, newBest: !prev || stars > prev.stars });
});

app.get('/api/image', auth, async (req, res) => {
  const img = await findImage(req.query.q);
  res.json({ image: img });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.get('/{*splat}', (req, res) => res.sendFile(path.resolve('public/index.html')));

app.listen(PORT, () => {
  console.log(`\n  📚 Project Study running at http://localhost:${PORT}`);
  console.log(aiEnabled ? `  🤖 AI: ${MODEL}` : '  🧪 Demo mode (no ANTHROPIC_API_KEY set) — uploads create a sample unit.\n');
});
