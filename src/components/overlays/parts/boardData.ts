/**
 * Numbers behind the notice board (repo statistics), computed from the
 * analysis and the player's progress. Plain functions, no React.
 */
import type { AnalyzedFile, Grade, MonsterKind, RepoAnalysis, RepoProgress, Severity } from "@/lib/types";

/** How many files the "Tidiest scrolls" and "Most cursed" lists show. */
const TOP_COUNT = 3;

/** Name of the region for files in the repo's root folder (matches the world's town). */
const ROOT_REGION = "Town Square";

/** Files that downloaded and were analysed (failed downloads count for nothing). */
function okFiles(analysis: RepoAnalysis): AnalyzedFile[] {
  return analysis.files.filter((file) => file.status === "ok");
}

export interface RegionRow {
  /** "potions/" or ROOT_REGION. */
  name: string;
  files: number;
  bugs: number;
  defeated: number;
}

/** One row per top-level directory, like the regions of the overworld, biggest first. */
export function regionRows(analysis: RepoAnalysis, progress: RepoProgress): RegionRow[] {
  const defeated = new Set(progress.defeated);
  const rows = new Map<string, RegionRow>();
  for (const file of okFiles(analysis)) {
    const slash = file.path.indexOf("/");
    const name = slash === -1 ? ROOT_REGION : `${file.path.slice(0, slash)}/`;
    const row = rows.get(name) ?? { name, files: 0, bugs: 0, defeated: 0 };
    row.files++;
    row.bugs += file.findings.length;
    row.defeated += file.findings.filter((finding) => defeated.has(finding.id)).length;
    rows.set(name, row);
  }
  return [...rows.values()].sort((a, b) => b.files - a.files || a.name.localeCompare(b.name));
}

/** The best-written clean files (no findings), highest quality score first. */
export function tidiestFiles(analysis: RepoAnalysis): AnalyzedFile[] {
  return okFiles(analysis)
    .filter((file) => file.findings.length === 0)
    .sort((a, b) => b.quality.score - a.quality.score || a.path.localeCompare(b.path))
    .slice(0, TOP_COUNT);
}

/** The files with the most findings (counting ones beyond the per-file monster cap). */
export function mostCursedFiles(analysis: RepoAnalysis): AnalyzedFile[] {
  const count = (file: AnalyzedFile) => file.findings.length + file.overflow;
  return okFiles(analysis)
    .filter((file) => count(file) > 0)
    .sort((a, b) => count(b) - count(a) || a.path.localeCompare(b.path))
    .slice(0, TOP_COUNT);
}

/** Which monster species of each severity actually appear in the repo (for the severity bars). */
export function monstersBySeverity(analysis: RepoAnalysis): Record<Severity, MonsterKind[]> {
  const result: Record<Severity, MonsterKind[]> = { minion: [], elite: [], boss: [] };
  for (const file of analysis.files) {
    for (const finding of file.findings) {
      const kinds = result[finding.severity];
      if (!kinds.includes(finding.monster)) kinds.push(finding.monster);
    }
  }
  return result;
}

// ───────────────────────────── Report card ─────────────────────────────

/** Points per grade for averaging: S = 4 … C = 1. */
const GRADE_POINTS: Readonly<Record<Grade, number>> = { S: 4, A: 3, B: 2, C: 1 };
const GRADES_BEST_FIRST: readonly Grade[] = ["S", "A", "B", "C"];

export interface ReportCard {
  grade: Grade;
  /** The average on the 1–4 scale, one decimal. */
  points: number;
  fileCount: number;
}

/**
 * The repo's overall grade: the average of every analysed file's quality
 * grade (S = 4, A = 3, B = 2, C = 1), rounded to the nearest grade.
 */
export function reportCard(analysis: RepoAnalysis): ReportCard {
  const files = okFiles(analysis);
  const total = files.reduce((sum, file) => sum + GRADE_POINTS[file.quality.grade], 0);
  const average = files.length === 0 ? GRADE_POINTS.C : total / files.length;
  const rounded = Math.round(average);
  const grade = GRADES_BEST_FIRST.find((g) => GRADE_POINTS[g] === rounded) ?? "C";
  return { grade, points: Math.round(average * 10) / 10, fileCount: files.length };
}
