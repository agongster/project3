/**
 * Scene transitions: an IRIS wipe (a shrinking circle around the hero, the
 * classic way into a door) or a plain FADE (used when the hero faints).
 *
 *   closing ──► (screen fully covered: `onCovered` swaps the scene) ──► hold ──► opening
 *
 * While a transition runs the game freezes the scene, so nothing happens
 * behind the curtain.
 */

const CLOSE_SEC = 0.42;
const HOLD_SEC = 0.12;
const OPEN_SEC = 0.42;
const CURTAIN = "#130e1f";

type Phase = "idle" | "closing" | "hold" | "opening";
export type TransitionStyle = "iris" | "fade";

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class Transition {
  private phase: Phase = "idle";
  private t = 0;
  private style: TransitionStyle = "iris";
  private onCovered: (() => void) | null = null;
  private closeSec = CLOSE_SEC;
  /** Screen position the iris closes on / opens from. */
  private cx = 0;
  private cy = 0;

  get active(): boolean {
    return this.phase !== "idle";
  }

  /** True while the curtain is closing or fully closed (the scene should hold still). */
  get covering(): boolean {
    return this.phase === "closing" || this.phase === "hold";
  }

  /** Starts covering the screen; `onCovered` runs once it is fully covered. */
  start(style: TransitionStyle, cx: number, cy: number, onCovered: () => void, closeSec = CLOSE_SEC): void {
    this.style = style;
    this.phase = "closing";
    this.t = 0;
    this.cx = cx;
    this.cy = cy;
    this.closeSec = closeSec;
    this.onCovered = onCovered;
  }

  /** Where the iris should open from (the hero's new screen position). */
  setCenter(cx: number, cy: number): void {
    this.cx = cx;
    this.cy = cy;
  }

  update(dt: number): void {
    if (this.phase === "idle") return;
    this.t += dt;
    if (this.phase === "closing" && this.t >= this.closeSec) {
      this.phase = "hold";
      this.t = 0;
      const callback = this.onCovered;
      this.onCovered = null;
      callback?.();
    } else if (this.phase === "hold" && this.t >= HOLD_SEC) {
      this.phase = "opening";
      this.t = 0;
    } else if (this.phase === "opening" && this.t >= OPEN_SEC) {
      this.phase = "idle";
    }
  }

  /** 0 = screen fully visible, 1 = fully covered. */
  private coverage(): number {
    if (this.phase === "closing") return easeInOut(Math.min(1, this.t / this.closeSec));
    if (this.phase === "hold") return 1;
    if (this.phase === "opening") return 1 - easeInOut(Math.min(1, this.t / OPEN_SEC));
    return 0;
  }

  /** Draws the curtain in screen space. */
  draw(g: CanvasRenderingContext2D, w: number, h: number): void {
    const k = this.coverage();
    if (k <= 0) return;
    g.fillStyle = CURTAIN;
    if (this.style === "fade") {
      g.globalAlpha = k;
      g.fillRect(0, 0, w, h);
      g.globalAlpha = 1;
      return;
    }
    // Iris: fill each pixel row except the part inside the circle (crisp edges, no blur).
    const maxR = Math.hypot(Math.max(this.cx, w - this.cx), Math.max(this.cy, h - this.cy));
    const r = maxR * (1 - k);
    for (let y = 0; y < h; y++) {
      const dy = y + 0.5 - this.cy;
      if (Math.abs(dy) >= r) {
        g.fillRect(0, y, w, 1);
        continue;
      }
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      const left = Math.round(this.cx) - half;
      const right = Math.round(this.cx) + half;
      if (left > 0) g.fillRect(0, y, left, 1);
      if (right < w) g.fillRect(right, y, w - right, 1);
    }
  }
}
