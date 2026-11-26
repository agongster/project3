/**
 * The pure core of the analysis pipeline: source text in, RepoAnalysis out.
 *
 * It never touches the network, the DOM or a Web Worker. The caller hands in
 * the file contents and a synchronous `lint` function, which is why the very
 * same code runs in the browser (analyzeRepo.ts, demo.ts) and in Vitest
 * (with Ruff's Node.js build).
 */
import { emptyOutline, outlineSource } from "./outline";
import type { AnalyzedFile, FileQuality, RepoAnalysis, RepoRef, RepoStats } from "@/lib/types";
import { classifyFile } from "./fileKind";
import { buildFinding, normalizeDiagnostic, selectMonsters, splitLines, type LintHit, type RawDiagnostic } from "./normalize";
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

  const warnings = [...meta.warnings];
  const lintFailures = analyzed.filter((file, i) => file.status === "failed" && files[i].source !== null).length;
  if (lintFailures > 0) {
    warnings.push(`${plural(lintFailures, "file")} couldn't be analyzed and appear as ruins.`);
  }

  return {
    repo: meta.repo,
    description: meta.description,
    stars: meta.stars,
    files: analyzed,
    stats: computeStats(analyzed),
    warnings,
    demo: meta.demo,
  };
}

/**
 * Analyzes one file: lint it, split the hits into monsters and quality
 * probes, pick which monsters fit in the dungeon, and grade the code.
 * A file that can't be downloaded or linted becomes a "failed" ruin.
 */
export function analyzeFile(file: SourceFile, lint: LintFunction): AnalyzedFile {
  const kind = classifyFile(file.path, file.source);
  if (file.source === null) return failedFile(file, kind);

  let hits: LintHit[];
  try {
    hits = lint(file.source).map(normalizeDiagnostic);
  } catch {
    return failedFile(file, kind);
  }

  const lines = splitLines(file.source);
  const probeHits = hits.filter((hit) => isProbeRule(hit.code));
  const monsterHits = hits.filter((hit) => !isProbeRule(hit.code) && !isIgnoredForFile(hit.code, kind));
  const allFindings = monsterHits.map((hit) => buildFinding(file.path, hit, lines));
  const { findings, overflow } = selectMonsters(allFindings);

  return {
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
