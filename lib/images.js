// Finds a freely licensed image on Wikimedia Commons and returns full attribution.
import { db } from './db.js';

const UA = 'ProjectStudy/1.0 (open-source educational study app)';
const stripHtml = (s = '') => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Wikimedia ${r.status}`);
  return r.json();
}

async function fileInfo(fileTitle) {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({ action: 'query', format: 'json', titles: fileTitle, prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '900' })
    .forEach(([k, v]) => u.searchParams.set(k, v));
  const j = await getJson(u);
  const page = Object.values(j.query?.pages || {})[0];
  const ii = page?.imageinfo?.[0];
  if (!ii || !/^image\/(jpeg|png|gif|webp)/.test(ii.mime || '')) return null;
  const m = ii.extmetadata || {};
  return {
    url: ii.thumburl || ii.url,
    page: ii.descriptionurl,
    title: stripHtml(m.ObjectName?.value) || fileTitle.replace(/^File:/, ''),
    artist: stripHtml(m.Artist?.value) || 'Unknown',
    license: stripHtml(m.LicenseShortName?.value) || 'See source',
    license_url: m.LicenseUrl?.value || '',
    source: 'Wikimedia Commons',
  };
}

export async function findImage(query) {
  const q = String(query || '').slice(0, 200).trim();
  if (!q) return null;
  const cached = db.prepare('SELECT result FROM image_cache WHERE query=?').get(q);
  if (cached) return JSON.parse(cached.result);

  let result = null;
  try {
    // 1) Lead image of the best-matching Wikipedia article (usually the most relevant picture).
    const w = new URL('https://en.wikipedia.org/w/api.php');
    Object.entries({ action: 'query', format: 'json', generator: 'search', gsrsearch: q, gsrlimit: '3', prop: 'pageimages|info', piprop: 'name', inprop: 'url' })
      .forEach(([k, v]) => w.searchParams.set(k, v));
    const wj = await getJson(w);
    const pages = Object.values(wj.query?.pages || {}).sort((a, b) => a.index - b.index);
    for (const p of pages) {
      if (!p.pageimage) continue;
      result = await fileInfo(`File:${p.pageimage}`);
      if (result) { result.article = p.title; result.article_url = p.fullurl; break; }
    }
    // 2) Fall back to a direct Commons file search.
    if (!result) {
      const c = new URL('https://commons.wikimedia.org/w/api.php');
      Object.entries({ action: 'query', format: 'json', list: 'search', srsearch: q, srnamespace: '6', srlimit: '5' })
        .forEach(([k, v]) => c.searchParams.set(k, v));
      const cj = await getJson(c);
      for (const hit of cj.query?.search || []) {
        result = await fileInfo(hit.title);
        if (result) break;
      }
    }
  } catch (e) {
    console.warn('image lookup failed:', e.message);
    return null; // don't cache network failures
  }
  db.prepare('INSERT OR REPLACE INTO image_cache (query, result) VALUES (?, ?)').run(q, JSON.stringify(result));
  return result;
}
