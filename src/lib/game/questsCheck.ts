/**
 * Checking a quest against the code as it is *now*.
 *
 * `checkQuest` is a pure test: it reads the current analysis (and, for the
 * monster-squashing chore, the repo progress) and says whether the quest is
 *   open  still to do,
 *   done  its job is finished ("this function now has a docstring"),
 *   gone  its target no longer exists (the function was renamed or deleted,
 *         or the chore can no longer be finished), so it is quietly replaced.
 * Nothing is remembered between checks, so a reload can't confuse it, and
 * shifting line numbers can't either: targets are found by name, rule,
 * message and line text, never by line number.
 *
 * One exception keeps it honest: while a file has a syntax error, Ruff can't
 * see its other bugs at all, so their absence proves nothing. A "Fix it for
 * real" or "Raise the grade" quest about such a file waits until the syntax
 * error is mended (breaking the code never counts as fixing it).
 *
 * `describeQuest` turns a saved spec plus its check into what the board shows.
 */
import { MAX_OUTLINE_COMMENTS } from "@/lib/analysis/outline";
import { SYNTAX_CODE } from "@/lib/analysis/rules";
import { clipPath } from "@/lib/analysis/repoText";
import type { AnalyzedFile, Definition, RepoAnalysis, RepoProgress } from "@/lib/types";
import { QUEST_REWARDS, isSameBug } from "./quests";
import type { Quest, QuestTarget } from "./quests";
import { PLAIN_FIXES, bugCount, isSpecialMethod, minScoreFor, questableFiles } from "./questsFind";
import type { QuestSpec, TidyQuestSpec, TidyTask } from "./questsTypes";

/** File paths in quest titles are clipped (from the left) to this many characters. */
export const TITLE_PATH_CHARS = 40;

export type QuestState = "open" | "done" | "gone";

export interface QuestCheck {
  state: QuestState;
  /** Where "go there" leads right now. */
  target: QuestTarget;
  /** Steps done so far and steps needed, for quests that have steps. */
  current?: number;
  goal?: number;
  /** Grade quests: the file's score right now. */
  score?: number;
}

/** Definitions the "any docstring" chore counts: like the "document" quests, it skips `__init__` and friends. */
function documentable(file: AnalyzedFile): Definition[] {
  return file.outline.definitions.filter((definition) => !isSpecialMethod(definition.name));
}

/** Grades from best to worst, so a smaller index is a better grade. */
const GRADE_ORDER = ["S", "A", "B", "C"] as const;

function fileAt(analysis: RepoAnalysis, path: string): AnalyzedFile | null {
  return questableFiles(analysis).find((file) => file.path === path) ?? null;
}

const gone = (path: string): QuestCheck => ({ state: "gone", target: { path } });

/** True while Ruff can't read the file: then the absence of a bug proves nothing (see the top of this file). */
function hasSyntaxError(file: AnalyzedFile): boolean {
  return file.findings.some((finding) => finding.code === SYNTAX_CODE);
}

// ───────────────────────── Tidy-up chores ─────────────────────────

/**
 * The number a tidy-up chore watches, measured now. The chore is done once
 * it has climbed `goal` above the number measured when it was posted.
 * Null when it can't be measured any more (the chore's file is gone).
 */
export function tidyMeasure(task: TidyTask, path: string, analysis: RepoAnalysis, progress: RepoProgress): number | null {
  const files = questableFiles(analysis);
  switch (task) {
    case "fixAny":
      return files.reduce((sum, file) => sum + (file.realFixes ?? 0), 0);
    case "documentAny":
      return files.reduce((sum, file) => sum + documentable(file).filter((d) => d.docstring !== null).length, 0);
    case "squash": {
      const defeated = new Set(progress.defeated);
      return files.reduce((sum, file) => sum + file.findings.filter((f) => defeated.has(f.id)).length, 0);
    }
    case "comment": {
      const file = fileAt(analysis, path);
      return file ? file.outline.comments.length : null;
    }
  }
}

/** How many more steps the code still allows: bugs left to fix, functions left to document… */
export function tidyRoom(task: TidyTask, path: string, analysis: RepoAnalysis, progress: RepoProgress): number {
  const files = questableFiles(analysis);
  switch (task) {
    case "fixAny":
      return files.reduce((sum, file) => sum + bugCount(file), 0);
    case "documentAny":
      return files.reduce((sum, file) => sum + documentable(file).filter((d) => d.docstring === null).length, 0);
    case "squash": {
      const defeated = new Set(progress.defeated);
      return files.reduce((sum, file) => sum + file.findings.filter((f) => !defeated.has(f.id)).length, 0);
    }
    case "comment": {
      const file = fileAt(analysis, path);
      return file ? Math.max(0, MAX_OUTLINE_COMMENTS - file.outline.comments.length) : 0;
    }
  }
}

/** A good file to start an "anywhere" chore in: the first that still has something to do. */
function suggestedPath(spec: TidyQuestSpec, analysis: RepoAnalysis, progress: RepoProgress): string {
  const files = questableFiles(analysis);
  const defeated = new Set(progress.defeated);
  const hasWork = (file: AnalyzedFile): boolean => {
    switch (spec.task) {
      case "fixAny":
        return bugCount(file) > 0;
      case "documentAny":
        return documentable(file).some((d) => d.docstring === null);
      case "squash":
        return file.findings.some((f) => !defeated.has(f.id));
      case "comment":
        return file.path === spec.path;
    }
  };
  return files.find(hasWork)?.path ?? spec.path;
}

function checkTidy(spec: TidyQuestSpec, analysis: RepoAnalysis, progress: RepoProgress): QuestCheck {
  const measure = tidyMeasure(spec.task, spec.path, analysis, progress);
  if (measure === null) return gone(spec.path);
  const current = Math.min(spec.goal, Math.max(0, measure - spec.baseline));
  const target = { path: suggestedPath(spec, analysis, progress) };
  if (current >= spec.goal) return { state: "done", target, current, goal: spec.goal };
  const stillPossible = tidyRoom(spec.task, spec.path, analysis, progress) >= spec.goal - current;
  return { state: stillPossible ? "open" : "gone", target, current, goal: spec.goal };
}

// ─────────────────────────── Checking ───────────────────────────

/** Is the quest open, done or gone, judged only from the code as it is now (and the repo progress)? */
export function checkQuest(spec: QuestSpec, analysis: RepoAnalysis, progress: RepoProgress): QuestCheck {
  if (spec.kind === "tidy") return checkTidy(spec, analysis, progress);
  const file = fileAt(analysis, spec.path);
  if (!file) return gone(spec.path);

  switch (spec.kind) {
    case "fix": {
      const bug = file.findings.find((finding) => isSameBug(spec, finding));
      const hidden = spec.code !== SYNTAX_CODE && hasSyntaxError(file);
      return { state: bug || hidden ? "open" : "done", target: { path: spec.path, line: bug?.line ?? spec.line } };
    }
    case "document": {
      const matches = file.outline.definitions.filter((definition) => definition.name === spec.name);
      if (matches.length === 0) return gone(spec.path);
      const documented = matches.every((definition) => definition.docstring !== null);
      return { state: documented ? "done" : "open", target: { path: spec.path, line: matches[0].line, name: spec.name } };
    }
    case "grade": {
      const reached = GRADE_ORDER.indexOf(file.quality.grade) <= GRADE_ORDER.indexOf(spec.to) && !hasSyntaxError(file);
      const goal = minScoreFor(spec.to);
      const current = Math.min(goal, file.quality.score);
      return { state: reached ? "done" : "open", target: { path: spec.path }, current, goal, score: file.quality.score };
    }
    case "purify": {
      const left = bugCount(file);
      const current = Math.max(0, spec.bugs - left);
      return { state: left === 0 ? "done" : "open", target: { path: spec.path, line: file.findings[0]?.line }, current, goal: spec.bugs };
    }
  }
}

// ─────────────────────────── Describing ───────────────────────────

/** "Fix any bug" / "Fix any 2 bugs". */
function counted(goal: number, one: string, many: string): string {
  return goal === 1 ? one : many.replace("#", String(goal));
}

function titleOf(spec: QuestSpec, check: QuestCheck): string {
  const where = clipPath(spec.path, TITLE_PATH_CHARS);
  switch (spec.kind) {
    case "fix": {
      const action = Object.hasOwn(PLAIN_FIXES, spec.code) ? PLAIN_FIXES[spec.code] : `Fix "${spec.rule}"`;
      return `${action} at line ${check.target.line ?? spec.line} of ${where}`;
    }
    case "document":
      return spec.defKind === "class" ? `Document class ${spec.name} in ${where}` : `Document ${spec.name}() in ${where}`;
    case "grade":
      return `Raise ${where} from ${spec.from} to ${spec.to}`;
    case "purify":
      return `Purify ${where} by hand`;
    case "tidy":
      switch (spec.task) {
        case "fixAny":
          return counted(spec.goal, "Fix any bug for real", "Fix any # bugs for real");
        case "documentAny":
          return counted(spec.goal, "Give any function a docstring", "Give any # functions a docstring");
        case "squash":
          return counted(spec.goal, "Squash a monster", "Squash # monsters");
        case "comment":
          return `Leave a note in ${where}`;
      }
  }
}

function descriptionOf(spec: QuestSpec, check: QuestCheck): string {
  switch (spec.kind) {
    case "fix":
      return spec.message;
    case "document":
      return "Give it a docstring and its dungeon room lights up.";
    case "grade": {
      const goal = minScoreFor(spec.to);
      return check.score === undefined
        ? `Reach a score of ${goal}.`
        : `Reach a score of ${goal} (now ${check.score}): docstrings, type hints and fewer bugs all help.`;
    }
    case "purify":
      return spec.bugs === 1 ? "Fix its last bug in the editor: no sword needed." : `Fix all ${spec.bugs} of its bugs in the editor: no sword needed.`;
    case "tidy":
      switch (spec.task) {
        case "fixAny":
          return "Any file will do: edit a bug away and forge.";
        case "documentAny":
          return "Anywhere in the repo. Every docstring lights a lantern.";
        case "squash":
          return "Fighting counts too! Any dungeon will do.";
        case "comment":
          return "Add a helpful # comment on a line of its own, then forge.";
      }
  }
}

/** What the board shows for a quest. */
export function describeQuest(spec: QuestSpec, check: QuestCheck): Quest {
  const hasSteps = check.current !== undefined && check.goal !== undefined;
  return {
    id: spec.id,
    kind: spec.kind,
    title: titleOf(spec, check),
    description: descriptionOf(spec, check),
    target: check.target,
    reward: QUEST_REWARDS[spec.kind],
    progress: {
      done: check.state === "done",
      ...(hasSteps && { current: check.state === "done" ? check.goal : check.current, goal: check.goal }),
    },
    ...(spec.kind === "fix" && { monster: spec.monster }),
  };
}

/** A completed quest, described without looking at the code (it may have changed since). */
export function describeCompleted(spec: QuestSpec): Quest {
  const goal = spec.kind === "tidy" ? spec.goal : spec.kind === "purify" ? spec.bugs : undefined;
  const line = spec.kind === "fix" || spec.kind === "document" ? spec.line : undefined;
  return describeQuest(spec, { state: "done", target: { path: spec.path, ...(line && { line }) }, current: goal, goal });
}
