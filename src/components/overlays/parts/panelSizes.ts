/**
 * Panel sizes shared by the overlays (Tailwind class lists for the Modal).
 *
 * Overlays are drawn inside the game stage, which is the canvas scaled by a
 * whole number: only 800 × 450 px at scale 2 (a small laptop window), but
 * 1200 × 675 or more on bigger screens. So every panel FILLS the stage up
 * to a comfortable maximum, and its layout is designed to fit the smallest
 * stage, with long content scrolling inside the panel instead of spilling out.
 */

/** Codex, bag, notice board, Wishing Well. */
export const PANEL_LARGE = "flex h-full max-h-[600px] w-full max-w-[960px] flex-col gap-3 p-4";

/** Chest, victory. */
export const PANEL_MEDIUM = "flex h-full max-h-[560px] w-full max-w-[880px] flex-col gap-3 p-4";
