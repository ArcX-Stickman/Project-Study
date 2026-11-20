// Safe Markdown + LaTeX rendering. AI text is sanitized; only KaTeX output is inserted as HTML.
const Render = (() => {
  const MATH = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$((?:\\\$|[^$\n])+?)\$/g;

  function md(text, { inline = false } = {}) {
    const store = [];
    const withTokens = String(text ?? '').replace(MATH, (m, d1, d2, i1, i2) => {
      const display = d1 !== undefined || d2 !== undefined;
      const tex = d1 ?? d2 ?? i1 ?? i2;
      let html;
      try { html = katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false, strict: 'ignore' }); }
      catch { html = escapeHtml(m); }
      store.push(html);
      return `@@MATH${store.length - 1}@@`;
    });
    const raw = inline ? marked.parseInline(withTokens) : marked.parse(withTokens, { breaks: true });
    const clean = DOMPurify.sanitize(raw, { FORBID_TAGS: ['style', 'form', 'input', 'img'], FORBID_ATTR: ['style'] });
    return clean.replace(/@@MATH(\d+)@@/g, (_, i) => store[Number(i)] ?? '');
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  return { md, inline: (t) => md(t, { inline: true }), esc: escapeHtml };
})();
