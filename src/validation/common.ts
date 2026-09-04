import { z } from "zod";

/**
 * Reusable Zod building blocks shared by every entity schema, so
 * validation rules (and their messages) are defined once.
 */
export const requiredString = (label: string) =>
  z.string().trim().min(1, `${label} is required`);

export const optionalString = z.string().trim().optional().or(z.literal(""));

export const phoneNumber = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{7,20}$/, "Enter a valid phone number")
  .optional()
  .or(z.literal(""));

export const emailAddress = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .optional()
  .or(z.literal(""));

/**
 * Case-insensitive duplicate check against a list of existing entities,
 * used inside `.refine()` on every entity schema below (Module CRUD pages
 * pass the currently-loaded rows in via `createXSchema(existingRows, ...)`
 * factories, since the whole table is already loaded through
 * useLiveQuery - no extra DB round-trip needed for validation).
 */
export function isDuplicate<T>(
  existing: T[],
  value: string,
  getField: (item: T) => string,
  excludeId?: number,
  getId?: (item: T) => number | undefined,
): boolean {
  const normalised = value.trim().toLowerCase();
  return existing.some((item) => {
    if (excludeId !== undefined && getId && getId(item) === excludeId) return false;
    return getField(item).trim().toLowerCase() === normalised;
  });
}
