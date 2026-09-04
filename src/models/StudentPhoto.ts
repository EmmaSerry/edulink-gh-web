/**
 * History of a student's uploaded photographs (Module 9). The most
 * recent entry's `dataUrl` is also cached on `Student.photoDataUrl` for
 * fast list/profile rendering; this table exists so a replaced photo
 * isn't simply lost and so storage/optimisation metadata has a home.
 */
export interface StudentPhoto {
  id?: number;
  studentId: number;
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  sizeBytes: number;
  uploadedAt: string;
}
