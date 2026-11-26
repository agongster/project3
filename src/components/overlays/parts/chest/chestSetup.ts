/**
 * Deciding what a chest overlay shows, before anything is animated.
 *
 * The roll happens once when the overlay opens; the overlay then saves it
 * straight away (see ChestOverlay) so that closing early can neither lose
 * the loot nor let the same chest be opened twice.
 */
import { getProgress, goneFindings, rollChest } from "@/lib/game";
import type { ChestLoot } from "@/lib/game";
import type { Rng } from "@/lib/rng";
import type { AnalyzedFile, RepoAnalysis, SaveData } from "@/lib/types";
import type { OverlayRequest } from "../../types";

export type PreparedChest =
  /** No analysed file at that path (should not happen; handled kindly anyway). */
  | { status: "missing" }
  /** This chest was opened before. */
  | { status: "opened" }
  | { status: "ready"; loot: ChestLoot };

type ChestRequest = Extract<OverlayRequest, { kind: "chest" }>;

export function prepareChest(request: ChestRequest, analysis: RepoAnalysis, save: SaveData, key: string, rng: Rng): PreparedChest {
  const file = analysis.files.find((candidate) => candidate.path === request.path && candidate.status === "ok");
  if (!file) return { status: "missing" };
  if (getProgress(save, key).opened.includes(request.path)) return { status: "opened" };
  return { status: "ready", loot: rollChest({ source: request.source, file: chestFile(file, request.source), owned: save.owned }, rng) };
}

/**
 * The file a chest is rolled from. A dungeon's prize is only given once the
 * dungeon is purified, when its code has no finding left; the loot tables
 * judge it by the bugs it HELD (the toughest one, and how many), which are
 * the findings gone from its code (fixed or sealed).
 */
function chestFile(file: AnalyzedFile, source: ChestRequest["source"]): AnalyzedFile {
  if (source !== "dungeon-clear" || file.findings.length > 0) return file;
  return { ...file, findings: goneFindings(file) };
}

/**
 * Why each quality highlight (from the analysis) matters, in one sentence.
 * This is where the game teaches what good code looks like; highlights
 * without an entry are simply shown on their own.
 */
export const HIGHLIGHT_LESSONS: Readonly<Record<string, string>> = {
  "Every function has a docstring": "Each function says what it does, so the next reader (maybe future you) doesn't have to puzzle it out.",
  "Well documented": "Most definitions explain themselves with a docstring. Readers say thank you.",
  "Fully type-hinted": "Every function says what goes in and what comes out, so tools catch mix-ups before the code even runs.",
  "Mostly type-hinted": "Most functions say what types they expect, so tools can catch mix-ups early.",
  "Short, focused functions": "Small functions that do one thing are easier to read, test and reuse.",
  "Helpful comments": "A few good comments explain why the code does what it does.",
  "Neat and tidy": "No tangled logic or overlong functions for the linter to flag.",
  "Small and tidy": "A small file with nothing to fix. Simple is good!",
  "No bugs spotted": "Ruff checked every line and found nothing wrong.",
  "Ruff found nothing to complain about": "Ruff checked every line and found nothing wrong.",
};
