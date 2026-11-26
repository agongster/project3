/**
 * The HUD is measured in *art pixels*, the same pixels the game is drawn in,
 * so it grows and shrinks with the game. The game screen sets the CSS
 * variable `--s` to the current zoom (2 = every art pixel is 2×2 screen px).
 *
 *   style={{ padding: ap(4) }}   // 4 art pixels of padding at any zoom
 */
import type { CSSProperties } from "react";

/** `n` art pixels as a CSS length. */
export function ap(n: number): string {
  return `calc(var(--s) * ${n}px)`;
}

// ── HUD type scale (the page-wide scale is in src/app/globals.css) ──
// The game's zoom is 2 on small windows, 3 at 1280×800 and 4 on big screens.

/** Body text: 14 px at 2×, 18 px at 3×, 22 px at 4×. */
export const HUD_FONT_SIZE = "calc(var(--s) * 4px + 6px)";

/** Small labels (bar captions, key hints, a toast's second line): 13 px at 2×, 16 px at 3×, 19 px at 4×. */
export const HUD_SMALL_FONT_SIZE = "calc(var(--s) * 3px + 7px)";

/**
 * The pixel display font (`font-title`) in the HUD: 8 art pixels, which is 16, 24 or
 * 32 px — always a whole multiple of the font's 8 px grid, so its pixels stay crisp.
 */
export const HUD_TITLE_FONT_SIZE = ap(8);

/**
 * Dark rounded-off plate behind HUD text, so it reads over snow as well as night scenes.
 * Nearly opaque: canvas words passing underneath (room names, floor code) must not
 * show through the HUD's own numbers.
 */
export const PLATE_STYLE: CSSProperties = {
  background: "rgb(27 22 48 / 0.9)",
  boxShadow: "0 calc(var(--s) * -1px) 0 0 #0f0b1f, 0 calc(var(--s) * 1px) 0 0 #0f0b1f, calc(var(--s) * -1px) 0 0 0 #0f0b1f, calc(var(--s) * 1px) 0 0 0 #0f0b1f",
  padding: `${ap(2)} ${ap(3)}`,
};

/** A thin dark outline for small text drawn straight over the game. */
export const TEXT_OUTLINE = "1px 1px 0 #0f0b1f, -1px 1px 0 #0f0b1f, 1px -1px 0 #0f0b1f, -1px -1px 0 #0f0b1f, 0 2px 0 #0f0b1f";

/** A chunky one-art-pixel outline plus drop shadow, for big title-font text (banners, combo, boss name). */
export const BOLD_OUTLINE = [
  `${ap(1)} 0 0 #0f0b1f`,
  `${ap(-1)} 0 0 #0f0b1f`,
  `0 ${ap(1)} 0 #0f0b1f`,
  `0 ${ap(-1)} 0 #0f0b1f`,
  `${ap(1)} ${ap(1)} 0 #0f0b1f`,
  `${ap(-1)} ${ap(1)} 0 #0f0b1f`,
  `${ap(1)} ${ap(-1)} 0 #0f0b1f`,
  `${ap(-1)} ${ap(-1)} 0 #0f0b1f`,
  `0 ${ap(2)} 0 rgb(0 0 0 / 0.4)`,
].join(", ");
