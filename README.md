# 📚 Project Study

An AI-powered, game-like study app. Upload your class material (a test, review sheet, or notes as a PDF) and Claude turns it into a practice unit:

- **Classes → Units → Lessons**: e.g. `AP Precalculus` → `Unit 5 – Geometric Sequences`. Name them yourself or let the AI organize them.
- **Khan-Academy-style lessons**: intuition first, then the rule, then a worked example you reveal one step at a time.
- **MCQs and FRQs** that test the same skills as your material, with new numbers and contexts.
- **Feedback on wrong answers that explains the mistake**: instead of "try again", it works out what reasoning most likely produced *your* answer, shows a visual that targets that misconception, and then asks you again with a fresh problem on the same skill.
- **Interactive visuals**: traceable function graphs, number lines, force vectors with components, timelines, step-by-step reveals, flashcards, tables, bar charts, and cited Wikimedia Commons images for history and science.
- **Game feel**: XP, levels, combos, daily streaks, 1–3 star mastery per lesson, a lesson map, confetti, and synthesized sound effects (mutable).
- **Any subject**: math, physics, chemistry, history, Spanish, English, engineering, and more.

## Quick start

Requires **Node.js 22.13+** (uses the built-in SQLite).

```bash
npm install
cp .env.example .env      # then put your Anthropic API key in .env
npm start                 # http://localhost:3000
```

To load the `.env` file, run `node --env-file=.env --disable-warning=ExperimentalWarning server.js`, or export the variables in your shell.

**No API key?** The app runs in **demo mode**: uploading anything creates a sample unit (geometric sequences, physics vectors, War of 1812), so you can try the whole experience for free.

Get an API key at <https://console.anthropic.com>. You pay per use.

## Run it in GitHub Codespaces (no install needed)

1. On the repo page, click **Code → Codespaces → Create codespace on main**. It installs everything automatically (Node 22 is pinned in `.devcontainer/`).
2. In the terminal, run `npm start`.
3. Click **Open in Browser** on the popup for port 3000 (or use the **Ports** tab).

**To use real AI in Codespaces:** add your key as a Codespaces secret, not in a file. Go to GitHub **Settings → Codespaces → Secrets → New secret**, name it `ANTHROPIC_API_KEY`, and give this repo access. Then restart the codespace. The server reads the key from the environment automatically.

Notes:
- The forwarded port is **private** by default (only you can open it). Don't make it public unless you mean to share your API bill.
- Codespaces stop after ~30 minutes idle. Your accounts and units in `data/` persist in that codespace until you delete it, but not across different codespaces.
- Free GitHub accounts get a monthly allowance of Codespaces hours; check your usage under Settings → Billing.

## How it works

| Piece | What it does |
|---|---|
| `server.js` | Express API: accounts, classes and units, uploads, grading, XP |
| `lib/ai.js` | Every Claude call. PDFs go straight to Claude, which reads text, tables, and diagrams |
| `lib/schemas.js` | Strict JSON schemas for lessons, questions, grades, and visuals |
| `lib/check.js` | Free instant checks (equivalent numbers, fractions, algebraic expressions) that run before any AI call |
| `lib/images.js` | Wikimedia Commons image search with author and license attribution |
| `public/visuals.js` | Turns visual specs into interactive graphs, vectors, timelines, and more |
| `public/sound.js` | Web Audio sound effects; no audio files needed |

**Safety design:** the AI never writes HTML, CSS, or JavaScript that runs in your browser. It returns structured data (for example, "graph `2*3^(x-1)` from x=0 to 4"), and the app draws it. All AI text is sanitized, a strict Content-Security-Policy is set, and only images from `upload.wikimedia.org` are allowed.

## Cost control

- Correct answers that the local checker can verify cost **$0**. Only wrong or ambiguous answers call the AI.
- Multiple-choice feedback is generated up front with the unit, so a wrong MCQ costs nothing except the optional "similar question".
- Each user is limited to `AI_CALLS_PER_HOUR` AI calls per hour (default 80).
- Generating a unit from a multi-page test is the most expensive call. Expect a few cents to a few tens of cents per unit, depending on length.

## Before you publish this for other students

Read this first:

1. **API bill.** Every user spends *your* API credits. Add per-user daily caps, bring-your-own-key, or a payment plan before you open it up.
2. **Hosting.** Use a host with a persistent disk for `data/` (SQLite and uploads), and set `NODE_ENV=production` behind HTTPS so cookies are `Secure`.
3. **Accounts.** There is no password reset, email verification, or CAPTCHA yet.
4. **Privacy and minors.** If users are under 13 (US), COPPA applies. Write a privacy policy that says uploads are sent to Anthropic for processing.
5. **Academic integrity and copyright.** Teachers' tests are their property. Encourage uploading study guides and notes, not live exams.
6. **AI answer keys can be wrong.** The prompt asks Claude to double-check its answers, but add a "report this question" button before trusting it at scale.

## License

MIT
