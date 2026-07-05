// Client-side image enhancement — no AI, no server call, no API key needed.
// Applies subtle sharpening + light contrast/saturation/brightness lift via
// a Canvas 2D pipeline. Runs entirely in the browser.

const MAX_DIM = 2400;

function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file).catch(() => loadViaImg(file));
  }
  return loadViaImg(file);
}

function loadViaImg(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

// Unsharp-mask style sharpen using a 3x3 convolution. Modest amount so it
// looks natural rather than crunchy.
function sharpen(ctx: CanvasRenderingContext2D, w: number, h: number, amount = 0.35) {
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  const s = src.data;
  const d = dst.data;
  const a = amount;
  const center = 1 + 4 * a;
  const side = -a;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v =
          s[i + c] * center +
          s[i - 4 + c] * side +
          s[i + 4 + c] * side +
          s[i - w * 4 + c] * side +
          s[i + w * 4 + c] * side;
        d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      d[i + 3] = s[i + 3];
    }
  }
  // Copy border pixels through unchanged.
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = (y * w + x) * 4;
      d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; d[i + 3] = s[i + 3];
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const i = (y * w + x) * 4;
      d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; d[i + 3] = s[i + 3];
    }
  }
  ctx.putImageData(dst, 0, 0);
}

/**
 * Enhance an image File via client-side canvas filters. Returns an enhanced
 * File on success, or the original file on any failure. Never throws.
 */
export async function enhanceImageFile(file: File, _opts?: { timeoutMs?: number }): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (/gif|svg/.test(file.type)) return file;

  try {
    const bmp = await loadBitmap(file);
    const iw = (bmp as any).width as number;
    const ih = (bmp as any).height as number;
    const scale = Math.min(1, MAX_DIM / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // Base tonal lift via built-in CSS filters (fast, GPU-accelerated).
    (ctx as any).filter =
      "contrast(1.08) saturate(1.08) brightness(1.03)";
    ctx.drawImage(bmp as any, 0, 0, w, h);
    (ctx as any).filter = "none";

    // Then a light unsharp-mask for perceived clarity.
    try { sharpen(ctx, w, h, 0.3); } catch { /* ignore convolution failures */ }

    // Prefer JPEG for photos to keep files small; keep PNG when the source
    // was PNG (may contain transparency or crisp text).
    const isPng = /png/i.test(file.type);
    const outType = isPng ? "image/png" : "image/jpeg";
    const quality = isPng ? undefined : 0.92;

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), outType, quality),
    );
    if (!blob) return file;

    const ext = outType === "image/png" ? "png" : "jpg";
    const cleanName = file.name.replace(/\.[^.]+$/, "") + `.${ext}`;
    return new File([blob], cleanName, { type: outType });
  } catch {
    return file;
  }
}
