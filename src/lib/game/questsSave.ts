/**
 * Cleaning the quest board and the Workshop record when a save is loaded
 * (called by `sanitizeSave` in store.ts).
 *
 * Like the rest of the save, anything found in localStorage is untrusted:
 * every field is checked, every list is bounded, unknown achievement ids
 * are dropped, and a saved quest whose id does not match its own contents
 * (`questId`) is dropped too, since it can only be damaged or hand-made.
 * Both fields are optional: a save from before the Workshop loads unchanged.
 */
import { MONSTER_KINDS } from "@/lib/types";
import type { Grade } from "@/lib/types";
import { ACHIEVEMENT_IDS } from "./achievements";
import {
  MAX_DONE_QUESTS,
  MAX_PURIFY_BUGS,
  MAX_QUEST_CODE,
  MAX_QUEST_ID,
  MAX_QUEST_MESSAGE,
  MAX_QUEST_NAME,
  MAX_QUEST_PATH,
  MAX_QUEST_RULE,
  MAX_RECENT_QUESTS,
  QUEST_BOARD_SIZE,
  TIDY_GOALS,
  questId,
  questText,
} from "./quests";
import { nextGrade } from "./questsFind";
import { TIDY_ROTATION } from "./questsBoard";
import type { QuestSpec, RepoQuests, TidyTask, WorkshopCounts, WorkshopProgress } from "./questsTypes";

/** Counters and line numbers are clamped to this (same bound as the rest of the save). */
const MAX_SAVED_NUMBER = 999_999_999;
/** A forge fingerprint is a 32-bit hash written in base 36. */
const FINGERPRINT = /^[0-9a-z]{0,8}$/;
const GRADES: readonly Grade[] = ["S", "A", "B", "C"];
const DEFINITION_KINDS = ["function", "method", "class"] as const;
const LARGEST_TIDY_GOAL = Math.max(...Object.values(TIDY_GOALS));

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as UnknownRecord) : null;
}

/** A whole number in [min, max], or null. */
function intIn(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(MAX_SAVED_NUMBER, Math.max(0, Math.floor(value))) : 0;
}

/** A non-empty string of at most `max` characters, or null. */
function shortString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

/** Text that is already tidied and clipped exactly as a quest keeps it, or null. */
function questTextOrNull(value: unknown, max: number): string | null {
  return typeof value === "string" && questText(value, max) === value ? value : null;
}

function oneOf<T extends string>(value: unknown, options: readonly T[]): T | null {
  return options.find((option) => option === value) ?? null;
}

// ───────────────────────────── Quests ─────────────────────────────

/** The kind-specific fields of a saved quest, checked; null if any is wrong. */
function specFields(raw: UnknownRecord, path: string): QuestSpec | null {
  const line = intIn(raw.line, 1, MAX_SAVED_NUMBER);
  switch (raw.kind) {
    case "fix": {
      const code = shortString(raw.code, MAX_QUEST_CODE);
      const rule = questTextOrNull(raw.rule, MAX_QUEST_RULE);
      const message = questTextOrNull(raw.message, MAX_QUEST_MESSAGE);
      const lineText = questTextOrNull(raw.lineText, MAX_QUEST_MESSAGE);
      const monster = oneOf(raw.monster, MONSTER_KINDS);
      if (!code || rule === null || message === null || lineText === null || !monster || !line) return null;
      return { kind: "fix", id: "", path, code, rule, message, lineText, line, monster };
    }
    case "document": {
      const name = shortString(raw.name, MAX_QUEST_NAME);
      const defKind = oneOf(raw.defKind, DEFINITION_KINDS);
      return name && defKind && line ? { kind: "document", id: "", path, name, defKind, line } : null;
    }
    case "grade": {
      const from = oneOf(raw.from, GRADES);
      return from && from !== "S" && raw.to === nextGrade(from) ? { kind: "grade", id: "", path, from, to: nextGrade(from) } : null;
    }
    case "purify": {
      const bugs = intIn(raw.bugs, 1, MAX_PURIFY_BUGS);
      return bugs ? { kind: "purify", id: "", path, bugs } : null;
    }
    case "tidy": {
      const task = oneOf<TidyTask>(raw.task, TIDY_ROTATION);
      const round = intIn(raw.round, 1, MAX_SAVED_NUMBER);
      const baseline = intIn(raw.baseline, 0, MAX_SAVED_NUMBER);
      const goal = intIn(raw.goal, 1, LARGEST_TIDY_GOAL);
      return task && round && baseline !== null && goal ? { kind: "tidy", id: "", path, task, round, baseline, goal } : null;
    }
    default:
      return null;
  }
}

/** A saved quest with only known, valid fields, or null when it is damaged (its id must match its contents). */
export function sanitizeQuestSpec(raw: unknown): QuestSpec | null {
  const record = asRecord(raw);
  const path = record && shortString(record.path, MAX_QUEST_PATH);
  const spec = record && path ? specFields(record, path) : null;
  if (!record || !spec) return null;
  const id = questId(spec);
  return record.id === id ? { ...spec, id } : null;
}

/** Valid specs from a list, without repeats. */
function specList(raw: unknown): QuestSpec[] {
  if (!Array.isArray(raw)) return [];
  const specs = raw.map(sanitizeQuestSpec).filter((spec): spec is QuestSpec => spec !== null);
  return specs.filter((spec, index) => specs.findIndex((other) => other.id === spec.id) === index);
}

/** Completed quest ids: unique strings of a sane length, the newest MAX_DONE_QUESTS. */
function doneList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= MAX_QUEST_ID);
  return [...new Set(ids)].slice(-MAX_DONE_QUESTS);
}

/** A repo's quest board, cleaned; undefined when the save has none (older saves). */
export function sanitizeRepoQuests(raw: unknown): RepoQuests | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;
  const active = specList(record.active);
  const specific = active.filter((spec) => spec.kind !== "tidy").slice(0, QUEST_BOARD_SIZE - 1);
  const tidy = active.find((spec) => spec.kind === "tidy");
  const recent = specList(record.recent).slice(-MAX_RECENT_QUESTS);
  // The next chore must get a fresh number, even if the counter itself was damaged.
  const rounds = [...active, ...recent].map((spec) => (spec.kind === "tidy" ? spec.round : 0));
  return {
    active: tidy ? [...specific, tidy] : specific,
    done: doneList(record.done),
    recent,
    tidyRounds: Math.max(count(record.tidyRounds), ...rounds),
  };
}

// ───────────────────────── Workshop record ─────────────────────────

function sanitizeCounts(raw: unknown): WorkshopCounts {
  const counts = asRecord(raw) ?? {};
  return {
    handPurified: count(counts.handPurified),
    bossesMended: count(counts.bossesMended),
    raisedToS: count(counts.raisedToS),
    questsDone: count(counts.questsDone),
    lanternsLit: count(counts.lanternsLit),
  };
}

/** The player's Workshop record, cleaned; undefined when the save has none (older saves). */
export function sanitizeWorkshop(raw: unknown): WorkshopProgress | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;
  const streak = count(record.streak);
  const achievements = Array.isArray(record.achievements) ? record.achievements.filter((id): id is string => typeof id === "string" && ACHIEVEMENT_IDS.has(id)) : [];
  return {
    streak,
    bestStreak: Math.max(streak, count(record.bestStreak)),
    lastForge: typeof record.lastForge === "string" && FINGERPRINT.test(record.lastForge) ? record.lastForge : "",
    counts: sanitizeCounts(record.counts),
    achievements: [...new Set(achievements)],
  };
}
