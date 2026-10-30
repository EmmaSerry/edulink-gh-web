/**
 * Pure helpers for the "Import photos" page: reading the camera number out
 * of a file name, putting photos and learners in order, and pairing them.
 * No React or network code here, so it is easy to test.
 */

export interface PhotoFileInfo {
  /** Original file name, e.g. IMG_0345.jpg */
  name: string;
  /** Last run of digits in the name (0345 -> 345), or null if there is none. */
  number: number | null;
}

/** "IMG_0345.jpg" -> 345. Mirrors how the Photo Editor reads a serial from a file name. */
export function cameraNumber(fileName: string): number | null {
  const base = fileName.replace(/\.[^.\\/]+$/, "");
  const runs = base.match(/\d+/g);
  if (!runs || runs.length === 0) return null;
  return parseInt(runs[runs.length - 1], 10);
}

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

/** True for real photo files; false for photo-list.txt, folders, hidden Mac files, etc. */
export function isPhotoName(path: string): boolean {
  const lower = path.toLowerCase();
  if (lower.includes("__macosx/")) return false;
  const base = lower.split("/").pop() ?? lower;
  if (base.startsWith(".") || base.startsWith("._")) return false;
  return IMAGE_EXT.test(base);
}

/** Photos in shooting order: by camera number, then by name. Photos with no number go last. */
export function sortPhotos<T extends PhotoFileInfo>(photos: T[]): T[] {
  return [...photos].sort((a, b) => {
    if (a.number !== null && b.number !== null && a.number !== b.number) return a.number - b.number;
    if (a.number !== null && b.number === null) return -1;
    if (a.number === null && b.number !== null) return 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
}

export type RosterOrder = "surname" | "firstname" | "studentid";

export interface RosterLearner {
  id: string;
  student_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
}

const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/** Class register order. */
export function sortRoster<T extends RosterLearner>(learners: T[], order: RosterOrder): T[] {
  return [...learners].sort((a, b) => {
    if (order === "studentid") return cmp(a.student_id, b.student_id) || cmp(a.last_name, b.last_name);
    if (order === "firstname") return cmp(a.first_name, b.first_name) || cmp(a.last_name, b.last_name);
    return cmp(a.last_name, b.last_name) || cmp(a.first_name, b.first_name) || cmp(a.student_id, b.student_id);
  });
}

/**
 * Pairs the i-th photo with the i-th learner. `assignments` maps learner id -> photo index
 * (into the `photos` array that was passed in), or null for "no photo".
 * Learners listed in `skipIds` (for example ones that already have a photo) are left out of
 * the count, so the photos line up with the learners that still need one.
 */
export function pairInOrder(
  learnerIds: string[],
  photoCount: number,
  skipIds: Set<string> = new Set()
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  let next = 0;
  for (const id of learnerIds) {
    if (skipIds.has(id)) {
      out[id] = null;
      continue;
    }
    if (next < photoCount) {
      out[id] = next;
      next += 1;
    } else {
      out[id] = null;
    }
  }
  return out;
}

/** Photo indexes used by more than one learner (a mistake the page warns about). */
export function duplicatePhotoIndexes(assignments: Record<string, number | null>): Set<number> {
  const seen = new Set<number>();
  const dup = new Set<number>();
  for (const v of Object.values(assignments)) {
    if (v === null || v === undefined) continue;
    if (seen.has(v)) dup.add(v);
    seen.add(v);
  }
  return dup;
}
