/**
 * Small colour helpers for the report card: given the school's own brand
 * colours, pick text that is always readable on top of them.
 */

type RGB = [number, number, number];

const DARK_TEXT = "#101828";
const FALLBACK = "#1f3864";

export function parseHex(input: string | undefined | null): RGB | null {
  if (!input) return null;
  let h = input.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function toHex([r, g, b]: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** A valid #rrggbb, whatever was typed (falls back to a safe navy). */
export function safeHex(input: string | undefined | null, fallback: string = FALLBACK): string {
  const rgb = parseHex(input) ?? parseHex(fallback) ?? [31, 56, 100];
  return toHex(rgb);
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(rgb: RGB): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** t = 0 -> a, t = 1 -> b. */
export function mixHex(a: string, b: string, t: number): string {
  const x = parseHex(a) ?? [0, 0, 0];
  const y = parseHex(b) ?? [0, 0, 0];
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** amount < 0 darkens, amount > 0 lightens. */
export function shade(hex: string, amount: number): string {
  return amount < 0 ? mixHex(hex, "#000000", -amount) : mixHex(hex, "#ffffff", amount);
}

export interface ReadableOn {
  /** main text colour */
  text: string;
  /** slightly softer text for small labels */
  muted: string;
  /** faint line colour (ring track, dividers) */
  faint: string;
  isLightText: boolean;
}

/**
 * White or near-black text, whichever is more readable on BOTH ends of a
 * gradient (pass the same colour twice for a flat fill).
 */
export function readableOn(bgA: string, bgB: string = bgA): ReadableOn {
  const a = parseHex(bgA) ?? [31, 56, 100];
  const b = parseHex(bgB) ?? a;
  const white: RGB = [255, 255, 255];
  const dark = parseHex(DARK_TEXT) as RGB;
  const whiteScore = Math.min(contrastRatio(a, white), contrastRatio(b, white));
  const darkScore = Math.min(contrastRatio(a, dark), contrastRatio(b, dark));
  if (whiteScore >= darkScore) {
    return { text: "#ffffff", muted: "rgba(255,255,255,0.92)", faint: "rgba(255,255,255,0.32)", isLightText: true };
  }
  return { text: DARK_TEXT, muted: "rgba(16,24,40,0.88)", faint: "rgba(16,24,40,0.22)", isLightText: false };
}

export interface StatTile {
  from: string;
  to: string;
  text: string;
  muted: string;
  faint: string;
}

/** One tile's gradient + readable text colours, from a base brand colour. */
export function tileFor(base: string): StatTile {
  const from = shade(base, 0.06);
  const to = shade(base, -0.2);
  const r = readableOn(from, to);
  return { from, to, text: r.text, muted: r.muted, faint: r.faint };
}
