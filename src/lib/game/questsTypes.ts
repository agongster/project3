/**
 * The shapes the Workshop's quests, forge streak and achievements keep in
 * the save file. Types only (src/lib/types.ts imports them for SaveData);
 * the rules are in quests.ts, questsCheck.ts, questsSettle.ts and
 * achievements.ts, and questsSave.ts cleans them when a save is loaded.
 *
 * A quest is saved as a *spec*: just enough to show it and to check it
 * later against whatever the code looks like by then. Its title, reward and
 * progress are worked out again every time (see questsCheck.ts), so
 * re-tuning a reward applies to every existing save.
 */
import type { Definition, Grade, MonsterKind } from "@/lib/types";

/**
 * The five kinds of quest:
 *   fix       fix one specific finding by editing the code
 *   document  give one specific function or class a docstring ("light the lantern")
 *   grade     lift one specific file's grade by one letter
 *   purify    clear every finding in one small file by editing
 *   tidy      a general chore that exists even in a spotless repo
 */
export type QuestKind = "fix" | "document" | "grade" | "purify" | "tidy";

/** The chores a tidy-up quest can ask for (see TIDY_TASKS in quests.ts). */
export type TidyTask = "fixAny" | "documentAny" | "squash" | "comment";

interface QuestSpecBase {
  /** Stable id built from the target (see `questId`), never from a line number. */
  id: string;
  /** The file the quest is about (for "any file" chores: a suggested file). */
  path: string;
}

/** Fix one finding. It is recognised by what it says and where, not by its line number. */
export interface FixQuestSpec extends QuestSpecBase {
  kind: "fix";
  /** Ruff rule code, e.g. "F401". */
  code: string;
  /** The rule's short title, e.g. "Unused import". */
  rule: string;
  /** Ruff's message, e.g. "`os` imported but unused". */
  message: string;
  /** The line of code the finding pointed at, trimmed. Survives lines moving up or down. */
  lineText: string;
  /** Line number when the quest was posted (only a hint for "go there"). */
  line: number;
  /** Its monster, for the quest's icon. */
  monster: MonsterKind;
}

/** Give one function, method or class a docstring. */
export interface DocumentQuestSpec extends QuestSpecBase {
  kind: "document";
  /** "load_data", or "Trainer.fit" for a method. */
  name: string;
  defKind: Definition["kind"];
  /** Line of the `def` when the quest was posted (only a hint for "go there"). */
  line: number;
}

/** Lift a file from one grade to the next. */
export interface GradeQuestSpec extends QuestSpecBase {
  kind: "grade";
  from: Grade;
  to: Grade;
}

/** Fix every finding in one file by editing. */
export interface PurifyQuestSpec extends QuestSpecBase {
  kind: "purify";
  /** Findings in the file when the quest was posted (the progress bar's goal). */
  bugs: number;
}

/** A general chore, posted again and again so the board is never empty. */
export interface TidyQuestSpec extends QuestSpecBase {
  kind: "tidy";
  task: TidyTask;
  /** 1 for the first tidy-up quest in a repo, 2 for the next… (makes each id unique). */
  round: number;
  /** The measured number when the quest was posted (see `tidyMeasure`). */
  baseline: number;
  /** How far above the baseline the number must climb. */
  goal: number;
}

export type QuestSpec = FixQuestSpec | DocumentQuestSpec | GradeQuestSpec | PurifyQuestSpec | TidyQuestSpec;

/** One repo's quest board, kept in `RepoProgress.quests`. */
export interface RepoQuests {
  /** The quests on the board right now, in board order. */
  active: QuestSpec[];
  /** Ids of every quest completed in this repo: each pays once and is never posted again. */
  done: string[];
  /** The last few completed quests, oldest first, shown checked off under the board. */
  recent: QuestSpec[];
  /** How many tidy-up quests have been posted here (numbers the next one). */
  tidyRounds: number;
}

/**
 * Lifetime counts the achievements read (all only ever go up). Real fixes
 * themselves are counted by `applyForge` in `SaveData.stats.realFixes`.
 */
export interface WorkshopCounts {
  /** Files whose last finding was fixed in the editor. */
  handPurified: number;
  /** Bosses whose code was fixed before anyone fought them. */
  bossesMended: number;
  /** Forges that lifted a file to grade S. */
  raisedToS: number;
  /** Quests completed, in any repo. */
  questsDone: number;
  /** "Light the lantern" quests completed. */
  lanternsLit: number;
}

/** The player's Workshop record, shared by every repo: kept in `SaveData.workshop`. */
export interface WorkshopProgress {
  /** Clean forges in a row right now: each fixed at least one finding and introduced none. */
  streak: number;
  /** The longest streak ever. */
  bestStreak: number;
  /** Fingerprint of the last forge report counted, so counting the same report twice does nothing. */
  lastForge: string;
  counts: WorkshopCounts;
  /** Ids of earned achievements, in the order they were earned. */
  achievements: string[];
}
