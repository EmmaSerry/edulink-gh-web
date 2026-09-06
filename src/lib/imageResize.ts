/**
 * Small dependency-free helper for the school logo upload (Settings ->
 * School profile). Unlike student/staff photos (PassportPhotoCropper),
 * a logo has no fixed aspect ratio worth forcing on every school's
 * artwork, so this just downscales whatever was picked to fit within a
 * reasonable box and re-encodes it - keeps the stored data URL small
 * without asking the user to crop anything.
 */
const MAX_DIMENSION = 320;

export function resizeImageToDataUrl(file: File, maxDimension = MAX_DIMENSION): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file doesn't look like a valid image."));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported."));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
