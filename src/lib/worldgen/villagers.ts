/**
 * What the villagers say.
 *
 * Every villager shares one or two real facts about the repo (how big it is,
 * its tidiest file, its most cursed file...) plus a gameplay tip. The facts
 * are written so they read naturally for any repo, including tiny ones and
 * ones without a single finding.
 */
import type { AnalyzedFile, RepoAnalysis } from "@/lib/types";
import { shuffled, type Rng } from "@/lib/rng";
import { compareText, isTrivialInit } from "./regions";

export const VILLAGER_NAMES: readonly string[] = [
  "Pip",
  "Mochi",
  "Bramble",
  "Tilly",
  "Juniper",
  "Biscuit",
  "Clover",
  "Pebble",
  "Hazel",
  "Sprout",
  "Nutmeg",
  "Wren",
  "Maple",
  "Poppy",
  "Figgy",
  "Dottie",
  "Basil",
  "Marzipan",
];

export const GAMEPLAY_TIPS: readonly string[] = [
  "Press Space to swing, Shift to dash!",
  "Toss coins in the Wishing Well for a surprise.",
  "Whack bushes — sometimes coins fall out!",
  "Fancy a new look? The wardrobe on the plaza has you covered.",
  "The notice board by the fountain keeps score for the whole land.",
  "Cursed houses lead down into dungeons. Clean ones hide a treasure chest!",
];

export interface VillagerScript {
  name: string;
  lines: string[];
}

/**
 * Writes `count` villagers' names and lines. The first villager (the one
 * standing closest to the spawn point) always gives the big-picture fact and
 * the controls, so a new player hears the most useful things first.
 */
export function writeVillagers(analysis: RepoAnalysis, count: number, rng: Rng): VillagerScript[] {
  const [overview, ...otherFacts] = repoFacts(analysis);
  const facts = shuffled(rng, otherFacts);
  const tips = [GAMEPLAY_TIPS[0], ...shuffled(rng, GAMEPLAY_TIPS.slice(1))];
  const names = shuffled(rng, VILLAGER_NAMES);

  // Deal the facts out like cards: villager 0 holds the overview, the others
  // take turns drawing from the shuffled pile, at most two facts each.
  const hands: string[][] = Array.from({ length: count }, (_, i) => (i === 0 ? [overview] : []));
  facts.forEach((fact, k) => {
    const who = count > 1 ? 1 + (k % (count - 1)) : 0;
    if (hands[who].length < 2) hands[who].push(fact);
  });
  return hands.map((hand, i) => {
    // More villagers than facts (tiny repos): repeat a fact rather than stay silent.
    if (hand.length === 0) hand.push(facts.length > 0 ? facts[i % facts.length] : overview);
    return { name: names[i % names.length], lines: [...hand, tips[i % tips.length]] };
  });
}

/** Facts about the repo as friendly sentences. The first one is always the overview. */
export function repoFacts(analysis: RepoAnalysis): string[] {
  const files = analysis.files;
  const okFiles = files.filter((f) => f.status === "ok");
  const totalLines = files.reduce((sum, f) => sum + f.lineCount, 0);
  const totalFindings = files.reduce((sum, f) => sum + f.findings.length + f.overflow, 0);
  const facts: string[] = [];

  facts.push(
    files.length === 1
      ? `This whole land is just one file, ${files[0].path}: ${formatNumber(totalLines)} ${plural(totalLines, "line")} of Python. Cozy!`
      : `Welcome! This land has ${formatNumber(files.length)} files and ${formatNumber(totalLines)} lines of Python.`,
  );

  const longest = maxBy(okFiles, (f) => f.lineCount);
  if (longest && files.length > 1) {
    facts.push(`The longest scroll around is ${longest.path}: ${formatNumber(longest.lineCount)} ${plural(longest.lineCount, "line")}!`);
  }

  const tidiest = maxBy(
    okFiles.filter((f) => f.findings.length === 0 && !isTrivialInit(f)),
    (f) => f.quality.score,
  );
  if (tidiest) facts.push(`The folks at ${tidiest.path} keep everything SO tidy — grade ${tidiest.quality.grade}!`);

  if (totalFindings === 0) {
    facts.push("Not a single bug in the whole land! Enjoy the peace and quiet.");
  } else {
    const cursed = maxBy(files, (f) => f.findings.length + f.overflow);
    if (cursed) {
      const n = cursed.findings.length + cursed.overflow;
      facts.push(`Stay away from ${cursed.path}... ${n === 1 ? "a monster lurks" : `${n} monsters lurk`} inside!`);
    }
    const bosses = files.reduce((sum, f) => sum + f.findings.filter((x) => x.severity === "boss").length, 0);
    facts.push(
      bosses === 0
        ? "No bosses around here, thank goodness. Just small fry!"
        : `Rumour has it ${bosses === 1 ? "a boss lurks" : `${bosses} bosses lurk`} in the dungeons. Brrr!`,
    );
    const buggy = files.filter((f) => f.findings.length > 0).length;
    const clean = okFiles.length - buggy;
    facts.push(`${clean} ${clean === 1 ? "house is" : "houses are"} spotless and ${buggy} ${buggy === 1 ? "is" : "are"} cursed. Help us out?`);
  }

  if (analysis.stars > 0) {
    facts.push(`${formatNumber(analysis.stars)} ${plural(analysis.stars, "traveller")} ${analysis.stars === 1 ? "has" : "have"} starred this land!`);
  }
  if (analysis.description) {
    const text = analysis.description.trim();
    const short = text.length > 80 ? `${text.slice(0, 77)}...` : text;
    if (short) facts.push(`They say this land is all about "${short}"`);
  }
  return facts;
}

/** The item with the biggest score; ties go to the alphabetically first path. */
function maxBy(files: readonly AnalyzedFile[], score: (f: AnalyzedFile) => number): AnalyzedFile | undefined {
  let best: AnalyzedFile | undefined;
  for (const f of files) {
    if (!best || score(f) > score(best) || (score(f) === score(best) && compareText(f.path, best.path) < 0)) best = f;
  }
  return best;
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}

/** 12345 → "12,345" (no toLocaleString: output must not depend on the browser's locale). */
export function formatNumber(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
