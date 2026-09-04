/**
 * Converts a rank number to its ordinal text (1 -> "1st", 2 -> "2nd", ...).
 *
 * This replaces the old workbook's static 1-68 VLOOKUP lookup table with
 * a pure function, so it works for a class of any size.
 */
export function toOrdinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
