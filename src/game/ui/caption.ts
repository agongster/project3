/**
 * A one-line caption across the lower middle of the screen ("orders.py was
 * rewritten: the dungeon re-forms"), drawn by the engine in the bitmap font
 * on a dark ribbon. It fades in, stays, and fades out; showing a new one
 * replaces the old. Used when the code changes under the hero's feet, so the
 * player always reads why the world just moved.
 */
import { drawText, measureText } from "@/game/art/font";
import { fitLabel } from "./treemap";

/** Seconds a caption stays on screen, fades included. */
export const CAPTION_SEC = 2.8;
const FADE_SEC = 0.25;
/** The ribbon's top edge, this far above the bottom of the screen (px). */
const BOTTOM_GAP_PX = 46;
/** Room around the text inside the ribbon (px). */
const PAD_X = 6;
const PAD_Y = 3;
/** The text never gets wider than the screen minus this margin on each side. */
const SIDE_MARGIN_PX = 16;
const TEXT_HEIGHT_PX = 9;
const RIBBON_COLOR = "rgba(15, 11, 31, 0.78)";
const TEXT_COLOR = "#bffcff";

export class Caption {
  private text = "";
  private age = CAPTION_SEC;

  show(text: string): void {
    this.text = text;
    this.age = 0;
  }

  update(dt: number): void {
    this.age = Math.min(CAPTION_SEC, this.age + dt);
  }

  /** Draws the caption in screen space (call after the world is drawn). */
  draw(g: CanvasRenderingContext2D, viewW: number, viewH: number): void {
    if (this.age >= CAPTION_SEC || this.text === "") return;
    const fadeIn = Math.min(1, this.age / FADE_SEC);
    const fadeOut = Math.min(1, (CAPTION_SEC - this.age) / FADE_SEC);
    const alpha = Math.min(fadeIn, fadeOut);
    const text = fitLabel(this.text, viewW - 2 * SIDE_MARGIN_PX);
    const width = measureText(text);
    const x = Math.round(viewW / 2);
    const y = viewH - BOTTOM_GAP_PX;
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = RIBBON_COLOR;
    g.fillRect(Math.round(x - width / 2 - PAD_X), y - PAD_Y, Math.round(width + 2 * PAD_X), TEXT_HEIGHT_PX + 2 * PAD_Y);
    g.restore();
    drawText(g, text, x, y, { color: TEXT_COLOR, align: "center", alpha });
  }
}
