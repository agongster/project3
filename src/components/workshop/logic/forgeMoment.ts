/**
 * Turns the plain facts of a forge (the workspace's ForgeReport) and what the
 * game paid for it into the little celebration the Workshop plays:
 *
 *   - every bug fixed for real is "banished" (its monster, its name, the coins);
 *   - every bug only sealed with `# noqa` is listed plainly, without a reward;
 *   - every new bug is announced gently ("A Gremlin crept in at line 12 — no harm done");
 *   - a file whose last bug is gone gets a big "purified" banner;
 *   - a grade change flips the letter.
 *
 * A forge with none of that is "quiet": the editor just ticks.
 */
import { MONSTERS } from "@/lib/game/catalog";
import { fixCoins } from "@/lib/game/forge";
import type { Finding, Grade, MonsterKind } from "@/lib/types";
import type { ForgeReport } from "@/lib/workspace/contract";
import type { ForgeRewards } from "../types";
import { matchFindings } from "./findingDiff";

/** One monster in the moment. */
export interface MomentMonster {
  /** The finding id, for React keys. */
  id: string;
  monster: MonsterKind;
  /** "Mimic". */
  name: string;
  /** "Mutable default argument". */
  title: string;
  line: number;
  /** Coins this fix paid ("+8"), or null when it paid nothing or the game did not say. */
  coins: number | null;
}

export interface ForgeMoment {
  /** The forged files, in the order they were forged. */
  paths: string[];
  banished: MomentMonster[];
  /** Bugs gone from the code because they were sealed, not fixed (no coins). */
  sealed: MomentMonster[];
  creptIn: MomentMonster[];
  /** Files whose last bug was fixed. */
  purified: string[];
  /** Grade letters that changed, per file. */
  grades: { path: string; from: Grade; to: Grade }[];
  /** Coins, XP and lines the game reported; null when it reported nothing. */
  rewards: ForgeRewards | null;
  /** True when there is nothing to celebrate or announce. */
  quiet: boolean;
}

function toMomentMonster(finding: Finding, coins: number | null = null): MomentMonster {
  return { id: finding.id, monster: finding.monster, name: MONSTERS[finding.monster].name, title: finding.title, line: finding.line, coins };
}

/**
 * The fixed findings with what each one paid. The game reports paid fixes by
 * their finding in the repo's original text, whose line may differ from the
 * forged version's, so they are paired as the same bug (code and message).
 */
function banishedWithCoins(fixed: readonly Finding[], paid: readonly Finding[]): MomentMonster[] {
  const { kept } = matchFindings(fixed, paid);
  const paidFor = new Map(kept.map((pair) => [pair.before, pair.after]));
  return fixed.map((finding) => {
    const paidFix = paidFor.get(finding);
    return toMomentMonster(finding, paidFix ? fixCoins(paidFix) : null);
  });
}

function hasRewards(rewards: ForgeRewards | null): boolean {
  return rewards !== null && (rewards.coins > 0 || rewards.xp > 0 || rewards.lines.length > 0);
}

/** The moment for one forge. `rewards` is what `onForged` returned (nothing, when the game paid nothing). */
export function describeForge(report: ForgeReport, rewards: ForgeRewards | null | undefined | void): ForgeMoment {
  const paid = rewards ? rewards : null;
  const gradeChanged = report.linted && report.before.grade !== report.after.grade;
  const sealedIds = new Set(paid?.sealedIds ?? []);
  const gone = report.linted ? report.fixed : [];
  const moment: ForgeMoment = {
    paths: [report.path],
    banished: banishedWithCoins(
      gone.filter((finding) => !sealedIds.has(finding.id)),
      paid?.paidFixes ?? [],
    ),
    sealed: gone.filter((finding) => sealedIds.has(finding.id)).map((finding) => toMomentMonster(finding)),
    creptIn: report.linted ? report.introduced.map((finding) => toMomentMonster(finding)) : [],
    purified: report.linted && report.purified ? [report.path] : [],
    grades: gradeChanged ? [{ path: report.path, from: report.before.grade, to: report.after.grade }] : [],
    rewards: paid,
    quiet: false,
  };
  moment.quiet = isQuiet(moment);
  return moment;
}

function isQuiet(moment: ForgeMoment): boolean {
  const nothingGone = moment.banished.length === 0 && moment.sealed.length === 0;
  return nothingGone && moment.creptIn.length === 0 && moment.purified.length === 0 && moment.grades.length === 0 && !hasRewards(moment.rewards);
}

function addRewards(a: ForgeRewards | null, b: ForgeRewards | null): ForgeRewards | null {
  if (!a) return b;
  if (!b) return a;
  return { coins: a.coins + b.coins, xp: a.xp + b.xp, lines: [...a.lines, ...b.lines], sealedIds: [...(a.sealedIds ?? []), ...(b.sealedIds ?? [])] };
}

/** One moment for several forges ("Forge all"). */
export function mergeMoments(moments: readonly ForgeMoment[]): ForgeMoment {
  const merged: ForgeMoment = { paths: [], banished: [], sealed: [], creptIn: [], purified: [], grades: [], rewards: null, quiet: true };
  for (const moment of moments) {
    merged.paths.push(...moment.paths);
    merged.banished.push(...moment.banished);
    merged.sealed.push(...moment.sealed);
    merged.creptIn.push(...moment.creptIn);
    merged.purified.push(...moment.purified);
    merged.grades.push(...moment.grades);
    merged.rewards = addRewards(merged.rewards, moment.rewards);
  }
  merged.quiet = isQuiet(merged);
  return merged;
}

/** "a Gremlin" / "an Echo Bat". */
export function withArticle(name: string): string {
  return /^[aeiou]/i.test(name) ? `An ${name}` : `A ${name}`;
}

/** The gentle line for a bug that a forge introduced (or that a revert brought back). */
export function creptInText(monster: MomentMonster, reverted = false): string {
  const how = reverted ? "is back" : "crept in";
  return `${withArticle(monster.name)} ${how} at line ${monster.line} — no harm done`;
}

/** The plain line for a bug that was sealed instead of fixed: no fanfare, no coins. */
export function sealedText(monster: MomentMonster): string {
  return `${monster.name} sealed at line ${monster.line} — accepted with # noqa, no reward`;
}

/** Grade letters from worst to best, to tell an improvement from a drop. */
const GRADE_ORDER: readonly Grade[] = ["C", "B", "A", "S"];

/** True when the grade got better. */
export function gradeImproved(from: Grade, to: Grade): boolean {
  return GRADE_ORDER.indexOf(to) > GRADE_ORDER.indexOf(from);
}
