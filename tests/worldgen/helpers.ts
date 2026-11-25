/**
 * Fake repo analyses for tests.
 *
 * `makeFakeAnalysis(seed, opts)` fabricates a plausible RepoAnalysis (dirs,
 * files, line counts, findings, grades) from a seed, so test suites can
 * throw hundreds of differently shaped repos at the game without touching
 * the network or Ruff. The same seed + options always give the same repo.
 */
import type { AnalyzedFile, FileKind, Finding, FindingCategory, Grade, MonsterKind, RepoAnalysis, Severity } from "@/lib/types";
import { MONSTERS } from "@/lib/game/catalog";
import { chance, hashString, mulberry32, pick, randInt, type Rng } from "@/lib/rng";

export interface FakeAnalysisOptions {
  /** Number of files (default: random 5–40). */
  fileCount?: number;
  /** Number of top-level directories (default: random 1–6). 0 = every file at the root. */
  dirCount?: number;
  /** Share of files placed directly in the root (default 0.15). */
  rootShare?: number;
  /** Deepest nesting below a top-level directory (default 2). */
  maxDepth?: number;
  /** Chance that a file has findings (default 0.45). 0 = a spotless repo, 1 = everything cursed. */
  cursedRate?: number;
  /** Most findings in one file (default 8). */
  maxFindings?: number;
  /** Chance that a finding is a boss (default 0.08). */
  bossRate?: number;
  /** Chance that a file failed to download (default 0.03). */
  failedRate?: number;
  /** Chance that a directory gets a trivial `__init__.py` (default 0.5). */
  initRate?: number;
}

const DIR_NAMES = [
  "src", "bakery", "potions", "tests", "docs", "scripts", "utils", "core", "api", "models",
  "views", "tools", "plugins", "data", "lib", "app", "cli", "web", "db", "config",
  "examples", "bench", "extras", "contrib", "migrations", "static", "i18n", "nlp", "maths", "garden",
];
const SUB_NAMES = ["inner", "deep", "impl", "parts", "kit", "shelf", "nook"];
const FILE_NAMES = ["main", "utils", "helpers", "models", "views", "brew", "oven", "cauldron", "recipes", "parser", "engine", "cache", "server", "client", "schema"];

const KINDS_BY_SEVERITY: Record<Severity, MonsterKind[]> = {
  minion: ["dustBunny", "todoMite", "echoBat"],
  elite: ["gremlin", "phantom", "mimic", "swallowToad", "spaghetti"],
  boss: ["keyThief", "evalSerpent", "glitchKing"],
};
const CATEGORY_BY_KIND: Record<MonsterKind, FindingCategory> = {
  dustBunny: "unused",
  todoMite: "todo",
  echoBat: "style",
  gremlin: "bug",
  phantom: "bug",
  mimic: "trap",
  swallowToad: "error-handling",
  spaghetti: "complexity",
  keyThief: "security",
  evalSerpent: "security",
  glitchKing: "syntax",
};

export function makeFakeAnalysis(seed: number, opts: FakeAnalysisOptions = {}): RepoAnalysis {
  const rng = mulberry32(hashString(`fake-analysis:${seed}`));
  const fileCount = opts.fileCount ?? randInt(rng, 5, 40);
  const dirCount = Math.min(opts.dirCount ?? randInt(rng, 1, 6), DIR_NAMES.length);
  const rootShare = dirCount === 0 ? 1 : opts.rootShare ?? 0.15;
  const dirs = DIR_NAMES.slice(0, dirCount);

  const paths = new Set<string>();
  const files: AnalyzedFile[] = [];
  const addFile = (path: string, kind: FileKind, lineCount: number) => {
    if (paths.has(path) || files.length >= fileCount) return;
    paths.add(path);
    files.push(makeFakeFile(rng, path, kind, lineCount, opts));
  };

  // A trivial __init__.py in some directories, like real packages.
  for (const dir of dirs) {
    if (chance(rng, opts.initRate ?? 0.5)) addFile(`${dir}/__init__.py`, "init", randInt(rng, 0, 5));
  }
  for (let i = 0; files.length < fileCount; i++) {
    const atRoot = dirs.length === 0 || chance(rng, rootShare);
    const folder = atRoot ? "" : `${pick(rng, dirs)}/${nestedFolder(rng, opts.maxDepth ?? 2)}`;
    const isTest = chance(rng, 0.15);
    const name = `${isTest ? "test_" : ""}${pick(rng, FILE_NAMES)}${i}.py`;
    const lineCount = pick(rng, [randInt(rng, 6, 79), randInt(rng, 80, 299), randInt(rng, 300, 900)]);
    addFile(`${folder}${name}`, isTest ? "test" : "module", lineCount);
  }
  return finishAnalysis(`repo${seed}`, files);
}

function nestedFolder(rng: Rng, maxDepth: number): string {
  let out = "";
  for (let depth = randInt(rng, 0, maxDepth); depth > 0; depth--) out += `${pick(rng, SUB_NAMES)}/`;
  return out;
}

export function makeFakeFile(rng: Rng, path: string, kind: FileKind, lineCount: number, opts: FakeAnalysisOptions = {}): AnalyzedFile {
  const failed = chance(rng, opts.failedRate ?? 0.03);
  const cursed = !failed && kind !== "init" && chance(rng, opts.cursedRate ?? 0.45);
  const findingCount = cursed ? randInt(rng, 1, opts.maxFindings ?? 8) : 0;
  const findings: Finding[] = [];
  for (let i = 0; i < findingCount; i++) {
    const severity: Severity = chance(rng, opts.bossRate ?? 0.08) ? "boss" : chance(rng, 0.4) ? "elite" : "minion";
    findings.push(makeFakeFinding(rng, path, randInt(rng, 1, Math.max(1, lineCount)), severity));
  }
  findings.sort((a, b) => a.line - b.line || a.col - b.col);
  const score = findings.length > 0 ? randInt(rng, 20, 80) : randInt(rng, 50, 100);
  return {
    path,
    size: lineCount * 30,
    lineCount: failed ? 0 : lineCount,
    status: failed ? "failed" : "ok",
    kind,
    findings,
    overflow: 0,
    quality: {
      score,
      grade: gradeFor(score),
      highlights: [],
      metrics: { definitions: 3, docCoverage: 0.5, hintCoverage: 0.5, commentRatio: 0.1, probeHits: 0 },
    },
  };
}

export function makeFakeFinding(rng: Rng, path: string, line: number, severity: Severity, monster?: MonsterKind): Finding {
  const kind = monster ?? pick(rng, KINDS_BY_SEVERITY[severity]);
  const col = randInt(rng, 1, 40);
  const code = `${severity === "boss" ? "S" : "F"}${randInt(rng, 100, 999)}`;
  return {
    id: `${path}:${line}:${col}:${code}`,
    path,
    code,
    title: `Fake ${MONSTERS[kind].name} problem`,
    message: "something is off here",
    line,
    col,
    endLine: line,
    endCol: col + 3,
    severity: MONSTERS[kind].severity,
    category: CATEGORY_BY_KIND[kind],
    monster: kind,
    snippet: [{ n: line, text: "x = 1", hit: true }],
    tip: "Fix it!",
  };
}

/** A file with exactly the given monsters (one finding per entry, spread over the file). */
export function makeFileWithMonsters(path: string, monsters: readonly MonsterKind[], seed = 1): AnalyzedFile {
  const rng = mulberry32(hashString(`file:${path}:${seed}`));
  const lineCount = 40 + monsters.length * 20;
  const file = makeFakeFile(rng, path, "module", lineCount, { cursedRate: 0, failedRate: 0 });
  file.findings = monsters.map((kind, i) => makeFakeFinding(rng, path, 1 + i * 20 + randInt(rng, 0, 15), MONSTERS[kind].severity, kind));
  return file;
}

function gradeFor(score: number): Grade {
  if (score >= 90) return "S";
  if (score >= 75) return "A";
  if (score >= 55) return "B";
  return "C";
}

/** Wraps files into a RepoAnalysis with matching stats. */
export function finishAnalysis(repo: string, files: AnalyzedFile[], extra: Partial<RepoAnalysis> = {}): RepoAnalysis {
  const all = files.flatMap((f) => f.findings);
  const bySeverity: Record<Severity, number> = { minion: 0, elite: 0, boss: 0 };
  for (const f of all) bySeverity[f.severity]++;
  const buggyFiles = files.filter((f) => f.findings.length > 0).length;
  return {
    repo: { owner: "fake", repo, ref: "main", sha: hashString(repo).toString(16).padStart(40, "0") },
    description: "A totally real repository for testing",
    stars: files.length * 3,
    files,
    stats: {
      fileCount: files.length,
      lineCount: files.reduce((sum, f) => sum + f.lineCount, 0),
      findingCount: all.length,
      bySeverity,
      cleanFiles: files.length - buggyFiles,
      buggyFiles,
    },
    warnings: [],
    demo: false,
    ...extra,
  };
}
