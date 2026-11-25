/**
 * "Press E to …": things the hero can interact with.
 *
 * Each Interactable says WHERE the hero should stand (a spot + radius,
 * usually the tile in front of a door or prop), WHAT the prompt says, and
 * what happens on E. Every step the scene asks `nearestInteractable` for the
 * closest one in range, shows its prompt in the HUD, and calls `activate`
 * when interact is pressed.
 */
import type { Prop } from "@/lib/types";
import type { SceneContext } from "./context";

export interface Interactable {
  /** Where the hero should stand (world px, compared with the hero's feet). */
  x: number;
  y: number;
  radius: number;
  prompt(): string;
  activate(): void;
}

/** The closest interactable whose spot contains the hero's feet, or null. */
export function nearestInteractable(ctx: SceneContext, list: Iterable<Interactable>): Interactable | null {
  const p = ctx.game.player;
  let best: Interactable | null = null;
  let bestDist = Infinity;
  for (const it of list) {
    const d = Math.hypot(it.x - p.x, it.y - (p.y - 3));
    if (d <= it.radius && d < bestDist) {
      best = it;
      bestDist = d;
    }
  }
  return best;
}

/** Spot in front of (south of) a prop's tile, where the hero stands to use it. */
function frontOf(prop: Prop): { x: number; y: number } {
  return { x: prop.x * 16 + 8, y: prop.y * 16 + 22 };
}

/** Readable props (signs, lanterns, stumps, plaques) open a dialog. */
const READABLE: Record<string, { speaker: string; lines: (text: string) => string[]; prompt: string }> = {
  sign: { speaker: "Sign", lines: (t) => [t], prompt: "Read the sign" },
  lantern: { speaker: "Lantern", lines: (t) => [t, "An empty __init__.py. It just keeps the lights on for its package."], prompt: "Look at the lantern" },
  stump: { speaker: "Old Stump", lines: (t) => [t, "This file couldn't be fetched, so only a stump remains."], prompt: "Look at the stump" },
  plaque: { speaker: "Plaque", lines: (t) => [t], prompt: "Read the plaque" },
};

/**
 * Interactables for landmark props: the Wishing Well, the wardrobe, the
 * notice board and anything with text. Props without a use return null.
 */
export function propInteractable(ctx: SceneContext, prop: Prop): Interactable | null {
  const spot = frontOf(prop);
  const game = ctx.game;
  const make = (prompt: string, activate: () => void, radius = 12): Interactable => ({ ...spot, radius, prompt: () => prompt, activate });
  switch (prop.kind) {
    case "well":
      return make("Make a wish at the Wishing Well", () => game.emitPausing({ type: "gacha" }));
    case "wardrobe":
      return make("Change your look at the wardrobe", () => game.emitPausing({ type: "wardrobe" }));
    case "board":
      return make("Read the notice board", () => game.emitPausing({ type: "board" }));
    default: {
      const readable = READABLE[prop.kind];
      if (!readable || !prop.text) return null;
      const text = prop.text;
      // Lanterns are not solid: you may also stand right on them.
      const radius = prop.kind === "lantern" ? 16 : 12;
      return make(readable.prompt, () => game.emitPausing({ type: "dialog", speaker: readable.speaker, lines: readable.lines(text) }), radius);
    }
  }
}
