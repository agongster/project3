/**
 * FLOOR CODE, part 4: pressing E on a carved line (SPEC.md F1, request 4).
 *
 * Standing on or next to a subdued monster's glowing line shows the usual
 * HUD prompt, "E  Fix line 22 in the Workshop", and E opens the Workshop on
 * exactly that line (the same `workshop` event the plaques use). A healed
 * line offers "E  Read line 22", a sealed one "E  Read line 22 (sealed)";
 * a line whose monster still fights offers nothing (fight it first, or
 * press F).
 *
 * A line is a wide box, not a point, so its "stand here" spot is the point
 * of the box nearest to the hero, worked out every time it is asked. The
 * scene's `nearestInteractable` then compares that distance with the
 * plaques', the chest's and the exit's like any other, so the nearest
 * thing always wins and E is never fought over.
 */
import type { FindingState } from "@/lib/game/progress";
import type { Rect } from "@/lib/types";
import type { Interactable } from "./interactions";

/** How close (px) the hero's feet must come to a line's letters for its prompt to show. */
export const LINE_REACH_PX = 10;
/** nearestInteractable measures from this far above the hero's feet (see interactions.ts). */
const HERO_FEET_LIFT_PX = 3;

/** One line the hero can press E on: which bug, which line of code, and the box its letters cover (world px). */
export interface LineSpot {
  findingId: string;
  line: number;
  box: Rect;
}

/** What the HUD prompt says for a line in each state of its bug, or null when E does nothing there. */
export function linePrompt(state: FindingState, line: number): string | null {
  switch (state) {
    case "alive":
      return null;
    case "subdued":
      return `Fix line ${line} in the Workshop`;
    case "fixed":
      return `Read line ${line}`;
    case "sealed":
      return `Read line ${line} (ignored)`;
  }
}

/** The point of `box` nearest to (x, y): (x, y) itself when it is inside. */
export function nearestPointOn(box: Rect, x: number, y: number): { x: number; y: number } {
  return { x: Math.min(Math.max(x, box.x), box.x + box.w), y: Math.min(Math.max(y, box.y), box.y + box.h) };
}

/**
 * The E spot of one line. `hero` gives the hero's feet; `open` opens the
 * Workshop at a line. Only make one for a line whose prompt is not null.
 */
export function lineInteractable(spot: LineSpot, state: FindingState, hero: () => { x: number; y: number }, open: (line: number) => void): Interactable {
  const nearest = () => {
    const feet = hero();
    return nearestPointOn(spot.box, feet.x, feet.y - HERO_FEET_LIFT_PX);
  };
  return {
    get x() {
      return nearest().x;
    },
    get y() {
      return nearest().y;
    },
    radius: LINE_REACH_PX,
    prompt: () => linePrompt(state, spot.line) ?? "",
    activate: () => open(spot.line),
  };
}
