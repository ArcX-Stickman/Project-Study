// Google Gemini provider (has a free tier: get a key at https://aistudio.google.com/apikey).
// Uses plain REST so there is no extra SDK dependency.
import { z } from 'zod';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const KEY = process.env.GEMINI_API_KEY;

let models = null; // { main, light }

/**
 * Free-tier model names change every few months, so instead of hardcoding one we ask the API
 * which models this key can use and pick the newest "flash" (for building units) and
 * "flash-lite" (for grading/tutoring, which usually has a much bigger free daily quota).
 * GEMINI_MODEL / GEMINI_LIGHT_MODEL override the choice.
 */
export async function geminiModels() {
  if (models) return models;
  let names = [];
  try {
    const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': KEY }, signal: AbortSignal.timeout(15000) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `HTTP ${r.status}`);
    names = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''));
  } catch (e) {
    console.warn('Could not list Gemini models:', e.message);
  }
  const ver = (n) => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const flash = names
    .filter((n) => /^gemini-\d/.test(n) && /flash/.test(n) && !/(image|tts|audio|live|embedding|native|computer|robotics)/.test(n))
    .sort((a, b) => ver(b) - ver(a) || /preview|exp/.test(a) - /preview|exp/.test(b));
  const stable = flash.filter((n) => !/preview|exp/.test(n));
  const pool = stable.length ? stable : flash;
  const main = process.env.GEMINI_MODEL || pool.find((n) => !/lite/.test(n)) || pool[0] || 'gemini-flash-latest';
  const light = process.env.GEMINI_LIGHT_MODEL || pool.find((n) => /lite/.test(n)) || main;
  models = { main, light };
  return models;
}

function toGeminiSchema(schema) {
  const s = z.toJSONSchema(schema); // inline (no $ref) — simplest for Gemini
  delete s.$schema;
  return s;
}

function toParts(content) {
  return content.map((c) => (c.type === 'document'
    ? { inlineData: { mimeType: c.source.media_type, data: c.source.data } }
    : { text: c.text }));
}

// Errors where trying again later, or with the other model, can succeed.
class QuotaError extends Error {}
class BusyError extends Error {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(model, { system, content, schema, maxTokens }) {
  const r = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10 * 60 * 1000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: toParts(content) }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: toGeminiSchema(schema), maxOutputTokens: maxTokens },
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 429) throw new QuotaError(`Free Gemini limit reached for ${model}. Wait a minute (or until tomorrow for the daily limit) and try again.`);
  if ([500, 502, 503, 504].includes(r.status)) throw new BusyError(`Google's free Gemini servers are overloaded right now (${model}). This is usually over in a few minutes. Click Retry.`);
  if (!r.ok) throw new Error(`Gemini error: ${j.error?.message || r.status}`);
  const cand = j.candidates?.[0];
  if (!cand) throw new Error(`Gemini returned nothing${j.promptFeedback?.blockReason ? ` (blocked: ${j.promptFeedback.blockReason})` : ''}.`);
  if (cand.finishReason === 'MAX_TOKENS') throw new Error('Gemini ran out of room and cut the unit off. Try a shorter document.');
  const text = (cand.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
  try { return JSON.parse(text); } catch { throw new Error('Gemini returned malformed JSON. Try again.'); }
}

/**
 * Runs one request. `heavy` requests (building a unit) prefer the stronger model and fall back to the
 * lighter one if its free quota is used up; light requests (grading, tutor) use the lighter model.
 */
export async function geminiStructured({ heavy, ...req }) {
  const { main, light } = await geminiModels();
  const order = heavy ? [...new Set([main, light])] : [...new Set([light, main])];
  let lastErr;
  for (const m of order) {
    // Overloaded ("high demand") errors are usually brief: retry the same model with growing waits first.
    for (const wait of [0, 3000, 8000, 15000]) {
      if (wait) { console.warn(`Gemini busy, retrying ${m} in ${wait / 1000}s…`); await sleep(wait); }
      try { return await call(m, req); }
      catch (e) {
        lastErr = e;
        if (e instanceof BusyError) continue;   // try this model again
        if (e instanceof QuotaError) break;     // quota used up: move to the next model
        throw e;
      }
    }
  }
  throw lastErr;
}
