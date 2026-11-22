// Free models and hand-pasted chatbot output often skip fields or use the wrong types.
// These functions fill sensible defaults so the strict schemas can still validate.
const str = (v, d = '') => (v == null ? d : typeof v === 'string' ? v : String(v));
const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

const VISUAL_TYPES = ['none', 'graph', 'number_line', 'timeline', 'image', 'table', 'steps', 'vectors', 'flashcards', 'bar_chart'];

export function normalizeVisual(v) {
  v = v && typeof v === 'object' ? v : {};
  const w = v.window && typeof v.window === 'object' ? v.window : null;
  return {
    type: VISUAL_TYPES.includes(v.type) ? v.type : 'none',
    title: str(v.title),
    caption: str(v.caption),
    functions: arr(v.functions).map((f) => (typeof f === 'string' ? { expr: f, label: f } : { expr: str(f?.expr), label: str(f?.label, str(f?.expr)) })).filter((f) => f.expr),
    points: arr(v.points).map((p) => ({ x: num(p?.x), y: num(p?.y), label: str(p?.label) })),
    window: w ? { xmin: num(w.xmin, -10), xmax: num(w.xmax, 10), ymin: num(w.ymin, -10), ymax: num(w.ymax, 10) } : null,
    events: arr(v.events).map((e) => ({ date: str(e?.date), label: str(e?.label) })),
    image_query: str(v.image_query),
    table_headers: arr(v.table_headers).map((h) => str(h)),
    table_rows: arr(v.table_rows).map((r) => arr(r).map((c) => str(c))),
    steps: arr(v.steps).map((s) => str(s)),
    vectors: arr(v.vectors).map((a) => ({ from_x: num(a?.from_x), from_y: num(a?.from_y), x: num(a?.x), y: num(a?.y), label: str(a?.label) })),
    cards: arr(v.cards).map((c) => ({ front: str(c?.front), back: str(c?.back) })),
    bars: arr(v.bars).map((b) => ({ label: str(b?.label), value: num(b?.value) })),
  };
}

export function normalizeQuestion(q) {
  q = q && typeof q === 'object' ? q : {};
  const choices = arr(q.choices).map((c) => str(c));
  let kind = q.kind === 'mcq' || (q.kind == null && choices.length >= 2) ? 'mcq' : 'frq';
  let correct = Math.trunc(num(q.correct_index, -1));
  if (kind === 'mcq' && !(correct >= 0 && correct < choices.length)) {
    // Models sometimes give the answer text instead of the index.
    const i = choices.findIndex((c) => c.trim().toLowerCase() === str(q.answer).trim().toLowerCase());
    if (i >= 0) correct = i; else kind = 'frq';
  }
  const fb = arr(q.choice_feedback).map((s) => str(s));
  return {
    kind,
    prompt: str(q.prompt || q.question),
    choices: kind === 'mcq' ? choices : [],
    correct_index: kind === 'mcq' ? correct : -1,
    choice_feedback: kind === 'mcq' ? choices.map((_, i) => fb[i] || '') : [],
    answer: str(q.answer, kind === 'mcq' ? choices[correct] : ''),
    answer_type: ['numeric', 'expression', 'short_text', 'long_text'].includes(q.answer_type) ? q.answer_type : 'short_text',
    accept: arr(q.accept).map((s) => str(s)),
    hint: str(q.hint),
    solution_steps: arr(q.solution_steps).map((s) => str(s)),
    common_mistake: str(q.common_mistake),
    visual: normalizeVisual(q.visual),
  };
}

export function normalizePlan(p) {
  p = p && typeof p === 'object' ? p : {};
  const subjects = ['math', 'physics', 'chemistry', 'biology', 'history', 'language', 'english', 'engineering', 'computer_science', 'other'];
  return {
    course_suggestion: str(p.course_suggestion, 'My Class') || 'My Class',
    course_emoji: str(p.course_emoji, '📘') || '📘',
    subject: subjects.includes(p.subject) ? p.subject : 'other',
    unit_title: str(p.unit_title, 'New Unit') || 'New Unit',
    summary: str(p.summary),
    lessons: arr(p.lessons).map((l) => ({
      title: str(l?.title, 'Lesson'),
      emoji: str(l?.emoji, '⭐') || '⭐',
      explanation: str(l?.explanation),
      key_points: arr(l?.key_points).map((s) => str(s)),
      visual: normalizeVisual(l?.visual),
      worked_example: {
        problem: str(l?.worked_example?.problem),
        steps: arr(l?.worked_example?.steps).map((s) => str(s)),
        answer: str(l?.worked_example?.answer),
      },
      questions: arr(l?.questions).map(normalizeQuestion).filter((q) => q.prompt && (q.answer || q.kind === 'mcq')),
      boss: { name: str(l?.boss?.name), emoji: str(l?.boss?.emoji), taunt: str(l?.boss?.taunt) },
    })).filter((l) => l.questions.length),
  };
}

export const normalizeGrade = (g) => ({
  verdict: ['correct', 'partially_correct', 'incorrect'].includes(g?.verdict) ? g.verdict : 'incorrect',
  feedback: str(g?.feedback),
  misconception: str(g?.misconception),
  fix_steps: arr(g?.fix_steps).map((s) => str(s)),
  visual: normalizeVisual(g?.visual),
  encouragement: str(g?.encouragement),
});

export const normalizeTutor = (t) => ({ answer: str(t?.answer), visual: normalizeVisual(t?.visual) });

/** Pull a JSON object out of chatbot text (handles ```json fences and chatter around it). */
export function extractJson(text) {
  const s = String(text || '');
  const slice = (t) => { const a = t.indexOf('{'), b = t.lastIndexOf('}'); return a >= 0 && b > a ? t.slice(a, b + 1) : null; };
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  // Candidates: the first code block, the whole text, and the text with every ``` fence line removed
  // (that last one stitches a reply that was cut off and continued in a second message).
  const candidates = [fenced?.[1], s, s.replace(/^\s*```[a-z]*\s*$/gim, '')].map((t) => t && slice(t)).filter(Boolean);
  if (!candidates.length) throw new Error(s.includes('{') ? 'The reply looks cut off. Type "continue" in the chatbot and paste both parts.' : 'No JSON found. Paste the whole reply from the chatbot.');
  let err;
  for (const c of candidates) { try { return JSON.parse(c); } catch (e) { err = e; } }
  throw new Error('That JSON is broken or cut off (' + err.message + '). Ask the chatbot to "continue" or regenerate, then paste the full thing.');
}
