/**
 * The dungeon counter next to the location in the HUD: how many monsters
 * are left to fight, and how many lines are left to fix (SPEC.md F1).
 *
 *   fighting   skull   "fight 2 · fix 5"
 *   quiet      zzz     "quiet · fix 5"
 *   purified   check   "purified!"
 */
import type { HudState } from "@/game/bridge";

export type DungeonCounterTone = "fighting" | "quiet" | "purified";

export interface DungeonCounter {
  tone: DungeonCounterTone;
  icon: "skull" | "zzz" | "checkmark";
  text: string;
}

export function dungeonCounter(dungeon: Pick<NonNullable<HudState["dungeon"]>, "remaining" | "toFix">): DungeonCounter {
  if (dungeon.toFix === 0) return { tone: "purified", icon: "checkmark", text: "purified!" };
  if (dungeon.remaining === 0) return { tone: "quiet", icon: "zzz", text: `quiet · fix ${dungeon.toFix}` };
  return { tone: "fighting", icon: "skull", text: `fight ${dungeon.remaining} · fix ${dungeon.toFix}` };
}
