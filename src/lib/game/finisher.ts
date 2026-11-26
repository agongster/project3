/**
 * The PICK-THE-FIX FINISHER, as pure rules.
 *
 * When the hero knocks an elite or a boss down to 0 HP it is dazed for a
 * moment, and pressing E asks "Which fix really squashes this bug?" with
 * three answers: the finding's own fix tip and two tips borrowed from OTHER
 * Ruff rules. This file decides those answers and what a right pick is
 * worth; the engine (src/game/entities/monsters/) and the Finisher overlay
 * only call it:
 *
 *   hasFinisher(severity)          which monsters can be finished this way
 *   finisherOptions(finding)       the three answers, always in the same order for a finding
 *   recordCriticalFix(save, ...)   the save bookkeeping of a right pick (bonus XP, the counter)
 */
import { ruleInfo } from "@/lib/analysis/rules";
import { MONSTERS } from "@/lib/game/catalog";
import { MAX_XP } from "@/lib/game/store";
import { rngFromString, shuffled, type Rng } from "@/lib/rng";
import type { Finding, FindingCategory, MonsterKind, SaveData, Severity } from "@/lib/types";

// ───────────────────────────── Tuning ─────────────────────────────

/** A right pick pays the monster's coin drop this many times over (2 = double coins). */
export const CRITICAL_FIX_COIN_MULTIPLIER = 2;
/** …and its XP this many times over (2 = double XP). */
export const CRITICAL_FIX_XP_MULTIPLIER = 2;
/** One right answer plus this many wrong ones. */
const WRONG_OPTION_COUNT = 2;

/**
 * Rules whose tips are borrowed as wrong answers: a few classic rules per
 * finding category, so every finding can get believable wrong answers from
 * its own category. Only the codes live here; the tip text is looked up with
 * `ruleInfo`, so rules.ts stays the one place where tips are written.
 */
export const WRONG_ANSWER_RULES: readonly string[] = [
  // unused
  "F401",
  "F841",
  "B007",
  // todo
  "ERA001",
  "FIX002",
  // style
  "E711",
  "E731",
  "F541",
  "SIM118",
  // bug
  "F821",
  "F632",
  "B015",
  "PLW0177",
  // trap
  "B006",
  "B023",
  "A001",
  "PLW0711",
  // error-handling
  "E722",
  "S110",
  "B904",
  // complexity
  "C901",
  "PLR0913",
  "PLR0915",
  // security
  "S105",
  "S307",
  "S501",
  "S602",
  "S608",
  // syntax
  "SYNTAX",
];

// ───────────────────────────── Options ─────────────────────────────

/** One answer button. */
export interface FinisherOption {
  text: string;
  correct: boolean;
}

/** A rule tip that may be offered as a wrong answer. */
interface WrongAnswer {
  code: string;
  tip: string;
  category: FindingCategory;
  severity: Severity;
}

const WRONG_ANSWERS: readonly WrongAnswer[] = WRONG_ANSWER_RULES.map((code) => {
  const { tip, category, severity } = ruleInfo(code);
  return { code, tip, category, severity };
});

/** Minions die in a hit or two and come in crowds, so only elites and bosses get the finisher. */
export function hasFinisher(severity: Severity): boolean {
  return severity !== "minion";
}

/**
 * The three answers for a finding: its own `tip` (correct) and two different
 * tips of other rules, shuffled. The shuffle is seeded from the finding id,
 * so the same finding always shows the same order (reopening never
 * reshuffles, and tests are stable).
 */
export function finisherOptions(finding: Pick<Finding, "id" | "code" | "tip" | "category" | "severity">): FinisherOption[] {
  const rng = rngFromString(`finisher:${finding.id}`);
  const right: FinisherOption = { text: finding.tip, correct: true };
  const wrong = pickWrongTips(finding, rng).map((text): FinisherOption => ({ text, correct: false }));
  return shuffled(rng, [right, ...wrong]);
}

/**
 * Two wrong tips, the most believable first: same category (another way
 * code goes wrong in the same family), then same severity, then any rule.
 * A tip is never the finding's own rule, never the right tip's text, and
 * never repeated, so the player always sees three different sentences.
 */
function pickWrongTips(finding: Pick<Finding, "code" | "tip" | "category" | "severity">, rng: Rng): string[] {
  const usable = WRONG_ANSWERS.filter((w) => w.code !== finding.code && w.tip !== finding.tip);
  const tiers = [usable.filter((w) => w.category === finding.category), usable.filter((w) => w.severity === finding.severity), usable];
  const chosen: string[] = [];
  for (const tier of tiers) {
    for (const candidate of shuffled(rng, tier)) {
      if (chosen.length === WRONG_OPTION_COUNT) return chosen;
      if (!chosen.includes(candidate.tip)) chosen.push(candidate.tip);
    }
  }
  return chosen;
}

// ───────────────────────────── Rewards ─────────────────────────────

/** XP a right pick adds on top of the monster's usual XP. */
export function criticalFixBonusXp(monster: MonsterKind): number {
  return MONSTERS[monster].xp * (CRITICAL_FIX_XP_MULTIPLIER - 1);
}

/**
 * A right pick: the bonus XP and one more `stats.fixesPicked`. Call it once,
 * together with the defeat itself (src/game/scenes/defeat.ts does). The
 * extra coins are dropped by the engine as pickups, like every coin.
 */
export function recordCriticalFix(save: SaveData, finding: Pick<Finding, "monster">): SaveData {
  return {
    ...save,
    xp: Math.min(MAX_XP, save.xp + criticalFixBonusXp(finding.monster)),
    stats: { ...save.stats, fixesPicked: save.stats.fixesPicked + 1 },
  };
}
