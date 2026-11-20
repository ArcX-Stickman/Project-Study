// Free, instant answer checks done before spending an AI call.
import { create, all } from 'mathjs';

const math = create(all);
// Lock down the expression parser: no imports, no function definitions, etc.
const limitedEvaluate = math.evaluate;
math.import({
  import: () => { throw new Error('disabled'); },
  createUnit: () => { throw new Error('disabled'); },
  evaluate: () => { throw new Error('disabled'); },
  parse: () => { throw new Error('disabled'); },
  simplify: () => { throw new Error('disabled'); },
  derivative: () => { throw new Error('disabled'); },
}, { override: true });

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFC')
  .replace(/\$|\\,|\\!|\\ /g, '').replace(/\\(d|t)?frac\{([^}]*)\}\{([^}]*)\}/g, '($2)/($3)')
  .replace(/\\cdot|\\times/g, '*').replace(/\\left|\\right/g, '').replace(/\{|\}/g, '')
  .replace(/[\s.,!?;:'"]+$/g, '').replace(/^(the|a|an)\s+/, '').replace(/\s+/g, ' ').trim();

function toNumber(s) {
  let t = norm(s).replace(/,/g, '').replace(/π/g, 'pi').replace(/√/g, 'sqrt')
    .replace(/\s*(n|newtons?|m\/s\^?2?|m|kg|s|j|w|degrees?|°|%|units?)$/i, '');
  if (!t || t.length > 60 || /[a-oq-z]/i.test(t.replace(/pi|sqrt|e(?=[+-]?\d)/g, ''))) return null;
  try {
    const v = limitedEvaluate(t);
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch { return null; }
}

function exprEquivalent(a, b) {
  const A = norm(a).replace(/^[a-z]\s*\(?[a-z]?\)?\s*=/, ''); // strip "y =", "f(x) ="
  const B = norm(b).replace(/^[a-z]\s*\(?[a-z]?\)?\s*=/, '');
  if (!A || !B || A.length > 120) return false;
  const vars = [...new Set((A + B).match(/\b[a-z]\b/g) || [])].filter((v) => v !== 'e');
  try {
    for (let i = 0; i < 6; i++) {
      const scope = Object.fromEntries(vars.map((v) => [v, 0.37 + i * 1.13]));
      const x = limitedEvaluate(A, scope), y = limitedEvaluate(B, scope);
      if (typeof x !== 'number' || typeof y !== 'number') return false;
      if (Math.abs(x - y) > 1e-6 * Math.max(1, Math.abs(y))) return false;
    }
    return true;
  } catch { return false; }
}

/** Returns true (definitely correct), false (definitely wrong numeric), or null (needs AI). */
export function quickCheck(q, answer) {
  const candidates = [q.answer, ...(q.accept || [])];
  const a = norm(answer);
  if (!a) return false;
  if (candidates.some((c) => norm(c) === a)) return true;
  if (q.answer_type === 'numeric') {
    const got = toNumber(answer);
    const want = candidates.map(toNumber).filter((v) => v !== null);
    if (got !== null && want.length) {
      return want.some((w) => Math.abs(got - w) <= Math.max(1e-9, Math.abs(w) * 0.005));
    }
  }
  if (q.answer_type === 'expression' && candidates.some((c) => exprEquivalent(c, answer))) return true;
  return null;
}
