// Compose a downloadable ticket image: the original photo with a QR stamp,
// holder name and a footer bar, like a real printed ticket.
import QRCode from "qrcode";
import brandLogoUrl from "@/assets/brand-logo.png";

export function ticketFilename(title: string, buyerIndex?: number | null): string {
  const slug = (title || "ticket")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "ticket";
  const suffix = buyerIndex && buyerIndex > 0 ? `-buyer-${buyerIndex}` : "";
  return `${slug}${suffix}.pdf`;
}

let _brandLogoPromise: Promise<HTMLImageElement> | null = null;
function getBrandLogo(): Promise<HTMLImageElement> {
  if (!_brandLogoPromise) _brandLogoPromise = loadImage(brandLogoUrl);
  return _brandLogoPromise;
}

/**
 * Renders a QR code with a bold, transparent brand-logo watermark tiled across
 * the whole code. High error-correction keeps it scannable even with the
 * watermark on top. No badge is drawn in the middle anymore — the verified
 * check now lives beside the buyer number.
 */
export async function composeVerifiedQr(qrToken: string, size = 320): Promise<string> {
  const dataUrl = await QRCode.toDataURL(`SP-TICKET:${qrToken}`, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });
  const qrImg = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(qrImg, 0, 0, size, size);
  try {
    const logo = await getBrandLogo();
    stampLogoPattern(ctx, logo, size, size, { tile: size / 3.2, alpha: 0.14, rotate: -22 });
  } catch { /* ignore — QR still valid */ }
  return canvas.toDataURL("image/png");
}

/** Facebook-blue verified check — drawn as vector paths so it stays crisp. */
function drawFacebookVerified(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(r / 12, r / 12); // path designed on a 24-unit canvas centred at 0
  // Star-burst badge outline (12-point rounded star)
  const points = 12;
  const outer = 12;
  const inner = 10.4;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / points - Math.PI / 2;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "#1D9BF0"; // Facebook / X verified blue
  ctx.fill();
  // White check
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-4.6, 0.4);
  ctx.lineTo(-1.2, 3.8);
  ctx.lineTo(5.2, -3.4);
  ctx.stroke();
  ctx.restore();
}

/** Tile the brand mark across an area at low opacity — the "you can't recreate this" watermark. */
function stampLogoPattern(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  w: number,
  h: number,
  opts: { tile: number; alpha: number; rotate: number },
) {
  const { tile, alpha, rotate } = opts;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(w / 2, h / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  const diag = Math.ceil(Math.hypot(w, h)) + tile;
  const step = tile * 1.15;
  for (let y = -diag; y < diag; y += step) {
    for (let x = -diag; x < diag; x += step) {
      ctx.drawImage(logo, x, y, tile, tile);
    }
  }
  ctx.restore();
}

export async function composeTicketImage(opts: {
  photoUrl: string;
  qrToken: string;
  title: string;
  holder: string;
  buyerIndex?: number | null;
}): Promise<string> {
  const { photoUrl, qrToken, title, holder, buyerIndex } = opts;
  const img = await loadImage(photoUrl);
  const brand = await getBrandLogo().catch(() => null);

  const W = 1200;
  const scale = W / img.width;
  const H = Math.round(img.height * scale);
  const footer = 260;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H + footer;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, W, H);

  // Bold logo watermark tiled across the WHOLE ticket (photo + footer).
  if (brand) {
    stampLogoPattern(ctx, brand, W, H + footer, { tile: 190, alpha: 0.09, rotate: -22 });
  }

  const qrSize = 260;
  const pad = 20;
  const qrCard = qrSize + pad * 2;
  const cardX = W - qrCard - 24;
  const cardY = H - qrCard - 24;
  roundRect(ctx, cardX, cardY, qrCard, qrCard, 18);
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fill();

  const verifiedQr = await composeVerifiedQr(qrToken, qrSize);
  const qrImg = await loadImage(verifiedQr);
  ctx.drawImage(qrImg, cardX + pad, cardY + pad, qrSize, qrSize);

  const grad = ctx.createLinearGradient(0, H, W, H + footer);
  grad.addColorStop(0, "#6d28d9");
  grad.addColorStop(1, "#db2777");
  ctx.fillStyle = grad;
  ctx.fillRect(0, H, W, footer);

  // Re-stamp watermark on the footer so it shows over the gradient too.
  if (brand) {
    stampLogoPattern(ctx, brand, W, footer, { tile: 170, alpha: 0.11, rotate: -22 });
    // (the second call above was drawn at 0,0 of the whole canvas — reset origin properly)
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 56px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(truncate(title, 28), 40, H + 36);

  // Buyer line with the verified badge sitting right next to the buyer number.
  ctx.font = "30px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  const buyerLabel = buyerIndex && buyerIndex > 0
    ? `Buyer #${buyerIndex}`
    : "Holder";
  const y = H + 112;
  ctx.fillText(buyerLabel, 40, y);
  const labelWidth = ctx.measureText(buyerLabel).width;
  drawFacebookVerified(ctx, 40 + labelWidth + 30, y + 18, 22);
  ctx.fillText(`· ${truncate(holder, 28)}`, 40 + labelWidth + 62, y);

  ctx.font = "24px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("Scan with StudentsPlug · Ticket QR Scanner", 40, H + 168);

  const tickY = H + footer - 24;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let x = 40, i = 0; x < W - 40; x += 8, i++) {
    const h = (i % 3 === 0) ? 18 : (i % 2 === 0) ? 10 : 14;
    ctx.fillRect(x, tickY - h, 3, h);
  }

  return canvas.toDataURL("image/png");
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  // Data URLs (and our composed canvases) load directly — no CORS dance needed.
  if (src.startsWith("data:") || src.startsWith("blob:")) {
    return await rawLoad(src);
  }
  // Fetch as blob → data URL so the canvas is never tainted by a missing CORS
  // header. Storage CDNs occasionally drop the header on mobile networks,
  // which used to crash `toDataURL()` and surface as "PDF download failed".
  try {
    const res = await fetch(src, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    return await rawLoad(dataUrl);
  } catch {
    // Last-ditch: try anonymous crossOrigin load directly.
    return await new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("Could not load ticket image"));
      im.src = src;
    });
  }
}

function rawLoad(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("Image decode failed"));
    im.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

export async function createTicketPdfBlob(dataUrl: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const img = await loadImage(dataUrl);
  const ratio = img.height / img.width;
  const pageW = 595; // pt (A4 width)
  const margin = 24;
  const imgW = pageW - margin * 2;
  const imgH = imgW * ratio;
  const pageH = imgH + margin * 2;
  const pdf = new jsPDF({ unit: "pt", format: [pageW, pageH], orientation: "portrait" });

  // Extra brand-watermark layer painted onto a full-page canvas, so the PDF
  // page itself carries the anti-forgery pattern even in the margin areas.
  try {
    const brand = await getBrandLogo();
    const wmCanvas = document.createElement("canvas");
    wmCanvas.width = Math.round(pageW * 2);
    wmCanvas.height = Math.round(pageH * 2);
    const wctx = wmCanvas.getContext("2d")!;
    wctx.scale(2, 2);
    stampLogoPattern(wctx, brand, pageW, pageH, { tile: 90, alpha: 0.06, rotate: -22 });
    const wmUrl = wmCanvas.toDataURL("image/png");
    pdf.addImage(wmUrl, "PNG", 0, 0, pageW, pageH, undefined, "FAST");
  } catch { /* watermark is decorative — never block the download */ }

  pdf.addImage(dataUrl, "PNG", margin, margin, imgW, imgH, undefined, "FAST");
  return pdf.output("blob");
}

export async function downloadTicketPdf(dataUrl: string, filename: string, _openedWindow?: Window | null) {
  const blob = await createTicketPdfBlob(dataUrl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
