// Browser-only: render PDF pages to PNG data URLs using pdfjs-dist.
// Lazy-loaded so it never touches the SSR bundle.

export type PageImage = { page: number; dataUrl: string };

export async function pdfToImages(
  file: File | Blob,
  opts: { maxPages?: number; scale?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<PageImage[]> {
  const { maxPages = 20, scale = 2, onProgress } = opts;

  const pdfjs: any = await import(
    /* @vite-ignore */ "https://esm.sh/pdfjs-dist@4.7.76/build/pdf.mjs"
  );
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://esm.sh/pdfjs-dist@4.7.76/build/pdf.worker.mjs";

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const total = Math.min(doc.numPages, maxPages);
  const out: PageImage[] = [];

  for (let p = 1; p <= total; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    out.push({ page: p, dataUrl: canvas.toDataURL("image/png") });
    onProgress?.(p, total);
    page.cleanup();
  }
  await doc.destroy();
  return out;
}
