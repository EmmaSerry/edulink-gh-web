import { db } from "@database/db";
import type { StudentPhoto } from "@models/StudentPhoto";

const MAX_DIMENSION_PX = 480;
const JPEG_QUALITY = 0.82;
// Phase 6 (Module 9 - security & data integrity review): `upload()`
// previously accepted any `File` with no validation at all - the <input
// accept="image/*"> on the calling page is only a picker *hint*, not an
// enforced restriction, so a user could still select a non-image or a
// pathologically large file (a multi-hundred-MB video, for instance),
// which would hang the tab while the canvas resize step tried to process
// it. Both are now rejected up front with a clear, user-facing message.
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB - generous for a phone photo

export class PhotoValidationError extends Error {}

interface ResizedImage {
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  sizeBytes: number;
}

/**
 * Student photo management (Module 9): upload/replace/remove/preview,
 * with automatic client-side resize + JPEG compression before anything
 * is written to IndexedDB, so a phone-camera photo (often several MB)
 * doesn't bloat the local database.
 */
class PhotoServiceImpl {
  private async resize(file: File): Promise<ResizedImage> {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = objectUrl;
      });

      const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const sizeBytes = Math.round((dataUrl.length * 3) / 4);

      return { dataUrl, widthPx: width, heightPx: height, sizeBytes };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async upload(studentId: number, file: File): Promise<string> {
    if (!file.type.startsWith("image/")) {
      throw new PhotoValidationError("That file isn't an image. Please choose a JPG, PNG or similar photo file.");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new PhotoValidationError("That photo is too large (max 15MB). Please choose a smaller file.");
    }
    const resized = await this.resize(file);
    const now = new Date().toISOString();

    await db.transaction("rw", db.studentPhotos, db.students, async () => {
      await db.studentPhotos.add({
        studentId,
        dataUrl: resized.dataUrl,
        widthPx: resized.widthPx,
        heightPx: resized.heightPx,
        sizeBytes: resized.sizeBytes,
        uploadedAt: now,
      } as StudentPhoto);
      await db.students.update(studentId, { photoDataUrl: resized.dataUrl, updatedAt: now });
    });

    return resized.dataUrl;
  }

  async remove(studentId: number): Promise<void> {
    const now = new Date().toISOString();
    await db.students.update(studentId, { photoDataUrl: undefined, updatedAt: now });
  }

  async getHistory(studentId: number): Promise<StudentPhoto[]> {
    const all = await db.studentPhotos.where("studentId").equals(studentId).toArray();
    return all.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }
}

export const PhotoService = new PhotoServiceImpl();
