/**
 * Step 3 of the overworld: decide where each region's rectangle goes.
 *
 * Greedy packing: Town Square is placed first at the origin, then every
 * other block in turn goes to the best free spot. Candidate spots are the
 * positions exactly `gap` tiles beside an already placed block, so the result
 * is a cluster with even gaps for roads and trees between neighbours.
 *
 * "Best" balances two wishes:
 *   - a compact map: the cluster's bounding box should grow as little as
 *     possible;
 *   - the town in the middle: blocks should sit close to the town centre
 *     (weighted double, so Town Square ends up surrounded, not in a corner).
 *
 * Horizontal distances are "squashed" because the camera is wider than it is
 * tall (25 × 14 tiles): a slightly wide village fits the screen better.
 */
import type { Rect } from "@/lib/types";
import type { Rng } from "@/lib/rng";
import { rectsOverlap } from "./grid";

export interface PackRequest {
  id: string;
  w: number;
  h: number;
}

/** Horizontal distances count this much less than vertical ones. */
const WIDE_BIAS = 1.3;

/**
 * Places `center` at (0, 0) and every block of `others` (in the given order)
 * around it. Coordinates may be negative; the caller shifts the result.
 */
export function packAroundCenter(center: PackRequest, others: readonly PackRequest[], gap: number, rng: Rng): Map<string, Rect> {
  const placed = new Map<string, Rect>();
  const centerRect: Rect = { x: 0, y: 0, w: center.w, h: center.h };
  placed.set(center.id, centerRect);
  const cx = centerRect.w / 2;
  const cy = centerRect.h / 2;

  for (const block of others) {
    const rects = [...placed.values()];
    let best: Rect | null = null;
    let bestScore = Infinity;
    for (const candidate of candidatesAround(rects, block, gap)) {
      if (rects.some((p) => rectsOverlap(p, candidate, gap))) continue;
      const dx = (candidate.x + candidate.w / 2 - cx) / WIDE_BIAS;
      const dy = candidate.y + candidate.h / 2 - cy;
      // Bounding-box size + twice the distance to the town, plus a little jitter for variety.
      const box = boundingBox([...rects, candidate]);
      const score = Math.max(box.w / WIDE_BIAS, box.h) + 2 * Math.sqrt(dx * dx + dy * dy) + rng() * 1.5;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    // There is always a free spot beside the cluster, so `best` is never null.
    if (best) placed.set(block.id, best);
  }
  return placed;
}

function boundingBox(rects: readonly Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const w = Math.max(...rects.map((r) => r.x + r.w)) - x;
  const h = Math.max(...rects.map((r) => r.y + r.h)) - y;
  return { x, y, w, h };
}

/** Every position where `block` would sit exactly `gap` tiles beside one of the placed rectangles. */
function candidatesAround(placed: readonly Rect[], block: PackRequest, gap: number): Rect[] {
  const { w, h } = block;
  const out: Rect[] = [];
  for (const p of placed) {
    for (let y = p.y - h + 1; y <= p.y + p.h - 1; y++) {
      out.push({ x: p.x + p.w + gap, y, w, h }); // right of p
      out.push({ x: p.x - gap - w, y, w, h }); // left of p
    }
    for (let x = p.x - w + 1; x <= p.x + p.w - 1; x++) {
      out.push({ x, y: p.y + p.h + gap, w, h }); // below p
      out.push({ x, y: p.y - gap - h, w, h }); // above p
    }
  }
  return out;
}
