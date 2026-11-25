/**
 * Converting between the four sprite facings and direction vectors/angles.
 */
import type { Facing } from "@/game/art";

/** Unit vector for a facing direction. */
export function facingVector(f: Facing): { x: number; y: number } {
  if (f === "up") return { x: 0, y: -1 };
  if (f === "down") return { x: 0, y: 1 };
  if (f === "left") return { x: -1, y: 0 };
  return { x: 1, y: 0 };
}

/** Angle in radians (0 = right, π/2 = down, because screen y grows downward). */
export function facingAngle(f: Facing): number {
  const v = facingVector(f);
  return Math.atan2(v.y, v.x);
}

/** The facing that best matches a direction (the larger axis wins). */
export function facingFromVector(x: number, y: number, fallback: Facing): Facing {
  if (x === 0 && y === 0) return fallback;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? "right" : "left";
  return y > 0 ? "down" : "up";
}
