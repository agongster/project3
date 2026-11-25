/**
 * The camera: which part of the world is on screen.
 *
 * - It FOLLOWS a target smoothly (exponential easing: each step it closes a
 *   fixed fraction of the remaining gap, so it is fast when far and gentle
 *   when close, and it behaves the same at any frame rate).
 * - It never shows outside the map; a map smaller than the screen is centred.
 * - It SHAKES using "trauma": hits add trauma, trauma decays over time, and
 *   the shake offset grows with trauma² so small hits give a tiny wobble and
 *   big ones a proper rumble.
 */

/** How quickly the camera catches up (higher = snappier). */
const FOLLOW_RATE = 9;
/** Largest shake offset in pixels (at trauma 1). */
const MAX_SHAKE_PX = 5;
/** Trauma lost per second. */
const TRAUMA_DECAY = 2.4;

export class Camera {
  /** Top-left corner of the view in world pixels (not rounded). */
  x = 0;
  y = 0;
  private worldW = 0;
  private worldH = 0;
  private trauma = 0;
  private shakeX = 0;
  private shakeY = 0;

  constructor(
    readonly viewW: number,
    readonly viewH: number,
  ) {}

  setBounds(worldW: number, worldH: number): void {
    this.worldW = worldW;
    this.worldH = worldH;
  }

  /** Jumps straight to a point (scene start, teleports). */
  centerOn(cx: number, cy: number): void {
    this.x = this.clampX(cx - this.viewW / 2);
    this.y = this.clampY(cy - this.viewH / 2);
  }

  /** Eases toward a point. Call once per simulation step. */
  follow(cx: number, cy: number, dt: number): void {
    const k = 1 - Math.exp(-FOLLOW_RATE * dt);
    this.x += (this.clampX(cx - this.viewW / 2) - this.x) * k;
    this.y += (this.clampY(cy - this.viewH / 2) - this.y) * k;
  }

  /** Adds screen shake (0–1; 0.15 is a light tap, 0.5 a big slam). */
  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number, shakeEnabled: boolean): void {
    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY * dt);
    const strength = shakeEnabled ? this.trauma * this.trauma * MAX_SHAKE_PX : 0;
    this.shakeX = (Math.random() * 2 - 1) * strength;
    this.shakeY = (Math.random() * 2 - 1) * strength;
  }

  /** Whole-pixel top-left used for drawing (rounding avoids shimmering sprites). */
  get left(): number {
    return Math.round(this.x + this.shakeX);
  }

  get top(): number {
    return Math.round(this.y + this.shakeY);
  }

  /** Converts a world position to a screen position. */
  toScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: wx - this.left, y: wy - this.top };
  }

  /** True when a world rectangle touches the view (with an optional margin). */
  sees(x: number, y: number, w: number, h: number, margin = 0): boolean {
    return x + w >= this.x - margin && x <= this.x + this.viewW + margin && y + h >= this.y - margin && y <= this.y + this.viewH + margin;
  }

  private clampX(x: number): number {
    if (this.worldW <= this.viewW) return (this.worldW - this.viewW) / 2;
    return Math.max(0, Math.min(this.worldW - this.viewW, x));
  }

  private clampY(y: number): number {
    if (this.worldH <= this.viewH) return (this.worldH - this.viewH) / 2;
    return Math.max(0, Math.min(this.worldH - this.viewH, y));
  }
}
