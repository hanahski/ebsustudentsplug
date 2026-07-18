import { sanitizeHtml } from "./sanitize-html";

// Match [img:URL] where whitespace or line breaks may appear inside the brackets
// (users sometimes paste with a wrap in the middle of the URL). We collapse
// internal whitespace so the URL still resolves.
const IMG_TOKEN = /\[img:\s*(https?:\/\/[^\]]+?)\s*\]/gi;

function tokensToHtml(input: string): string {
  return input.replace(IMG_TOKEN, (_m, url: string) => {
    const clean = url.replace(/\s+/g, "");
    return `<p><img src="${clean}" alt="" loading="eager" style="max-width:100%;border-radius:12px;" /></p>`;
  });
}

/**
 * Render an article body (may be HTML from the composer, plain text, or contain
 * `[img:URL]` inline tokens) into safe HTML suitable for dangerouslySetInnerHTML.
 */
export function renderArticleHtml(body: string | null | undefined): string {
  if (!body) return "";
  const looksLikeHtml = /<\/?[a-z][^>]*>/i.test(body);
  let html = tokensToHtml(body);
  if (!looksLikeHtml) {
    // Convert double-newline paragraphs to <p>…</p>
    html = html
      .split(/\n\s*\n/)
      .map((p) => {
        const t = p.trim();
        if (!t) return "";
        if (/^<p>/i.test(t)) return t;
        return `<p>${t.replace(/\n/g, "<br/>")}</p>`;
      })
      .join("");
  }
  return sanitizeHtml(html);
}
