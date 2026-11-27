/**
 * The victory screen's closing nudge. Victory only comes once every bug is
 * gone from the code (SPEC.md F1): fixed for real, or sealed with `# noqa`.
 * A clean sweep of real fixes is celebrated; seals get a gentle reminder
 * that they are accepted, not fixed.
 */
import type { RepoHealth } from "@/lib/game";

export const ALL_FIXED_TAKEAWAY = "Every bug is fixed in the code itself! Your patch is waiting in the Workshop's Changes tab.";

export function victoryTakeaway(health: Pick<RepoHealth, "fixed" | "sealed">): string {
  if (health.sealed === 0) return ALL_FIXED_TAKEAWAY;
  const ignored = health.sealed === 1 ? "1 bug is only ignored" : `${health.sealed} bugs are only ignored`;
  return `You fixed ${health.fixed} for real, and ${ignored} with # noqa. Come back and fix them properly some day!`;
}

/** "fixed" or "fixed or ignored": how the bugs were dealt with, for the victory headline. */
export function howDealtWith(health: Pick<RepoHealth, "sealed">): string {
  return health.sealed === 0 ? "fixed" : "fixed or ignored";
}
