import JSZip from "jszip";

export type EpubChapter = { title: string; html: string };
export type EpubInput = {
  title: string;
  author: string;
  description?: string | null;
  coverUrl?: string | null;
  chapters: EpubChapter[];
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Very light HTML → XHTML cleanup: void tags self-close, strip disallowed attrs.
function toXhtml(html: string): string {
  let out = (html ?? "").trim();
  out = out.replace(/<(br|hr|img|meta|link|input)([^>]*?)>/gi, (_m, tag, attrs) => {
    const clean = String(attrs ?? "").replace(/\s*\/\s*$/, "");
    return `<${tag}${clean} />`;
  });
  // Ensure at least one wrapping element
  if (!/^<(p|div|h[1-6]|section|article|ul|ol|blockquote)/i.test(out)) {
    out = `<p>${out || "&nbsp;"}</p>`;
  }
  return out;
}

async function fetchCoverBytes(url: string): Promise<{ bytes: Uint8Array; mime: string; ext: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const ct = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const mime = ct.includes("png") ? "image/png" : ct.includes("webp") ? "image/webp" : "image/jpeg";
    return { bytes: buf, mime, ext };
  } catch { return null; }
}

export async function buildEpubBlob(input: EpubInput): Promise<Blob> {
  const zip = new JSZip();
  const uid = `urn:uuid:${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  const title = input.title || "Untitled";
  const author = input.author || "Unknown";
  const chapters = input.chapters.length ? input.chapters : [{ title: "Chapter 1", html: "<p>(empty)</p>" }];

  // mimetype must be first, stored (no compression)
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  let coverManifest = "";
  let coverMeta = "";
  let coverSpine = "";
  let coverHref: string | null = null;
  if (input.coverUrl) {
    const cover = await fetchCoverBytes(input.coverUrl);
    if (cover) {
      coverHref = `cover.${cover.ext}`;
      zip.file(`OEBPS/${coverHref}`, cover.bytes);
      coverManifest = `<item id="cover-image" href="${coverHref}" media-type="${cover.mime}" properties="cover-image"/>
    <item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>`;
      coverMeta = `<meta name="cover" content="cover-image"/>`;
      coverSpine = `<itemref idref="cover-page"/>`;
      zip.file(
        "OEBPS/cover.xhtml",
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Cover</title><style>body{margin:0;padding:0;text-align:center}img{max-width:100%;height:auto}</style></head>
<body><img src="${coverHref}" alt="${esc(title)}"/></body>
</html>`,
      );
    }
  }

  // Chapter XHTML files
  const chapterFiles: { id: string; href: string; title: string }[] = [];
  chapters.forEach((c, i) => {
    const id = `ch${i + 1}`;
    const href = `${id}.xhtml`;
    chapterFiles.push({ id, href, title: c.title || `Chapter ${i + 1}` });
    zip.file(
      `OEBPS/${href}`,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${esc(c.title || `Chapter ${i + 1}`)}</title></head>
<body>
<h1>${esc(c.title || `Chapter ${i + 1}`)}</h1>
${toXhtml(c.html)}
</body>
</html>`,
    );
  });

  // Nav (EPUB 3)
  const navList = chapterFiles
    .map((c) => `      <li><a href="${c.href}">${esc(c.title)}</a></li>`)
    .join("\n");
  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${esc(title)}</title></head>
<body>
  <nav epub:type="toc" id="toc"><h1>Contents</h1><ol>
${navList}
  </ol></nav>
</body>
</html>`,
  );

  const manifestItems = chapterFiles
    .map((c) => `    <item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`)
    .join("\n");
  const spineItems = chapterFiles.map((c) => `<itemref idref="${c.id}"/>`).join("");

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${uid}</dc:identifier>
    <dc:title>${esc(title)}</dc:title>
    <dc:creator>${esc(author)}</dc:creator>
    <dc:language>en</dc:language>
    ${input.description ? `<dc:description>${esc(input.description)}</dc:description>` : ""}
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta>
    ${coverMeta}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${coverManifest}
${manifestItems}
  </manifest>
  <spine>
    ${coverSpine}
    <itemref idref="nav"/>
    ${spineItems}
  </spine>
</package>`,
  );

  return zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
