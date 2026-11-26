/**
 * Pretend forges for the quest test page (/dev/quests): each function returns
 * the analysis as it would be after an edit, and the ForgeReport the
 * workspace would hand in, without running the editor or the linter.
 * The real thing is src/lib/workspace/; these are only consistent enough to
 * move quests, the streak and achievements the way real edits do.
 */
import { gradeFor, MONSTER_PENALTY } from "@/lib/analysis/quality";
import { checkQuest } from "@/lib/game/questsCheck";
import type { QuestSpec } from "@/lib/game/questsTypes";
import type { AnalyzedFile, Finding, RepoAnalysis, RepoProgress } from "@/lib/types";
import type { ForgeReport } from "@/lib/workspace/contract";

export interface Forged {
  analysis: RepoAnalysis;
  report: ForgeReport;
}

/** Score points a docstring is worth in this pretend world (roughly what the grader gives). */
const DOCSTRING_POINTS = 4;
/** Score points a comment is worth in this pretend world. */
const COMMENT_POINTS = 1;

function replaceFile(analysis: RepoAnalysis, file: AnalyzedFile): RepoAnalysis {
  return { ...analysis, files: analysis.files.map((f) => (f.path === file.path ? file : f)) };
}

function withScore(file: AnalyzedFile, score: number): AnalyzedFile {
  const clamped = Math.max(0, Math.min(100, score));
  return { ...file, quality: { ...file.quality, score: clamped, grade: gradeFor(clamped) } };
}

/** The report a forge of `before` into `after` would give. */
function reportFor(before: AnalyzedFile, after: AnalyzedFile, fixed: Finding[], introduced: Finding[]): ForgeReport {
  return {
    path: after.path,
    linted: true,
    fixed,
    introduced,
    kept: after.findings.filter((f) => !introduced.includes(f)).map((f) => ({ before: f, after: f })),
    before: { grade: before.quality.grade, score: before.quality.score, findingCount: before.findings.length },
    after: { grade: after.quality.grade, score: after.quality.score, findingCount: after.findings.length },
    purified: before.findings.length > 0 && after.findings.length === 0,
    file: after,
  };
}

/** Fixes `findings` (all in one file) for real: they leave the file and the score climbs. */
export function fixFindings(analysis: RepoAnalysis, path: string, findings: readonly Finding[]): Forged {
  const before = analysis.files.find((f) => f.path === path)!;
  const ids = new Set(findings.map((f) => f.id));
  const fixed = before.findings.filter((f) => ids.has(f.id));
  const after = withScore(
    {
      ...before,
      findings: before.findings.filter((f) => !ids.has(f.id)),
      realFixes: (before.realFixes ?? 0) + fixed.length,
      fixedFindings: [...(before.fixedFindings ?? []), ...fixed],
    },
    before.quality.score + MONSTER_PENALTY * fixed.length,
  );
  return { analysis: replaceFile(analysis, after), report: reportFor(before, after, fixed, []) };
}

/** A clean forge: fixes the first bug of the first buggy file. Null when the repo is spotless. */
export function fixAnyBug(analysis: RepoAnalysis): Forged | null {
  const file = analysis.files.find((f) => f.findings.length > 0);
  return file ? fixFindings(analysis, file.path, [file.findings[0]]) : null;
}

/** A forge that adds a new bug (an unused import at the top of the first file). */
export function addBug(analysis: RepoAnalysis, serial: number): Forged {
  const before = analysis.files[0];
  const bug: Finding = {
    id: `${before.path}:1:1:F401#${serial}`,
    path: before.path,
    code: "F401",
    title: "Unused import",
    message: `\`helper${serial}\` imported but unused`,
    line: 1,
    col: 1,
    endLine: 1,
    endCol: 20,
    severity: "minion",
    category: "unused",
    monster: "dustBunny",
    snippet: [{ n: 1, text: `import helper${serial}`, hit: true }],
    tip: "Delete the import.",
  };
  const after = withScore({ ...before, findings: [bug, ...before.findings] }, before.quality.score - MONSTER_PENALTY);
  return { analysis: replaceFile(analysis, after), report: reportFor(before, after, [], [bug]) };
}

/** Gives the first `count` undocumented definitions (only those named `name`, if given) a docstring. */
function addDocstrings(analysis: RepoAnalysis, path: string, count: number, name?: string): Forged {
  const before = analysis.files.find((f) => f.path === path)!;
  let left = count;
  const definitions = before.outline.definitions.map((d) => {
    if (left === 0 || d.docstring !== null || (name !== undefined && d.name !== name)) return d;
    left--;
    return { ...d, docstring: "Written in the Workshop." };
  });
  const after = withScore({ ...before, outline: { ...before.outline, definitions } }, before.quality.score + DOCSTRING_POINTS * (count - left));
  return { analysis: replaceFile(analysis, after), report: reportFor(before, after, [], []) };
}

function addComment(analysis: RepoAnalysis, path: string): Forged {
  const before = analysis.files.find((f) => f.path === path)!;
  const comments = [...before.outline.comments, { line: 1, text: "Explains what this file is for." }];
  const after = withScore({ ...before, outline: { ...before.outline, comments } }, before.quality.score + COMMENT_POINTS);
  return { analysis: replaceFile(analysis, after), report: reportFor(before, after, [], []) };
}

function raiseScore(analysis: RepoAnalysis, path: string, score: number): Forged {
  const before = analysis.files.find((f) => f.path === path)!;
  const after = withScore(before, score);
  return { analysis: replaceFile(analysis, after), report: reportFor(before, after, [], []) };
}

/** The finding ids a "squash monsters" chore still needs, for the page to mark as defeated. */
export function monstersToSquash(analysis: RepoAnalysis, progress: RepoProgress, count: number): Finding[] {
  const defeated = new Set(progress.defeated);
  return analysis.files.flatMap((f) => f.findings).filter((f) => !defeated.has(f.id)).slice(0, count);
}

/**
 * Does whatever finishes `spec`: the forge that completes it, or (for the
 * squash chore) null, meaning "defeat monsters instead".
 */
export function finishQuest(analysis: RepoAnalysis, progress: RepoProgress, spec: QuestSpec): Forged | null {
  const check = checkQuest(spec, analysis, progress);
  const missing = Math.max(1, (check.goal ?? 1) - (check.current ?? 0));
  switch (spec.kind) {
    case "fix": {
      const file = analysis.files.find((f) => f.path === spec.path)!;
      const bug = file.findings.find((f) => f.code === spec.code && f.line === check.target.line) ?? file.findings[0];
      return fixFindings(analysis, spec.path, [bug]);
    }
    case "document":
      return addDocstrings(analysis, spec.path, 1, spec.name);
    case "grade":
      return raiseScore(analysis, spec.path, check.goal ?? 100);
    case "purify":
      return fixFindings(analysis, spec.path, analysis.files.find((f) => f.path === spec.path)!.findings);
    case "tidy":
      switch (spec.task) {
        case "fixAny": {
          const file = analysis.files.find((f) => f.findings.length >= missing) ?? analysis.files.find((f) => f.findings.length > 0)!;
          return fixFindings(analysis, file.path, file.findings.slice(0, missing));
        }
        case "documentAny": {
          const file = analysis.files.find((f) => f.outline.definitions.some((d) => d.docstring === null))!;
          return addDocstrings(analysis, file.path, missing);
        }
        case "comment":
          return addComment(analysis, spec.path);
        case "squash":
          return null;
      }
  }
}
