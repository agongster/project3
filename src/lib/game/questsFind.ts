/**
 * Every quest the code could offer right now, by kind, best first.
 *
 * Each list is sorted by a small "rank" (lower = nicer job for a player:
 * plain fixes before puzzling ones, public functions before private
 * helpers…) and, within a rank, by a fixed repo-specific shuffle (a hash of
 * the repo and the quest id). So the same repo always gets the same quests,
 * and two repos with similar code still get different ones.
 *
 * A candidate is only offered while its job is undone: a function that
 * already has a docstring is never a "document" candidate.
 */
import { GRADE_THRESHOLDS } from "@/lib/analysis/quality";
import { hashString } from "@/lib/rng";
import type { AnalyzedFile, Definition, Finding, Grade, RepoAnalysis } from "@/lib/types";
import {
  MAX_PURIFY_BUGS,
  MAX_QUEST_CODE,
  MAX_QUEST_MESSAGE,
  MAX_QUEST_NAME,
  MAX_QUEST_PATH,
  MAX_QUEST_RULE,
  MIN_GRADE_QUEST_LINES,
  findingLineText,
  questId,
  questText,
  repoSeed,
} from "./quests";
import type { DocumentQuestSpec, FixQuestSpec, GradeQuestSpec, PurifyQuestSpec, QuestKind, QuestSpec } from "./questsTypes";

/** The kinds that name one specific place in the code (everything but "tidy"). */
export type SpecificKind = Exclude<QuestKind, "tidy">;
export type SpecificQuestSpec = Exclude<QuestSpec, { kind: "tidy" }>;

/** The order kinds are tried in when the board is filled (see questsBoard.ts). */
export const SPECIFIC_KINDS: readonly SpecificKind[] = ["fix", "document", "grade", "purify"];

export interface Candidates {
  fix: FixQuestSpec[];
  document: DocumentQuestSpec[];
  grade: GradeQuestSpec[];
  purify: PurifyQuestSpec[];
}

/**
 * Rules whose fix is easy to say in a few plain words. These make the
 * friendliest "Fix it for real" quests, so they are offered first; the same
 * words start the quest's title (see questsCheck.ts).
 */
export const PLAIN_FIXES: Readonly<Record<string, string>> = {
  F401: "Remove the unused import",
  F841: "Remove the unused variable",
  F541: "Drop the needless f-string",
  F632: "Use == instead of `is`",
  F811: "Remove the repeated definition",
  E711: "Compare to None with `is`",
  E712: "Drop the comparison to True/False",
  E721: "Use isinstance() for the type check",
  E731: "Turn the lambda into a def",
  ERA001: "Delete the commented-out code",
  FIX001: "Resolve the FIXME",
  FIX002: "Resolve the TODO",
  FIX003: "Resolve the XXX note",
  FIX004: "Resolve the HACK note",
  SIM118: "Drop the needless .keys()",
  PLW0133: "Raise the exception that is only created",
  B006: "Replace the mutable default argument",
  B007: "Rename the unused loop variable to _",
  B018: "Remove the useless expression",
};

/** Grade candidates are ranked in steps of this many missing points (closest to the next grade first). */
const GRADE_GAP_STEP = 10;

/** The next better grade (S stays S). */
export function nextGrade(grade: Grade): Grade {
  const index = GRADE_THRESHOLDS.findIndex((threshold) => threshold.grade === grade);
  return GRADE_THRESHOLDS[Math.max(0, index - 1)].grade;
}

/** The score a file needs for `grade`. */
export function minScoreFor(grade: Grade): number {
  return GRADE_THRESHOLDS.find((threshold) => threshold.grade === grade)?.minScore ?? 0;
}

/** Files quests can be about: downloaded, analyzed, and with a path short enough to keep in the save. */
export function questableFiles(analysis: RepoAnalysis): AnalyzedFile[] {
  return analysis.files.filter((file) => file.status === "ok" && file.path.length <= MAX_QUEST_PATH);
}

/** Sorts by rank, then by the repo's own shuffle. */
function byRankThenShuffle<T extends { id: string }>(seed: string, items: { spec: T; rank: number }[]): T[] {
  const order = (spec: T) => hashString(`${seed}:${spec.id}`);
  return items.sort((a, b) => a.rank - b.rank || order(a.spec) - order(b.spec)).map((item) => item.spec);
}

// ───────────────────────────── Fix ─────────────────────────────

function fixSpec(finding: Finding): FixQuestSpec {
  const spec: FixQuestSpec = {
    kind: "fix",
    id: "",
    path: finding.path,
    code: finding.code,
    rule: questText(finding.title, MAX_QUEST_RULE),
    message: questText(finding.message, MAX_QUEST_MESSAGE),
    lineText: findingLineText(finding),
    line: finding.line,
    monster: finding.monster,
  };
  return { ...spec, id: questId(spec) };
}

/**
 * Plain fixes first. Files whose dungeon dropped some findings (`overflow`)
 * come last: there a new bug could push the target out of sight and make
 * it look fixed.
 */
function fixCandidates(files: readonly AnalyzedFile[], seed: string): FixQuestSpec[] {
  const ranked = files.flatMap((file) =>
    file.findings
      .filter((finding) => finding.code.length <= MAX_QUEST_CODE)
      .map((finding) => ({
        spec: fixSpec(finding),
        rank: (Object.hasOwn(PLAIN_FIXES, finding.code) ? 0 : 1) + (file.overflow > 0 ? 2 : 0),
      })),
  );
  return byRankThenShuffle(seed, ranked);
}

// ─────────────────────────── Document ───────────────────────────

/** The last part of a dotted name: "Trainer.fit" → "fit". */
function shortName(name: string): string {
  return name.slice(name.lastIndexOf(".") + 1);
}

/** `__init__`, `__repr__`…: Python's special methods rarely need a docstring of their own. */
export function isSpecialMethod(name: string): boolean {
  const last = shortName(name);
  return last.startsWith("__") && last.endsWith("__");
}

/** Public functions first; private helpers (`_x`) and tests (`test_x`) after them. */
function documentRank(definition: Definition): number {
  const last = shortName(definition.name);
  return last.startsWith("_") || last.startsWith("test") ? 1 : 0;
}

function documentCandidates(files: readonly AnalyzedFile[], seed: string): DocumentQuestSpec[] {
  const ranked = files.flatMap((file) =>
    file.outline.definitions
      .filter((d) => d.docstring === null && !isSpecialMethod(d.name) && d.name.length <= MAX_QUEST_NAME)
      .map((definition) => {
        const spec: DocumentQuestSpec = {
          kind: "document",
          id: "",
          path: file.path,
          name: definition.name,
          defKind: definition.kind,
          line: definition.line,
        };
        return { spec: { ...spec, id: questId(spec) }, rank: documentRank(definition) };
      }),
  );
  return byRankThenShuffle(seed, ranked);
}

// ───────────────────────────── Grade ─────────────────────────────

/** Files below S that are long enough to improve; the closest to their next grade first. */
function gradeCandidates(files: readonly AnalyzedFile[], seed: string): GradeQuestSpec[] {
  const ranked = files
    .filter((file) => file.quality.grade !== "S" && file.lineCount >= MIN_GRADE_QUEST_LINES)
    .map((file) => {
      const to = nextGrade(file.quality.grade);
      const spec: GradeQuestSpec = { kind: "grade", id: "", path: file.path, from: file.quality.grade, to };
      const gap = Math.max(0, minScoreFor(to) - file.quality.score);
      return { spec: { ...spec, id: questId(spec) }, rank: Math.floor(gap / GRADE_GAP_STEP) };
    });
  return byRankThenShuffle(seed, ranked);
}

// ──────────────────────────── Purify ────────────────────────────

/** Every finding the file really has, including the ones its dungeon had no room for. */
export function bugCount(file: AnalyzedFile): number {
  return file.findings.length + file.overflow;
}

/**
 * Small buggy files, the fewest bugs first, except that one-bug files come
 * last: purifying those is just a "Fix it for real" quest under another name.
 */
function purifyCandidates(files: readonly AnalyzedFile[], seed: string): PurifyQuestSpec[] {
  const ranked = files
    .filter((file) => bugCount(file) > 0 && bugCount(file) <= MAX_PURIFY_BUGS)
    .map((file) => {
      const bugs = bugCount(file);
      const spec: PurifyQuestSpec = { kind: "purify", id: "", path: file.path, bugs };
      return { spec: { ...spec, id: questId(spec) }, rank: bugs === 1 ? MAX_PURIFY_BUGS + 1 : bugs };
    });
  return byRankThenShuffle(seed, ranked);
}

// ───────────────────────────── All ─────────────────────────────

/** Every specific quest the code offers right now, each kind's list best first. */
export function findCandidates(analysis: RepoAnalysis): Candidates {
  const files = questableFiles(analysis);
  const seed = repoSeed(analysis);
  return {
    fix: fixCandidates(files, seed),
    document: documentCandidates(files, seed),
    grade: gradeCandidates(files, seed),
    purify: purifyCandidates(files, seed),
  };
}
