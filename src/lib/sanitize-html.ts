// Isomorphic HTML sanitizer for user-authored rich-text (book chapters,
// comments, anywhere we use dangerouslySetInnerHTML on user input).
// Strips scripts, event handlers, javascript: URIs while preserving
// formatting markup and inline images.
import DOMPurify from "isomorphic-dompurify";

export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"],
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
  });
}
