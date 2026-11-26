/**
 * Quests: small jobs taken from the player's own code ("Document read_order()
 * in bakery/orders.py", "Remove the unused import at line 3 of recipes.py")
 * that give a reason to *edit* in the Workshop, not only to fight.
 *
 * How the pieces fit:
 *   questsTypes.ts   what is kept in the save (a quest is saved as a "spec")
 *   questsFind.ts    every quest the code could offer right now (candidates)
 *   questsBoard.ts   which of them are on the board, and refilling it
 *   questsCheck.ts   is a quest done? (a pure test on the current code)
 *   questsStreak.ts  the forge streak ("Clean forge ×3")
 *   achievements.ts  one-time badges
 *   questsSettle.ts  `settleQuests`: the one reducer the game calls
 *   questsSave.ts    cleaning all of it when a save is loaded
 *
 * This file holds what they share: the tuning numbers, the shape of a quest
 * as the UI shows it, and how a quest's id is built from its target.
 */
import { clipWords, oneLine } from "@/lib/analysis/repoText";
import { hashString } from "@/lib/rng";
import type { Finding, MonsterKind } from "@/lib/types";
import type { QuestKind, QuestSpec, TidyTask } from "./questsTypes";

export type { QuestKind, QuestSpec, RepoQuests, TidyTask, WorkshopCounts, WorkshopProgress } from "./questsTypes";

// ───────────────────────────── Tuning ─────────────────────────────

/** Quests on a board at once: one of each specific kind if the code allows, plus one tidy-up chore. */
export const QUEST_BOARD_SIZE = 5;

export interface QuestReward {
  coins: number;
  xp: number;
}

/** What each kind of quest pays when it is completed. Harder kinds pay more. */
export const QUEST_REWARDS: Readonly<Record<QuestKind, QuestReward>> = {
  tidy: { coins: 15, xp: 10 },
  document: { coins: 25, xp: 15 },
  fix: { coins: 30, xp: 20 },
  grade: { coins: 50, xp: 30 },
  purify: { coins: 60, xp: 40 },
};

/** The name of each kind, shown on the quest card. */
export const QUEST_KIND_LABELS: Readonly<Record<QuestKind, string>> = {
  fix: "Fix it for real",
  document: "Light the lantern",
  grade: "Raise the grade",
  purify: "Purify by hand",
  tidy: "Tidy up",
};

/** "Purify by hand" is only offered for small jobs: files with at most this many findings. */
export const MAX_PURIFY_BUGS = 3;

/** "Raise the grade" skips files shorter than this: tiny files get a flat grade that editing can't lift. */
export const MIN_GRADE_QUEST_LINES = 10;

/** How far each tidy-up chore asks the player to go (fewer if the repo has fewer to give). */
export const TIDY_GOALS: Readonly<Record<TidyTask, number>> = { fixAny: 2, documentAny: 2, squash: 3, comment: 1 };

/** Completed quests shown checked off under the board. */
export const MAX_RECENT_QUESTS = 3;

/**
 * Completed quest ids remembered per repo (the newest). Older ones can be
 * forgotten safely: a quest is only offered while its job is still undone.
 */
export const MAX_DONE_QUESTS = 200;

// Longest text kept in a saved quest. Everything in a quest comes from the repo, so it is bounded.
// Paths, names and rule codes are used to look things up again, so they are never clipped:
// a file, function or rule with a longer one simply gets no quest.
export const MAX_QUEST_PATH = 300;
export const MAX_QUEST_NAME = 80;
export const MAX_QUEST_CODE = 16;
// Messages and rule titles are only compared after clipping both sides the same way, so clipping is fine.
export const MAX_QUEST_MESSAGE = 160;
export const MAX_QUEST_RULE = 60;
/** The longest id `questId` can build from clipped parts, with room to spare. */
export const MAX_QUEST_ID = 420;

// ───────────────────────── What the UI shows ─────────────────────────

/** Where "go there" takes the player. */
export interface QuestTarget {
  path: string;
  /** 1-based line to jump to, when there is a sensible one. */
  line?: number;
  /** The function or class the quest is about ("Trainer.fit"). */
  name?: string;
}

export interface QuestProgress {
  done: boolean;
  /** For quests with steps (a score to reach, bugs to fix): how far along, and the goal. */
  current?: number;
  goal?: number;
}

/** A quest as the board shows it. Plain data, worked out from a saved spec and the current code. */
export interface Quest {
  id: string;
  kind: QuestKind;
  title: string;
  /** One line of detail under the title. */
  description: string;
  target: QuestTarget;
  reward: QuestReward;
  progress: QuestProgress;
  /** The monster a "Fix it for real" quest is about (its icon). */
  monster?: MonsterKind;
}

// ───────────────────────── Ids and fingerprints ─────────────────────────

/** Repo text as one tidy line, clipped. Used for everything a quest keeps, so comparisons stay fair. */
export function questText(text: string, max: number): string {
  return clipWords(oneLine(text), max);
}

/**
 * The line of code a finding points at, trimmed: its first highlighted
 * snippet line that is not blank ("" if there is none). With the rule and
 * the message it recognises the same bug after lines above it moved.
 */
export function findingLineText(finding: Finding): string {
  const hit = finding.snippet.find((line) => line.hit && line.text.trim() !== "");
  return questText(hit?.text ?? "", MAX_QUEST_MESSAGE);
}

/**
 * True when `finding` is the bug a fix quest is about: same rule, same
 * message, same line of code. The line *number* is ignored on purpose, so
 * inserting a line above the bug does not make the quest think it is gone.
 */
export function isSameBug(spec: { code: string; message: string; lineText: string }, finding: Finding): boolean {
  return (
    finding.code === spec.code &&
    questText(finding.message, MAX_QUEST_MESSAGE) === spec.message &&
    findingLineText(finding) === spec.lineText
  );
}

/** Rule, message and line of code squeezed into a short tag (keeps fix ids short). */
function bugTag(spec: { code: string; message: string; lineText: string }): string {
  return hashString(`${spec.code}\n${spec.message}\n${spec.lineText}`).toString(36);
}

/**
 * A quest's id, built only from what the quest is about, so the same job
 * always gets the same id (and is never paid twice). Line numbers are left
 * out because they shift while the player edits.
 */
export function questId(spec: QuestSpec): string {
  switch (spec.kind) {
    case "fix":
      return `fix:${spec.path}:${spec.code}:${bugTag(spec)}`;
    case "document":
      return `document:${spec.path}:${spec.name}`;
    case "grade":
      return `grade:${spec.path}:${spec.to}`;
    case "purify":
      return `purify:${spec.path}`;
    case "tidy":
      return `tidy:${spec.round}`;
  }
}

/** The text that seeds the repo-specific shuffles (same as the world's). */
export function repoSeed(analysis: { repo: { owner: string; repo: string; sha: string } }): string {
  const { owner, repo, sha } = analysis.repo;
  return `${owner}/${repo}@${sha}`;
}
