/**
 * Turns a photo / scan of a signature into a neat report-card signature:
 * the paper background becomes transparent, the ink is darkened, the
 * picture is trimmed to the ink, and it is scaled to a small rectangle
 * (at most 360 x 120 pixels). Returns a PNG data URL.
 */
const MAX_W = 360;
const MAX_H = 120;
const WORK = 1000;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file doesn't look like a valid image."));
      img.onload = () => resolve(img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export async function formatSignatureImage(file: File): Promise<string> {
  const img = await loadImage(file);
  const scale = Math.min(1, WORK / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const work = document.createElement("canvas");
  work.width = w;
  work.height = h;
  const ctx = work.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas not supported.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      // Paper (light) -> transparent, ink (dark) -> solid, soft edge between.
      let alpha = 0;
      if (lum <= 130) alpha = 255;
      else if (lum < 225) alpha = Math.round(((225 - lum) / 95) * 255);
      px[i] = Math.round(px[i] * 0.45);
      px[i + 1] = Math.round(px[i + 1] * 0.45);
      px[i + 2] = Math.round(px[i + 2] * 0.55);
      px[i + 3] = alpha;
      if (alpha > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    throw new Error("No signature could be found in that picture. Use dark ink on plain white paper.");
  }
  ctx.putImageData(data, 0, 0);

  const pad = 6;
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(w - sx, maxX - minX + 1 + pad * 2);
  const sh = Math.min(h - sy, maxY - minY + 1 + pad * 2);

  const fit = Math.min(MAX_W / sw, MAX_H / sh, 1);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(sw * fit));
  out.height = Math.max(1, Math.round(sh * fit));
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Canvas not supported.");
  octx.imageSmoothingQuality = "high";
  octx.drawImage(work, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}
