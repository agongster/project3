/**
 * The pure core of the analysis pipeline: source text in, RepoAnalysis out.
 *
 * It never touches the network, the DOM or a Web Worker. The caller hands in
 * the file contents and a synchronous `lint` function, which is why the very
 * same code runs in the browser (src/lib/workspace, demo.ts) and in Vitest
 * (with Ruff's Node.js build).
 */
import { emptyOutline, outlineSource } from "./outline";
import type { AnalyzedFile, FileQuality, Finding, RepoAnalysis, RepoRef, RepoStats } from "@/lib/types";
import { classifyFile } from "./fileKind";
import { buildFinding, fullFindingList, normalizeDiagnostic, selectMonsters, splitLines, type LintFix, type LintHit, type RawDiagnostic } from "./normalize";
import { gradeFile } from "./quality";
import { isIgnoredForFile, isProbeRule } from "./rules";

/** Everything about the repo that is not per-file. */
export interface AnalysisMeta {
  repo: RepoRef;
  description: string | null;
  stars: number;
  demo: boolean;
  /** Warnings collected so far (e.g. "Showing the first 150 files"). */
  warnings: string[];
  /** The README's blurb (see readme.ts), or null when there is none. */
  readme?: string | null;
}

/** One file to analyze. `source` is null when it could not be downloaded. */
export interface SourceFile {
  path: string;
  size: number;
  source: string | null;
}

/** Lints one file's source text and returns Ruff's raw diagnostics. */
export type LintFunction = (source: string) => RawDiagnostic[];

/** Analyzes every file and adds up the repo statistics. */
export function analyzeSources(meta: AnalysisMeta, files: readonly SourceFile[], lint: LintFunction): RepoAnalysis {
  const analyzed = files.map((file) => analyzeFile(file, lint));
  const lintFailures = analyzed.filter((file, i) => file.status === "failed" && files[i].source !== null).length;
  return assembleAnalysis(meta, analyzed, lintFailures);
}

/**
 * Puts analyzed files together into a RepoAnalysis: adds up the statistics
 * and warns about files that were downloaded but couldn't be linted.
 */
export function assembleAnalysis(meta: AnalysisMeta, files: AnalyzedFile[], lintFailures: number): RepoAnalysis {
  const warnings = [...meta.warnings];
  if (lintFailures > 0) {
    warnings.push(`${plural(lintFailures, "file")} couldn't be analyzed and appear as ruins.`);
  }

  return {
    repo: meta.repo,
    description: meta.description,
    stars: meta.stars,
    files,
    stats: computeStats(files),
    warnings,
    demo: meta.demo,
    readme: meta.readme ?? null,
  };
}

/**
 * Analyzes one file: lint it, split the hits into monsters and quality
 * probes, pick which monsters fit in the dungeon, and grade the code.
 * A file that can't be downloaded or linted becomes a "failed" ruin.
 */
export function analyzeFile(file: SourceFile, lint: LintFunction): AnalyzedFile {
  return inspectFile(file, lint).file;
}

/** One file analyzed, plus what the dungeon leaves out (the Workshop needs it). */
export interface FileInspection {
  /** The file as the world sees it (capped monsters). */
  file: AnalyzedFile;
  /** Every finding, uncapped, in line order (see `fullFindingList`). Empty for a failed file. */
  findings: Finding[];
  /** The fix Ruff offers for a finding of `findings`, looked up by the finding object itself. */
  fixes: ReadonlyMap<Finding, LintFix>;
}

/** Like `analyzeFile`, but also returns the full finding list and Ruff's fixes. */
export function inspectFile(file: SourceFile, lint: LintFunction): FileInspection {
  const kind = classifyFile(file.path, file.source);
  const failed: FileInspection = { file: failedFile(file, kind), findings: [], fixes: new Map() };
  if (file.source === null) return failed;

  let hits: LintHit[];
  try {
    hits = lint(file.source).map(normalizeDiagnostic);
  } catch {
    return failed;
  }

  const lines = splitLines(file.source);
  const probeHits = hits.filter((hit) => isProbeRule(hit.code));
  const monsterHits = hits.filter((hit) => !isProbeRule(hit.code) && !isIgnoredForFile(hit.code, kind));
  const fixes = new Map<Finding, LintFix>();
  const allFindings = monsterHits.map((hit) => {
    const finding = buildFinding(file.path, hit, lines);
    if (hit.fix) fixes.set(finding, hit.fix);
    return finding;
  });
  const { findings, overflow } = selectMonsters(allFindings);

  const analyzed: AnalyzedFile = {
    path: file.path,
    size: file.size,
    lineCount: countLines(file.source),
    status: "ok",
    kind,
    findings,
    overflow,
    quality: gradeFile(file.source, probeHits, allFindings.length),
    outline: outlineSource(file.source),
  };
  return { file: analyzed, findings: fullFindingList(allFindings), fixes };
}

/** Number of lines, not counting the empty "line" after a final newline. */
export function countLines(source: string): number {
  if (source === "") return 0;
  const lines = splitLines(source);
  return lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
}

const NO_QUALITY: FileQuality = {
  score: 0,
  grade: "C",
  highlights: [],
  metrics: { definitions: 0, docCoverage: 0, hintCoverage: 0, commentRatio: 0, probeHits: 0 },
};

function failedFile(file: SourceFile, kind: AnalyzedFile["kind"]): AnalyzedFile {
  return { path: file.path, size: file.size, lineCount: 0, status: "failed", kind, findings: [], overflow: 0, quality: NO_QUALITY, outline: emptyOutline() };
}

/** Repo-wide totals. Counts only the monsters that actually appear in dungeons. */
export function computeStats(files: readonly AnalyzedFile[]): RepoStats {
  const stats: RepoStats = {
    fileCount: files.length,
    lineCount: 0,
    findingCount: 0,
    bySeverity: { minion: 0, elite: 0, boss: 0 },
    cleanFiles: 0,
    buggyFiles: 0,
  };
  for (const file of files) {
    stats.lineCount += file.lineCount;
    stats.findingCount += file.findings.length;
    for (const finding of file.findings) stats.bySeverity[finding.severity]++;
    if (file.findings.length > 0) stats.buggyFiles++;
    else if (file.status === "ok") stats.cleanFiles++;
  }
  return stats;
}

/** "1 file" / "3 files". */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
