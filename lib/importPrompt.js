// Prompt a student can paste into ANY free chatbot (claude.ai, ChatGPT, Gemini…) together with their PDF.
// The chatbot replies with JSON that the app imports — no API key or credits needed.
import { GEN_SYSTEM } from './ai.js';

const SKELETON = {
  course_suggestion: 'AP Precalculus',
  course_emoji: '📈',
  subject: 'math | physics | chemistry | biology | history | language | english | engineering | computer_science | other',
  unit_title: 'Unit 2 – Geometric Sequences',
  summary: 'One sentence on what this unit covers.',
  lessons: [{
    title: 'Lesson title',
    emoji: '✖️',
    explanation: 'Teaching text in Markdown with $LaTeX$ math (150-350 words).',
    key_points: ['point 1', 'point 2'],
    visual: { type: 'graph', title: 'Title', caption: 'What to notice', functions: [{ expr: '2*3^(x-1)', label: 'a_n' }], points: [{ x: 1, y: 2, label: 'a1' }], window: { xmin: 0, xmax: 5, ymin: -5, ymax: 60 } },
    worked_example: { problem: 'Problem', steps: ['step 1', 'step 2'], answer: 'answer' },
    boss: { name: 'The Exponent Hydra', emoji: '🐉', taunt: 'You will never find my common ratio!' },
    questions: [
      { kind: 'mcq', prompt: 'Question?', choices: ['A', 'B', 'C', 'D'], correct_index: 0, choice_feedback: ['why A is right', 'mistake that leads to B', 'mistake that leads to C', 'mistake that leads to D'], answer: 'A', answer_type: 'short_text', accept: [], hint: 'hint', solution_steps: ['step'], common_mistake: 'most common mistake', visual: { type: 'table', title: '', caption: '', table_headers: ['n', 'a_n'], table_rows: [['1', '2']] } },
      { kind: 'frq', prompt: 'Find the 8th term of 3, 6, 12, ...', choices: [], correct_index: -1, choice_feedback: [], answer: '384', answer_type: 'numeric', accept: ['3*2^7'], hint: 'hint', solution_steps: ['r = 2', '3*2^7 = 384'], common_mistake: 'Using 2^8', visual: { type: 'steps', title: '', caption: '', steps: ['step 1', 'step 2'] } },
    ],
  }],
};

export function buildImportPrompt({ courseName, unitTitle } = {}) {
  return `${GEN_SYSTEM}

${courseName ? `The class is "${courseName}". ` : ''}${unitTitle ? `The unit is called "${unitTitle}". ` : ''}My class material is attached (or pasted below).

VISUAL FIELDS by type: graph → functions, points, window · number_line → points (x only), window · vectors → vectors [{from_x, from_y, x, y, label}], window · timeline → events [{date, label}] · image → image_query · table → table_headers, table_rows · steps → steps · flashcards → cards [{front, back}] · bar_chart → bars [{label, value}]. Use {"type": "none"} if no visual helps.

OUTPUT: Reply with ONLY one JSON object in a single \`\`\`json code block, no other text, following exactly this shape (replace the example content with the real unit):

\`\`\`json
${JSON.stringify(SKELETON, null, 1)}
\`\`\`

If your reply gets cut off, I will say "continue" and you continue the JSON exactly where it stopped.`;
}
