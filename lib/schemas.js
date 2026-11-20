// Structured-output schemas. Claude must return JSON matching these exactly,
// so the frontend can render visuals safely (no AI-written HTML/CSS/JS ever runs).
import { z } from 'zod';

export const Visual = z.object({
  type: z.enum([
    'none', 'graph', 'number_line', 'timeline', 'image', 'table',
    'steps', 'vectors', 'flashcards', 'bar_chart',
  ]).describe('Which visual to render. Pick the one that best builds intuition; use "none" only if nothing helps.'),
  title: z.string(),
  caption: z.string().describe('One sentence telling the student what to notice.'),
  functions: z.array(z.object({
    expr: z.string().describe('math.js expression in x, e.g. "x^2 - 3*x + 2", "2*(3)^x", "sin(x)". No "y=".'),
    label: z.string(),
  })).describe('graph only'),
  points: z.array(z.object({ x: z.number(), y: z.number(), label: z.string() }))
    .describe('graph: highlighted points. number_line: marks (y ignored, use 0).'),
  window: z.object({ xmin: z.number(), xmax: z.number(), ymin: z.number(), ymax: z.number() }).nullable()
    .describe('graph/vectors/number_line viewing window (number_line uses xmin/xmax).'),
  events: z.array(z.object({ date: z.string(), label: z.string() })).describe('timeline only, chronological'),
  image_query: z.string().describe('image only: a precise Wikipedia/Wikimedia search, e.g. "Battle of New Orleans 1815 painting"'),
  table_headers: z.array(z.string()),
  table_rows: z.array(z.array(z.string())),
  steps: z.array(z.string()).describe('steps: ordered reveal-one-at-a-time steps; may contain $LaTeX$'),
  vectors: z.array(z.object({
    from_x: z.number(), from_y: z.number(), x: z.number(), y: z.number(), label: z.string(),
  })).describe('vectors: arrows from (from_x,from_y) with components (x,y), e.g. forces'),
  cards: z.array(z.object({ front: z.string(), back: z.string() })).describe('flashcards: vocab/terms'),
  bars: z.array(z.object({ label: z.string(), value: z.number() })).describe('bar_chart only'),
});

export const Question = z.object({
  kind: z.enum(['mcq', 'frq']),
  prompt: z.string().describe('The question. Markdown + $LaTeX$ allowed.'),
  choices: z.array(z.string()).describe('mcq: 4 choices. frq: empty array.'),
  correct_index: z.number().int().describe('mcq: index of correct choice. frq: -1'),
  choice_feedback: z.array(z.string()).describe('mcq: one entry per choice explaining exactly what misconception leads to that choice (or why it is right). frq: empty.'),
  answer: z.string().describe('Canonical correct answer (frq) or the correct choice text (mcq).'),
  answer_type: z.enum(['numeric', 'expression', 'short_text', 'long_text']),
  accept: z.array(z.string()).describe('Other equivalent answers to accept verbatim, e.g. "1/2", "0.5".'),
  hint: z.string(),
  solution_steps: z.array(z.string()).describe('Worked solution, one step per entry.'),
  common_mistake: z.string().describe('The single most likely mistake and how to avoid it.'),
  visual: Visual.describe('Visual shown when the student gets it wrong, aimed at fixing the misconception.'),
});

export const Lesson = z.object({
  title: z.string(),
  emoji: z.string(),
  explanation: z.string().describe('Khan-Academy-style teaching: intuition first, then the rule, then why it works. Markdown + $LaTeX$. 150-350 words.'),
  key_points: z.array(z.string()),
  visual: Visual,
  worked_example: z.object({
    problem: z.string(),
    steps: z.array(z.string()),
    answer: z.string(),
  }),
  questions: z.array(Question),
});

export const UnitPlan = z.object({
  course_suggestion: z.string().describe('Class name this material belongs to, e.g. "AP Precalculus", "Physics 1", "Spanish 2".'),
  course_emoji: z.string(),
  subject: z.enum(['math', 'physics', 'chemistry', 'biology', 'history', 'language', 'english', 'engineering', 'computer_science', 'other']),
  unit_title: z.string().describe('e.g. "Unit 2 – Geometric Sequences"'),
  summary: z.string(),
  lessons: z.array(Lesson),
});

export const Grade = z.object({
  verdict: z.enum(['correct', 'partially_correct', 'incorrect']),
  feedback: z.string().describe('Speak to the student. Pinpoint WHERE their reasoning went wrong, referencing their actual answer. Markdown + $LaTeX$.'),
  misconception: z.string().describe('Name the misconception in under 10 words, or "" if correct.'),
  fix_steps: z.array(z.string()).describe('Short steps that walk from their mistake to the right idea.'),
  visual: Visual,
  encouragement: z.string().describe('One short, genuine sentence. No fluff.'),
});

export const TutorReply = z.object({
  answer: z.string().describe('Markdown + $LaTeX$ explanation.'),
  visual: Visual,
});
