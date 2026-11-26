/**
 * The victory screen's closing nudge: what is left to do in the real code.
 * The game only beats the monsters; a bug squashed in the game is still in
 * the code until it is fixed for real. A player who never opened the
 * Workshop reads the game's original line.
 */
import type { RepoHealth } from "@/lib/game";

export const CLASSIC_TAKEAWAY = "The monsters are gone, but the bugs are still in the code. Now go fix them for real!";

export function victoryTakeaway(health: Pick<RepoHealth, "defeated" | "fixed">): string {
  if (health.fixed === 0) return CLASSIC_TAKEAWAY;
  if (health.defeated === 0) return "You fixed every bug in the code itself! Your patch is waiting in the Workshop's Changes tab.";
  const still = health.defeated === 1 ? "1 squashed bug is" : `${health.defeated} squashed bugs are`;
  return `You fixed ${health.fixed} in the code, but ${still} still there. Fix them for real in the Workshop!`;
}
