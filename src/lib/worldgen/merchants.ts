/**
 * Town Square merchants: one villager for each of the outside packages the
 * repo imports most ("the numpy merchant"). They are flavour only and sell
 * nothing; their lines say how much of the village relies on them.
 */
import { rankPackages } from "@/lib/analysis/imports";
import { clipPath, clipWords } from "@/lib/analysis/repoText";
import type { AnalyzedFile } from "@/lib/types";
import { bubbleText } from "./repoWords";
import { isTrivialInit } from "./regions";
import type { VillagerScript } from "./villagers";

/** At most this many merchants set up stall on the plaza. */
export const MAX_MERCHANTS = 2;
/** Package names longer than this are clipped in a merchant's name. */
const MAX_PACKAGE_NAME = 14;
/** The best customer's path is clipped (from the left) to this length. */
const MAX_CUSTOMER_PATH = 36;

/** The merchants' scripts, most-imported package first (none for a repo without third-party imports). */
export function writeMerchants(files: readonly AnalyzedFile[]): VillagerScript[] {
  // "Houses" are the buildings: every analysed file except near-empty __init__.py lanterns.
  const houses = files.filter((file) => file.status === "ok" && !isTrivialInit(file)).length;
  return rankPackages(files)
    .slice(0, MAX_MERCHANTS)
    .map((pkg) => merchantScript(clipWords(pkg.name, MAX_PACKAGE_NAME), pkg.importers, houses));
}

function merchantScript(name: string, importers: readonly string[], houses: number): VillagerScript {
  const buyers = Math.min(importers.length, Math.max(houses, 1));
  const best = clipPath(importers[0] ?? "", MAX_CUSTOMER_PATH);
  const share = buyers >= houses ? `Every house here buys from me` : `${buyers} of the ${houses} houses here buy from me`;
  return {
    name: `the ${name} merchant`,
    lines: [`Fresh ${name}, right here! ${share} — ${best} is my best customer.`, `Sorry, adventurer: ${name} is only for code. Try the Wishing Well!`],
    bubbles: [`Fresh ${name} here!`, `${buyers} ${buyers === 1 ? "house buys" : "houses buy"} my ${name}!`]
      .map(bubbleText)
      .filter((text): text is string => text !== null),
  };
}
