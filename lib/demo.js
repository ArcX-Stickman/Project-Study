// Sample unit used when no ANTHROPIC_API_KEY is configured, so the full app can be tried for free.
const V = (o = {}) => ({
  type: 'none', title: '', caption: '', functions: [], points: [], window: null, events: [],
  image_query: '', table_headers: [], table_rows: [], steps: [], vectors: [], cards: [], bars: [], ...o,
});
const Q = (o) => ({
  kind: 'frq', choices: [], correct_index: -1, choice_feedback: [], accept: [], hint: '',
  solution_steps: [], common_mistake: '', answer_type: 'numeric', visual: V(), ...o,
});

export const demoUnit = {
  course_suggestion: 'AP Precalculus',
  course_emoji: '📈',
  subject: 'math',
  unit_title: 'Demo – Geometric Sequences (+ a history & physics sampler)',
  summary: 'A sample unit showing how Project Study teaches. Add an API key to generate units from your own PDFs.',
  lessons: [
    {
      title: 'What makes a sequence geometric?',
      emoji: '✖️',
      explanation: `Imagine a rumor. You tell **2** friends, each tells **3** more, each of those tells 3 more... The count goes $2, 6, 18, 54, \\dots$

Every step you **multiply by the same number**. That number is the **common ratio** $r$.

$$r = \\frac{a_{n+1}}{a_n}$$

So to get from term 1 to term $n$ you multiply by $r$ exactly $n-1$ times:

$$a_n = a_1 \\cdot r^{\\,n-1}$$

**Why $n-1$ and not $n$?** Term 1 *is* $a_1$ — zero multiplications happened yet. Term 2 had one, term 3 had two. That off-by-one is the #1 mistake on tests.

Compare to arithmetic sequences, where you **add** the same number each time. Arithmetic grows in a straight line; geometric grows (or shrinks) *exponentially* — look at the graph.`,
      key_points: ['Geometric = multiply by the same r each step', '$a_n = a_1 r^{n-1}$', 'Find r by dividing a term by the one before it', 'If $0<|r|<1$ the terms shrink toward 0'],
      visual: V({
        type: 'graph', title: 'Geometric vs. arithmetic', caption: 'The geometric sequence (multiply by 3) explodes while the arithmetic one (add 4) grows in a line.',
        functions: [{ expr: '2*3^(x-1)', label: 'geometric: 2·3^(n−1)' }, { expr: '2+4*(x-1)', label: 'arithmetic: 2+4(n−1)' }],
        points: [{ x: 1, y: 2, label: 'a₁=2' }, { x: 2, y: 6, label: '6' }, { x: 3, y: 18, label: '18' }, { x: 4, y: 54, label: '54' }],
        window: { xmin: 0, xmax: 4.6, ymin: -5, ymax: 60 },
      }),
      worked_example: {
        problem: 'Find the 6th term of $4, 12, 36, \\dots$',
        steps: ['Find r: $12 \\div 4 = 3$', 'Use $a_n = a_1 r^{n-1}$ with $a_1 = 4$, $n = 6$', '$a_6 = 4 \\cdot 3^{5}$', '$3^5 = 243$, so $a_6 = 972$'],
        answer: '972',
      },
      questions: [
        Q({
          kind: 'mcq', prompt: 'What is the common ratio of $5, 15, 45, 135, \\dots$?',
          choices: ['3', '10', '$\\frac{1}{3}$', '5'], correct_index: 0, answer: '3', answer_type: 'short_text',
          choice_feedback: [
            'Correct — each term is 3 times the one before it.',
            '10 is the *difference* $15-5$. That would be the common difference of an arithmetic sequence. Geometric sequences multiply, so divide instead.',
            'You divided the earlier term by the later one ($5 \\div 15$). The ratio is *next ÷ previous*.',
            '5 is the first term $a_1$, not the ratio.',
          ],
          hint: 'Divide any term by the term right before it.',
          solution_steps: ['$15 \\div 5 = 3$', '$45 \\div 15 = 3$', 'Same every time, so $r = 3$'],
          common_mistake: 'Subtracting terms (arithmetic thinking) instead of dividing.',
          visual: V({ type: 'table', title: 'Divide, don’t subtract', caption: 'The ratio column is constant — the difference column is not.', table_headers: ['n', 'aₙ', 'aₙ ÷ aₙ₋₁', 'aₙ − aₙ₋₁'], table_rows: [['1', '5', '—', '—'], ['2', '15', '3', '10'], ['3', '45', '3', '30'], ['4', '135', '3', '90']] }),
        }),
        Q({
          prompt: 'Find the 8th term of the geometric sequence $3, 6, 12, \\dots$',
          answer: '384', hint: 'r = 2. How many times do you multiply by 2 to get from term 1 to term 8?',
          solution_steps: ['$r = 6 \\div 3 = 2$', '$a_8 = 3 \\cdot 2^{8-1} = 3 \\cdot 2^7$', '$2^7 = 128$', '$3 \\cdot 128 = 384$'],
          common_mistake: 'Using $2^8$ instead of $2^7$ gives 768 — the exponent is $n-1$.',
          visual: V({ type: 'steps', title: 'Count the multiplications', caption: 'From term 1 to term 8 there are only 7 jumps.', steps: ['$a_1 = 3$ (0 jumps)', '$a_2 = 3\\cdot2$ (1 jump)', '$a_3 = 3\\cdot2^2$ (2 jumps)', '$\\dots$ pattern: term $n$ has $n-1$ jumps', '$a_8 = 3\\cdot 2^7 = 384$'] }),
        }),
        Q({
          prompt: 'A geometric sequence has $a_1 = 81$ and $r = \\frac{1}{3}$. Find $a_5$.',
          answer: '1', hint: 'Multiplying by 1/3 is the same as dividing by 3.',
          solution_steps: ['$a_5 = 81 \\cdot (\\tfrac13)^4$', '$(\\tfrac13)^4 = \\tfrac{1}{81}$', '$81 \\cdot \\tfrac{1}{81} = 1$'],
          common_mistake: 'Using exponent 5 gives 1/3; the exponent is 4.',
          visual: V({ type: 'number_line', title: 'Shrinking by thirds', caption: 'Each term is a third of the previous one, sliding toward 0.', points: [{ x: 81, y: 0, label: 'a₁' }, { x: 27, y: 0, label: 'a₂' }, { x: 9, y: 0, label: 'a₃' }, { x: 3, y: 0, label: 'a₄' }, { x: 1, y: 0, label: 'a₅' }], window: { xmin: 0, xmax: 85, ymin: 0, ymax: 0 } }),
        }),
        Q({
          kind: 'mcq', prompt: 'Which sequence is geometric?',
          choices: ['$2, 5, 8, 11$', '$1, 4, 9, 16$', '$64, 16, 4, 1$', '$3, 6, 10, 15$'], correct_index: 2, answer: '$64, 16, 4, 1$', answer_type: 'short_text',
          choice_feedback: ['This adds 3 each time — arithmetic, not geometric.', 'These are perfect squares $n^2$. Ratios are 4, 2.25, 1.78 — not constant.', 'Correct — each term is multiplied by $\\frac14$.', 'Differences grow by 1 (triangular numbers); ratios aren’t constant.'],
          hint: 'Check if dividing consecutive terms always gives the same number.',
          solution_steps: ['$16 \\div 64 = \\tfrac14$', '$4 \\div 16 = \\tfrac14$', '$1 \\div 4 = \\tfrac14$ → constant ratio'],
          common_mistake: 'Thinking “decreasing” means it can’t be geometric — r can be a fraction.',
          visual: V({ type: 'bar_chart', title: '64, 16, 4, 1', caption: 'Each bar is exactly ¼ of the one before.', bars: [{ label: 'a₁', value: 64 }, { label: 'a₂', value: 16 }, { label: 'a₃', value: 4 }, { label: 'a₄', value: 1 }] }),
        }),
      ],
    },
    {
      title: 'Forces as vectors (physics sampler)',
      emoji: '🧲',
      explanation: `A force has a **size** and a **direction**, so we draw it as an arrow — a **vector**.

When two forces act on the same object, add them **tip to tail**. Split each into horizontal and vertical parts and add the parts:

$$\\vec F_{net} = (F_{1x}+F_{2x},\\; F_{1y}+F_{2y})$$

The size of the net force comes from the Pythagorean theorem:

$$|\\vec F_{net}| = \\sqrt{F_x^2 + F_y^2}$$

**Why you can't just add the sizes:** 3 N east plus 4 N north does **not** make 7 N — the forces partly point in different directions, so the net is only 5 N.`,
      key_points: ['Vectors have size and direction', 'Add components, not magnitudes', 'Magnitude = √(Fx² + Fy²)'],
      visual: V({ type: 'vectors', title: '3 N east + 4 N north', caption: 'Tip-to-tail: the red net force is 5 N, not 7 N.', vectors: [{ from_x: 0, from_y: 0, x: 3, y: 0, label: 'F₁ = 3 N' }, { from_x: 3, from_y: 0, x: 0, y: 4, label: 'F₂ = 4 N' }, { from_x: 0, from_y: 0, x: 3, y: 4, label: 'F_net = 5 N' }], window: { xmin: -1, xmax: 6, ymin: -1, ymax: 5 } }),
      worked_example: { problem: 'A box is pulled with 6 N east and 8 N north. Net force magnitude?', steps: ['Components: $(6, 8)$', '$\\sqrt{6^2+8^2} = \\sqrt{100}$', '$= 10$ N'], answer: '10 N' },
      questions: [
        Q({
          prompt: 'Forces of 5 N east and 12 N north act on a cart. What is the magnitude of the net force (in N)?',
          answer: '13', hint: 'They are perpendicular — think right triangle.',
          solution_steps: ['$\\sqrt{5^2 + 12^2}$', '$= \\sqrt{169}$', '$= 13$ N'],
          common_mistake: 'Adding 5 + 12 = 17 ignores direction.',
          visual: V({ type: 'vectors', title: 'Tip to tail', caption: 'The net force is the hypotenuse, which is shorter than 5 + 12.', vectors: [{ from_x: 0, from_y: 0, x: 5, y: 0, label: '5 N' }, { from_x: 5, from_y: 0, x: 0, y: 12, label: '12 N' }, { from_x: 0, from_y: 0, x: 5, y: 12, label: 'net = ?' }], window: { xmin: -2, xmax: 14, ymin: -1, ymax: 13 } }),
        }),
        Q({
          kind: 'mcq', prompt: 'Two 10 N forces pull an object in exactly opposite directions. The net force is:',
          choices: ['20 N', '0 N', '10 N', '14.1 N'], correct_index: 1, answer: '0 N', answer_type: 'short_text',
          choice_feedback: ['You added the sizes. Opposite directions cancel — one is +10, the other −10.', 'Correct — equal and opposite forces cancel.', 'That’s just one of the forces. The other one cancels it.', '14.1 N = √200 would be for perpendicular forces, not opposite ones.'],
          hint: 'Give one force a + sign and the other a − sign.',
          solution_steps: ['$+10 + (-10) = 0$'], common_mistake: 'Adding magnitudes without signs.',
          visual: V({ type: 'vectors', title: 'Tug of war', caption: 'Same size, opposite direction: they cancel.', vectors: [{ from_x: 0, from_y: 0, x: 4, y: 0, label: '+10 N' }, { from_x: 0, from_y: 0, x: -4, y: 0, label: '−10 N' }], window: { xmin: -5, xmax: 5, ymin: -2, ymax: 2 } }),
        }),
      ],
    },
    {
      title: 'The War of 1812 (history sampler)',
      emoji: '⚔️',
      explanation: `The **War of 1812** (1812–1815) was fought between the **United States and Great Britain**.

**Why it started:** Britain was **impressing** (forcibly drafting) American sailors into its navy, restricting U.S. trade during its war with Napoleon, and backing Native American resistance to U.S. expansion in the West.

**Key moments:**
- **1814** – British troops **burned Washington, D.C.**, including the White House.
- **1814** – The defense of **Fort McHenry** inspired Francis Scott Key's "The Star-Spangled Banner."
- **Dec 1814** – The **Treaty of Ghent** ended the war, basically restoring pre-war borders.
- **Jan 1815** – The **Battle of New Orleans** was fought *after* the treaty was signed — news crossed the Atlantic slowly. Andrew Jackson's victory made him a national hero.`,
      key_points: ['Causes: impressment, trade restrictions, British support for Native resistance', 'Treaty of Ghent (1814) ended it', 'Battle of New Orleans happened after the treaty'],
      visual: V({ type: 'image', title: 'Battle of New Orleans', caption: 'Fought weeks after the peace treaty was signed.', image_query: 'Battle of New Orleans' }),
      worked_example: { problem: 'Why was the Battle of New Orleans fought after the war had officially ended?', steps: ['The Treaty of Ghent was signed in Dec 1814 in Belgium.', 'News traveled by ship and took weeks.', 'Armies in Louisiana did not know yet, so they fought in Jan 1815.'], answer: 'Slow communication across the Atlantic.' },
      questions: [
        Q({
          prompt: 'Which treaty ended the War of 1812?', answer: 'Treaty of Ghent', answer_type: 'short_text', accept: ['Ghent', 'The Treaty of Ghent'],
          hint: 'It is named after a city in present-day Belgium.', solution_steps: ['Signed December 24, 1814, in Ghent.'],
          common_mistake: 'Confusing it with the Treaty of Paris (1783), which ended the Revolutionary War.',
          visual: V({ type: 'timeline', title: 'Two different treaties', caption: 'Paris ended the Revolution; Ghent ended 1812.', events: [{ date: '1783', label: 'Treaty of Paris – ends Revolutionary War' }, { date: '1812', label: 'U.S. declares war on Britain' }, { date: 'Aug 1814', label: 'Washington, D.C. burned' }, { date: 'Dec 1814', label: 'Treaty of Ghent signed' }, { date: 'Jan 1815', label: 'Battle of New Orleans' }] }),
        }),
        Q({
          kind: 'mcq', prompt: 'Which event happened **after** the Treaty of Ghent was signed?',
          choices: ['Burning of Washington', 'Bombardment of Fort McHenry', 'Battle of New Orleans', 'U.S. declares war'], correct_index: 2, answer: 'Battle of New Orleans', answer_type: 'short_text',
          choice_feedback: ['Washington burned in August 1814, before the December treaty.', 'Fort McHenry was September 1814, before the treaty.', 'Correct — January 1815, weeks after the treaty.', 'War was declared in June 1812, at the very start.'],
          hint: 'News of peace traveled by ship.', solution_steps: ['Treaty: Dec 1814', 'New Orleans: Jan 1815'], common_mistake: 'Assuming the war’s biggest victory must have come before the peace.',
          visual: V({ type: 'timeline', title: 'Order of events', caption: 'Spot which event is to the right of the treaty.', events: [{ date: 'Jun 1812', label: 'War declared' }, { date: 'Aug 1814', label: 'Washington burned' }, { date: 'Sep 1814', label: 'Fort McHenry' }, { date: 'Dec 1814', label: 'Treaty of Ghent' }, { date: 'Jan 1815', label: 'Battle of New Orleans' }] }),
        }),
      ],
    },
  ],
};

export function demoGrade(q, ans) {
  return {
    verdict: 'incorrect',
    feedback: `Not quite — you answered **${String(ans).slice(0, 80)}**. ${q.common_mistake || ''}\n\n*(No AI key set: add a free Gemini key for feedback written about your exact answer.)*`,
    misconception: q.common_mistake ? q.common_mistake.split(/[.—]/)[0].slice(0, 60) : '',
    fix_steps: q.solution_steps.slice(0, -1),
    visual: q.visual,
    encouragement: 'Look at the visual, then give it another shot.',
  };
}
