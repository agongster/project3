/**
 * What the villagers say: the cast of a village and each one's lines.
 *
 *   the guide        right beside the spawn point: welcomes the player with
 *                    the repo's README (or GitHub description), the big
 *                    picture and the controls
 *   merchants        one per most-imported outside package (merchants.ts)
 *   town folk        on the plaza; from the repo's root files
 *   region villagers by a region's gate; from that region's code
 *
 * Town folk and region villagers are named after real classes and functions
 * where they live and quote that code's comments and docstrings
 * (repoWords.ts). Each also shares a repo fact and a gameplay tip, so new
 * players still learn the controls. A repo with no comments, docstrings or
 * functions at all still gets a complete village: names then come from
 * VILLAGER_NAMES and lines from the repo facts.
 */
import { clipWords, oneLine } from "@/lib/analysis/repoText";
import type { AnalyzedFile, RepoAnalysis } from "@/lib/types";
import { shuffled, type Rng } from "@/lib/rng";
import { writeMerchants } from "./merchants";
import { compareText, isTrivialInit, planRegions, type RegionPlan } from "./regions";
import { bubbleText, codeNames, definitionLabel, fileQuotes, isQuotable, quoteLine, tidyComment, type CodeName, type Quote } from "./repoWords";

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
  "Press F to open the Workshop: fix a bug in the code itself and its monster is gone for good!",
];

/** A village never has more villagers than this (validate.ts checks the same 3–6 range). */
export const MAX_VILLAGERS = 6;
/** The guide plus at least one more ordinary villager always stand on the plaza. */
const MIN_PLAZA_FOLK = 2;
/** Each villager keeps at most this many speech-bubble sayings. */
const MAX_BUBBLES = 3;
/** The repo name in the guide's welcome is clipped to this length. */
const MAX_REPO_NAME = 32;
/** The GitHub description in the guide's welcome (when there is no README) is clipped to this length. */
const MAX_WELCOME_DESCRIPTION = 100;
/** The README blurb is clipped again here, in case an analysis carries a longer one. */
const MAX_WELCOME_README = 170;

export interface VillagerScript {
  name: string;
  /** 1–3 dialog lines. A quote line holds its attribution after ATTRIBUTION_SEPARATOR. */
  lines: string[];
  /** Short sayings for speech bubbles (printable ASCII, already clipped); may be empty. */
  bubbles: string[];
}

/** A villager who belongs to one region and stands by its gate. */
export interface RegionalScript {
  regionId: string;
  script: VillagerScript;
}

export interface VillagerCast {
  /** Town Square folk: the guide first, then the merchants and the other town folk. */
  town: VillagerScript[];
  /** Region villagers, one per chosen region, richest in words first. */
  regional: RegionalScript[];
}

/**
 * Writes the village's cast. `count` is how many ordinary villagers (guide,
 * town folk, region villagers) the map has room for; merchants come on top,
 * as long as the whole cast stays within MAX_VILLAGERS.
 */
export function writeVillagers(analysis: RepoAnalysis, count: number, rng: Rng): VillagerCast {
  const [townPlan, ...regionPlans] = planRegions(analysis.files); // the town always comes first
  const merchants = writeMerchants(analysis.files).slice(0, Math.max(1, MAX_VILLAGERS - count));
  const ordinary = Math.min(count, MAX_VILLAGERS - merchants.length);
  const chosenRegions = richestFirst(regionPlans).slice(0, Math.max(0, ordinary - MIN_PLAZA_FOLK));
  const townFolkCount = Math.max(1, ordinary - 1 - chosenRegions.length);

  // Names: from the code where each villager lives, else from the classic list. All unique.
  const taken = new Set(merchants.map((m) => m.name));
  const spareNames = shuffled(rng, VILLAGER_NAMES);
  const nameFor = (code: CodeName | undefined): string => code?.name ?? takeSpareName(spareNames, taken);
  const townCode = codeNames(townPlan.files, townFolkCount + 1, taken);
  const regionCode = chosenRegions.map((plan) => codeNames(plan.files, 1, taken)[0]);

  const welcome = welcomeLine(analysis);
  const [overview, ...facts] = repoFacts(analysis, welcome?.usesDescription !== true);
  const tips = [GAMEPLAY_TIPS[0], ...shuffled(rng, GAMEPLAY_TIPS.slice(1))];
  const tipFor = (i: number) => tips[i % tips.length];

  // Without a welcome, the guide opens with the overview and takes the first fact too.
  const guide: VillagerScript = {
    name: nameFor(townCode[0]),
    lines: welcome ? [welcome.text, overview, tipFor(0)] : [overview, ...facts.slice(0, 1), tipFor(0)],
    bubbles: sayings([], `Welcome to ${repoName(analysis)}!`),
  };

  // The other facts are dealt like cards to everyone else (town folk first), at most two each.
  const pile = welcome ? facts : facts.slice(1);
  const listeners = townFolkCount + chosenRegions.length;
  const hands: string[][] = Array.from({ length: listeners }, () => []);
  pile.forEach((fact, k) => {
    if (hands[k % listeners].length < 2) hands[k % listeners].push(fact);
  });

  /** An ordinary villager: named after `code` (if any), quoting `quotes`, with a hand of facts and a tip. */
  const villager = (code: CodeName | undefined, quotes: readonly Quote[], hand: readonly string[], tip: string, greeting: string): VillagerScript => {
    const said = withOwnDocstring(code, quotes);
    return { name: nameFor(code), lines: composeLines(said, hand, overview, tip), bubbles: sayings(said, greeting) };
  };

  // Town folk share the root files' quotes between them, so no two say the same thing.
  const townQuotes = dealQuotes(regionQuotes(townPlan.files, rng), townFolkCount);
  const townFolk = townQuotes.map((quotes, i) => villager(townCode[i + 1], quotes, hands[i], tipFor(i + 1), "Welcome to Town Square!"));

  const regional = chosenRegions.map((plan, i) => {
    const k = townFolkCount + i;
    return { regionId: plan.id, script: villager(regionCode[i], regionQuotes(plan.files, rng), hands[k], tipFor(k + 1), `Welcome to ${plan.name}!`) };
  });

  return { town: [guide, ...merchants, ...townFolk], regional };
}

// ───────────────────────── Pieces of a script ─────────────────────────

/** The next classic name nobody has yet (with a number once all are used, e.g. "Pip 2"). */
function takeSpareName(spare: readonly string[], taken: Set<string>): string {
  for (let round = 1; ; round++) {
    const name = spare.map((base) => (round === 1 ? base : `${base} ${round}`)).find((candidate) => !taken.has(candidate));
    if (name !== undefined) {
      taken.add(name);
      return name;
    }
  }
}

function repoName(analysis: RepoAnalysis): string {
  return clipWords(oneLine(analysis.repo.repo), MAX_REPO_NAME) || "this land";
}

/** The guide's first words: the README blurb, else the GitHub description, else nothing (the overview then opens). */
function welcomeLine(analysis: RepoAnalysis): { text: string; usesDescription: boolean } | null {
  const name = repoName(analysis);
  const readme = oneLine(analysis.readme ?? "");
  if (readme !== "") return { text: `Welcome to ${name}! ${clipWords(readme, MAX_WELCOME_README)}`, usesDescription: false };
  const description = oneLine(analysis.description ?? "");
  if (description === "") return null;
  return { text: `Welcome to ${name}! They say it's all about "${clipWords(description, MAX_WELCOME_DESCRIPTION)}"`, usesDescription: true };
}

/**
 * Regions with the most quotable comments and docstrings first (they get a
 * villager before quieter ones); ties keep the plan order, biggest first.
 */
function richestFirst(plans: readonly RegionPlan[]): RegionPlan[] {
  const quoteCount = new Map(plans.map((plan) => [plan, plan.files.reduce((sum, file) => sum + fileQuotes(file).length, 0)]));
  return [...plans].sort((a, b) => (quoteCount.get(b) ?? 0) - (quoteCount.get(a) ?? 0));
}

/** All quotes of a region's files, shuffled (the rng is seeded, so it is still deterministic). */
function regionQuotes(files: readonly AnalyzedFile[], rng: Rng): Quote[] {
  return shuffled(rng, files.flatMap(fileQuotes));
}

/** Splits quotes round-robin into `hands` piles. */
function dealQuotes(quotes: readonly Quote[], hands: number): Quote[][] {
  const piles: Quote[][] = Array.from({ length: hands }, () => []);
  quotes.forEach((quote, k) => piles[k % hands].push(quote));
  return piles;
}

/** A villager named after a documented definition says its docstring first ("Hi, I'm Bake Batch: 'Bake a whole tray…'"). */
function withOwnDocstring(code: CodeName | undefined, quotes: readonly Quote[]): Quote[] {
  const docstring = code?.definition.docstring ? tidyComment(code.definition.docstring) : "";
  if (!code || !isQuotable(docstring)) return [...quotes];
  const owner = definitionLabel(code.definition);
  const own: Quote = { text: docstring, path: code.path, line: null, owner };
  return [own, ...quotes.filter((quote) => !(quote.owner === owner && quote.path === code.path))];
}

/**
 * Up to two things to say, then the tip: the villager's first quote, a repo
 * fact (or else a second quote), more facts when they have no quotes. A
 * villager with nothing at all to say repeats the overview.
 */
function composeLines(quotes: readonly Quote[], facts: readonly string[], overview: string, tip: string): string[] {
  const spoken = [...quotes.slice(0, 1).map(quoteLine), ...facts, ...quotes.slice(1).map(quoteLine)].slice(0, 2);
  return [...(spoken.length > 0 ? spoken : [overview]), tip];
}

/** The quotes short enough for a speech bubble (at most MAX_BUBBLES), or just `greeting` when none are. */
function sayings(quotes: readonly Quote[], greeting: string): string[] {
  const fromCode = quotes.map((quote) => bubbleText(quote.text)).filter((text): text is string => text !== null);
  if (fromCode.length > 0) return fromCode.slice(0, MAX_BUBBLES);
  const hello = bubbleText(greeting);
  return hello === null ? [] : [hello];
}

// ───────────────────────── Repo facts ─────────────────────────

/**
 * Facts about the repo as friendly sentences, most useful first. The first
 * one is always the overview. `withDescription` false leaves out the
 * GitHub description (when the guide already quotes it).
 */
export function repoFacts(analysis: RepoAnalysis, withDescription = true): string[] {
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

  const tidiest = maxBy(
    okFiles.filter((f) => f.findings.length === 0 && !isTrivialInit(f)),
    (f) => f.quality.score,
  );
  if (tidiest) facts.push(`The folks at ${tidiest.path} keep everything SO tidy — grade ${tidiest.quality.grade}!`);

  const longest = maxBy(okFiles, (f) => f.lineCount);
  if (longest && files.length > 1) {
    facts.push(`The longest scroll around is ${longest.path}: ${formatNumber(longest.lineCount)} ${plural(longest.lineCount, "line")}!`);
  }

  if (analysis.stars > 0) {
    facts.push(`${formatNumber(analysis.stars)} ${plural(analysis.stars, "traveller")} ${analysis.stars === 1 ? "has" : "have"} starred this land!`);
  }
  const description = withDescription ? oneLine(analysis.description ?? "") : "";
  if (description) facts.push(`They say this land is all about "${clipWords(description, 80)}"`);
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
