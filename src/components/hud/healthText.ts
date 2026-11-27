/**
 * The words behind the two-tone Repo Health bar: only fixed and sealed bugs
 * fill it (they are gone from the code); bugs subdued in a fight show as its
 * lighter part until they are fixed. Pure, so it is unit-tested.
 */
import type { RepoHealth } from "@/lib/game";

/**
 * The bar's tooltip and screen-reader label, e.g.
 * "Repo Health 40%: 10 fixed, 2 ignored, 5 subdued (fix their lines!), 13 still fighting".
 */
export function healthTooltip(health: Pick<RepoHealth, "ratio" | "fixed" | "sealed" | "subdued" | "alive" | "total">): string {
  const percent = Math.round(health.ratio * 100);
  if (health.total === 0) return "Repo Health 100%: Ruff found no bugs here";
  const parts = [`${health.fixed} fixed`];
  if (health.sealed > 0) parts.push(`${health.sealed} ignored`);
  if (health.subdued > 0) parts.push(`${health.subdued} subdued (fix their lines!)`);
  if (health.alive > 0) parts.push(`${health.alive} still fighting`);
  return `Repo Health ${percent}%: ${parts.join(", ")}`;
}
