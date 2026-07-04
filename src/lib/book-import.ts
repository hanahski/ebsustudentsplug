// Client-side importer for PDF and EPUB files into the book composer.
// Returns a list of chapter drafts (title + HTML) ready to insert into
// user_book_chapters. Images are inlined as data URIs so they survive
// without a storage round-trip; EPUB image tags are rewritten to point
// at the extracted blob URLs.

import JSZip from "jszip";

export type ImportedChapter = { title: string; html: string };

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

// ---------------- PDF ----------------
// One chapter per detected heading, or one chapter every N pages if the
// document has no obvious structure. Text is grouped into paragraphs by
// blank-line heuristics from pdfjs text layer output.
export async function importPdfToChapters(
  file: File | Blob,
  opts: { pagesPerChapter?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<ImportedChapter[]> {
  const { pagesPerChapter = 8, onProgress } = opts;
  const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const total = doc.numPages;

  const pageHtml: string[] = [];
  const headings: { page: number; title: string }[] = [];

  for (let p = 1; p <= total; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const lines: string[] = [];
    let cur = "";
    let lastY: number | null = null;
    for (const item of tc.items as any[]) {
      const str = String(item.str ?? "");
      const y = item.transform?.[5] ?? 0;
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        if (cur.trim()) lines.push(cur.trim());
        cur = "";
      }
      cur += str + (item.hasEOL ? "\n" : " ");
      lastY = y;
    }
    if (cur.trim()) lines.push(cur.trim());

    const paragraphs: string[] = [];
    let buffer = "";
    for (const l of lines) {
      const clean = l.replace(/\s+/g, " ").trim();
      if (!clean) {
        if (buffer) paragraphs.push(buffer.trim());
        buffer = "";
        continue;
      }
      // Detect heading-ish lines: short, mostly caps or Title Case.
      const isHeading =
        clean.length < 80 &&
        (/^(CHAPTER|Chapter|Part|PART|Section|SECTION)\b/.test(clean) ||
          (clean === clean.toUpperCase() && clean.split(" ").length <= 8 && /[A-Z]/.test(clean)));
      if (isHeading) {
        if (buffer) paragraphs.push(buffer.trim());
        buffer = "";
        paragraphs.push(`__H__${clean}`);
        headings.push({ page: p, title: clean });
      } else {
        buffer += (buffer ? " " : "") + clean;
      }
    }
    if (buffer) paragraphs.push(buffer.trim());

    pageHtml.push(
      paragraphs
        .map((p) =>
          p.startsWith("__H__")
            ? `<h2>${esc(p.slice(5))}</h2>`
            : `<p>${esc(p)}</p>`,
        )
        .join("\n"),
    );
    onProgress?.(p, total);
    page.cleanup();
  }
  await doc.destroy();

  // Group into chapters — prefer detected headings; fall back to fixed page runs.
  const chapters: ImportedChapter[] = [];
  if (headings.length >= 2) {
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i];
      const nextPage = headings[i + 1]?.page ?? total + 1;
      const body = pageHtml.slice(h.page - 1, nextPage - 1).join("\n");
      chapters.push({ title: h.title, html: body });
    }
  } else {
    for (let start = 0; start < total; start += pagesPerChapter) {
      const end = Math.min(total, start + pagesPerChapter);
      chapters.push({
        title: `Chapter ${chapters.length + 1}`,
        html: pageHtml.slice(start, end).join("\n"),
      });
    }
  }
  return chapters.length ? chapters : [{ title: "Chapter 1", html: pageHtml.join("\n") }];
}

// ---------------- EPUB ----------------
// Parse the OPF spine and pull each XHTML file as one chapter. Images are
// rewritten to data URIs (small books) so the reader shows them inline.
export async function importEpubToChapters(file: File | Blob): Promise<ImportedChapter[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  // Find the OPF path via META-INF/container.xml.
  const containerXml = await zip.file("META-INF/container.xml")?.async("string");
  if (!containerXml) throw new Error("Not a valid EPUB (missing container.xml)");
  const opfPath = /full-path="([^"]+)"/.exec(containerXml)?.[1];
  if (!opfPath) throw new Error("EPUB manifest not found");

  const opfXml = await zip.file(opfPath)?.async("string");
  if (!opfXml) throw new Error("EPUB OPF not readable");
  const baseDir = opfPath.includes("/") ? opfPath.replace(/[^/]+$/, "") : "";

  // Manifest: id -> href / media-type
  const manifest = new Map<string, { href: string; type: string }>();
  const itemRe = /<item\s+[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*media-type="([^"]+)"/g;
  for (const m of opfXml.matchAll(itemRe)) {
    manifest.set(m[1], { href: m[2], type: m[3] });
  }
  // Fallback ordering: attributes may appear in any order.
  if (manifest.size === 0) {
    const alt = /<item\s+([^>]+)\/?>/g;
    for (const m of opfXml.matchAll(alt)) {
      const attrs = m[1];
      const id = /id="([^"]+)"/.exec(attrs)?.[1];
      const href = /href="([^"]+)"/.exec(attrs)?.[1];
      const type = /media-type="([^"]+)"/.exec(attrs)?.[1] ?? "";
      if (id && href) manifest.set(id, { href, type });
    }
  }

  // Spine order
  const spineIds: string[] = [];
  const spineRe = /<itemref\s+[^>]*idref="([^"]+)"/g;
  for (const m of opfXml.matchAll(spineRe)) spineIds.push(m[1]);

  const resolve = (p: string) => (baseDir + p).replace(/\/\.?\//g, "/");

  // Pre-encode images as data URIs.
  const imageCache = new Map<string, string>();
  const encodeImage = async (path: string): Promise<string | null> => {
    if (imageCache.has(path)) return imageCache.get(path)!;
    const entry = zip.file(path);
    if (!entry) return null;
    const b64 = await entry.async("base64");
    const ext = path.toLowerCase().split(".").pop() || "png";
    const mime =
      ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "svg"
          ? "image/svg+xml"
          : ext === "gif"
            ? "image/gif"
            : ext === "webp"
              ? "image/webp"
              : "image/png";
    const url = `data:${mime};base64,${b64}`;
    imageCache.set(path, url);
    return url;
  };

  const chapters: ImportedChapter[] = [];
  for (const id of spineIds) {
    const it = manifest.get(id);
    if (!it) continue;
    if (!/xhtml|html/i.test(it.type)) continue;
    const path = resolve(it.href);
    const raw = await zip.file(path)?.async("string");
    if (!raw) continue;

    // Extract body content (fallback to whole doc if no <body>).
    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(raw);
    let body = bodyMatch ? bodyMatch[1] : raw;

    // Rewrite image srcs to data URIs.
    const chapterDir = path.replace(/[^/]+$/, "");
    const imgTags = [...body.matchAll(/<img\s+[^>]*src="([^"]+)"[^>]*>/gi)];
    for (const tag of imgTags) {
      const src = tag[1];
      if (/^(data:|https?:)/i.test(src)) continue;
      const resolved = (chapterDir + src).replace(/\/\.?\//g, "/").replace(/[^/]+\/\.\.\//g, "");
      const dataUrl = await encodeImage(resolved);
      if (dataUrl) body = body.replace(tag[0], tag[0].replace(src, dataUrl));
    }

    // Try to pick a nice title from the first h1/h2 or the file name.
    const titleMatch = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(body);
    const stripped = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
      : path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? `Chapter ${chapters.length + 1}`;

    chapters.push({ title: stripped || `Chapter ${chapters.length + 1}`, html: body.trim() });
  }

  return chapters.length ? chapters : [{ title: "Chapter 1", html: "<p>(empty EPUB)</p>" }];
}

export async function importBookFile(file: File): Promise<ImportedChapter[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return importPdfToChapters(file);
  }
  if (name.endsWith(".epub") || file.type === "application/epub+zip") {
    return importEpubToChapters(file);
  }
  if (name.endsWith(".mobi") || name.endsWith(".azw") || name.endsWith(".azw3") || name.endsWith(".kfx")) {
    throw new Error(
      "Kindle formats (.mobi/.azw/.azw3) aren't supported in-browser. Please convert to EPUB or PDF first (Calibre works well).",
    );
  }
  throw new Error("Unsupported file type. Please pick a PDF or EPUB.");
}
