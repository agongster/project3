/**
 * Telegraph drawing: the warnings painted on the floor before an attack
 * lands. The rule of the dungeon is "nothing hurts without a clear warning":
 *
 *   ring   – "this circle is about to be hit" (tank flail, serpent tail sweep,
 *            landing spots of spit globs and glitch blocks)
 *   lane   – "something is about to dash along this line" (gremlin lunge,
 *            Key Thief dash)
 *
 * Everything is drawn with whole-pixel rectangles so it stays crisp at any
 * zoom, and blinks faster as the attack gets closer (`urgency` 0 → 1).
 */

export const WARN_COLOR = "#ff4d6d";
const WARN_FLASH_COLOR = "#ffffff";
/** Blinks per second at urgency 0 and 1. */
const BLINK_SLOW = 3;
const BLINK_FAST = 12;
/** Opacity of the filled area under a ring / lane. */
const FILL_ALPHA = 0.22;
/** Spacing of the dots along a lane's edges. */
const LANE_DOT_GAP = 4;

/** Blinking colour: mostly red, flashing white more often as `urgency` approaches 1. */
function blinkColor(urgency: number, time: number): string {
  const rate = BLINK_SLOW + (BLINK_FAST - BLINK_SLOW) * urgency;
  return Math.floor(time * rate) % 2 === 0 ? WARN_COLOR : WARN_FLASH_COLOR;
}

/** A filled disc built from 1-px rows (crisp pixel edges). */
function fillDisc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const R = Math.round(r);
  for (let dy = -R; dy <= R; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, R * R - dy * dy)));
    g.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
  }
}

/** A 1-px circle outline. */
function strokeCircle(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const steps = Math.max(12, Math.ceil(r * 6));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
}

/**
 * A warning circle on the floor. `urgency` (0 → 1) makes it blink faster;
 * `fill` grows from the centre so you can see the attack "charging".
 */
export function drawWarningRing(g: CanvasRenderingContext2D, cx: number, cy: number, radius: number, urgency: number, time: number): void {
  g.save();
  g.fillStyle = WARN_COLOR;
  g.globalAlpha = FILL_ALPHA;
  fillDisc(g, cx, cy, radius * Math.min(1, 0.25 + urgency));
  g.globalAlpha = 0.9;
  g.fillStyle = blinkColor(urgency, time);
  strokeCircle(g, cx, cy, radius);
  g.restore();
}

/** A warning lane from (x0, y0) to (x1, y1), `width` px wide: dotted edges and a faint fill. */
export function drawWarningLane(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, width: number, urgency: number, time: number): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1) return;
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  const half = width / 2;
  g.save();
  g.globalAlpha = FILL_ALPHA;
  g.fillStyle = WARN_COLOR;
  // (-uy, ux) points sideways, across the lane.
  g.beginPath();
  g.moveTo(x0 - uy * half, y0 + ux * half);
  g.lineTo(x1 - uy * half, y1 + ux * half);
  g.lineTo(x1 + uy * half, y1 - ux * half);
  g.lineTo(x0 + uy * half, y0 - ux * half);
  g.closePath();
  g.fill();
  g.globalAlpha = 0.9;
  g.fillStyle = blinkColor(urgency, time);
  // Dots march toward the far end, so the lane reads as a direction.
  const offset = (time * 20) % LANE_DOT_GAP;
  for (let d = offset; d <= len; d += LANE_DOT_GAP) {
    for (const side of [-half, half]) g.fillRect(Math.round(x0 + ux * d - uy * side), Math.round(y0 + uy * d + ux * side), 1, 1);
  }
  // An arrow-head of dots at the far end.
  for (let s = -half; s <= half; s += 2) {
    const back = Math.abs(s) * 0.8;
    g.fillRect(Math.round(x1 - ux * back - uy * s), Math.round(y1 - uy * back + ux * s), 1, 1);
  }
  g.restore();
}
