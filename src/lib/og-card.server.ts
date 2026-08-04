// Builds a 1200x630 social-share card (same resolution as the news images)
// out of an arbitrary book cover, using pure-JS decoders/encoders so it runs
// inside the edge runtime (no sharp / canvas available there).
import jpeg from "jpeg-js";
import UPNG from "upng-js";

export type Raster = { data: Uint8Array; width: number; height: number };

const OUT_W = 1200;
const OUT_H = 630;

export function decodeImage(bytes: Uint8Array, contentType: string): Raster | null {
  try {
    const ct = contentType.toLowerCase();
    const isPng = ct.includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50);
    if (isPng) {
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const img = UPNG.decode(buf as ArrayBuffer);
      const rgba = UPNG.toRGBA8(img)[0];
      return { data: new Uint8Array(rgba), width: img.width, height: img.height };
    }
    const isJpeg = ct.includes("jpeg") || ct.includes("jpg") || (bytes[0] === 0xff && bytes[1] === 0xd8);
    if (isJpeg) {
      const out = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true } as any);
      return { data: new Uint8Array(out.data), width: out.width, height: out.height };
    }
  } catch {
    // unsupported / corrupt source
  }
  return null;
}

/** Bilinear sample of `src` at normalised coords, written into dst pixel index. */
function sample(src: Raster, x: number, y: number, out: Uint8Array, di: number, scale: number) {
  const xi = Math.min(src.width - 1, Math.max(0, Math.round(x)));
  const yi = Math.min(src.height - 1, Math.max(0, Math.round(y)));
  const si = (yi * src.width + xi) * 4;
  out[di] = src.data[si] * scale;
  out[di + 1] = src.data[si + 1] * scale;
  out[di + 2] = src.data[si + 2] * scale;
  out[di + 3] = 255;
}

/** Cheap blur: shrink to a tiny buffer, then stretch it back up. */
function tinyBlur(src: Raster, tw = 24, th = 14): Raster {
  const data = new Uint8Array(tw * th * 4);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      // average a block of source pixels
      const x0 = Math.floor((x / tw) * src.width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) / tw) * src.width));
      const y0 = Math.floor((y / th) * src.height);
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) / th) * src.height));
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let sy = y0; sy < y1; sy += 2) {
        for (let sx = x0; sx < x1; sx += 2) {
          const si = (sy * src.width + sx) * 4;
          r += src.data[si];
          g += src.data[si + 1];
          b += src.data[si + 2];
          n++;
        }
      }
      const di = (y * tw + x) * 4;
      data[di] = n ? r / n : 12;
      data[di + 1] = n ? g / n : 19;
      data[di + 2] = n ? b / n : 27;
      data[di + 3] = 255;
    }
  }
  return { data, width: tw, height: th };
}

/**
 * Compose the cover onto a 1200x630 canvas: darkened blurred cover fills the
 * frame, the sharp cover sits centred on top at full height. Returns JPEG bytes.
 */
export function buildOgCard(cover: Raster): Uint8Array {
  const out = new Uint8Array(OUT_W * OUT_H * 4);
  const bg = tinyBlur(cover);

  for (let y = 0; y < OUT_H; y++) {
    for (let x = 0; x < OUT_W; x++) {
      const di = (y * OUT_W + x) * 4;
      sample(bg, (x / OUT_W) * (bg.width - 1), (y / OUT_H) * (bg.height - 1), out, di, 0.42);
    }
  }

  // Sharp cover, letterboxed to the card height with a small margin.
  const margin = 34;
  const maxH = OUT_H - margin * 2;
  const maxW = Math.floor(OUT_W * 0.5);
  const scale = Math.min(maxH / cover.height, maxW / cover.width);
  const dw = Math.max(1, Math.round(cover.width * scale));
  const dh = Math.max(1, Math.round(cover.height * scale));
  const ox = Math.round((OUT_W - dw) / 2);
  const oy = Math.round((OUT_H - dh) / 2);

  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const di = ((oy + y) * OUT_W + (ox + x)) * 4;
      sample(cover, (x / dw) * (cover.width - 1), (y / dh) * (cover.height - 1), out, di, 1);
    }
  }

  const encoded = jpeg.encode({ data: out as any, width: OUT_W, height: OUT_H }, 82);
  return new Uint8Array(encoded.data);
}
