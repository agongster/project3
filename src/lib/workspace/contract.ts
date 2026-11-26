/**
 * The Workspace contract: everything the gamified IDE ("the Workshop") and
 * the game need in order to read, check, edit and save the repo's files.
 *
 *   GitHub / demo ──► openWorkspace() ──► Workspace
 *                                           │  .analysis   (a Store: the world reads it)
 *                                           │  .read()     the editor opens a file
 *                                           │  .check()    live squiggles while typing
 *                                           │  .forge()    SAVE: re-lint, update the world
 *                                           ▼
 *                                       ForgeReport ──► applyForge(save, …) pays the rewards
 *
 * Two ideas hold it together:
 *
 * 1. **Typing changes nothing in the game.** While the player types, the
 *    editor only shows live hints (`check`). The game world, the rewards and
 *    the saved progress change in one place only: `forge`, the player's
 *    deliberate "save" (Ctrl/Cmd+S). Half-typed code is full of temporary
 *    errors, and it would be unfair and noisy to turn those into monsters.
 *
 * 2. **Edits live in the browser.** Nothing is written back to GitHub. The
 *    saved text of every changed file is kept in localStorage per commit
 *    (`owner/repo@sha`) and can be exported as a patch or a zip.
 *
 * This file is types only. The implementation is in the other files of this
 * folder; the editor UI is in src/components/workshop/.
 */
import type { AnalyzedFile, FileOutline, FileQuality, Finding, Grade, RepoAnalysis, Store } from "@/lib/types";

// ───────────────────────────── Files ─────────────────────────────

/** One file the Workshop can open. */
export interface WorkspaceEntry {
  path: string;
  /** Size in bytes of the original file. */
  size: number;
  /**
   * "python" files are linted: they are the buildings and dungeons of the
   * world. "other" files (README, config, …) can be viewed and edited but
   * have no monsters.
   */
  kind: "python" | "other";
  /** True once the saved text differs from the original. */
  modified: boolean;
}

/** The two versions of a file the Workshop cares about. */
export interface FileText {
  /** The text as it is in the repo at this commit. */
  original: string;
  /** The text as last forged (equal to `original` for an unchanged file). */
  saved: string;
}

// ───────────────────────── Checking while typing ─────────────────────────

/**
 * A 1-based position range in a file's text. A column is the JavaScript
 * string index within the line plus one (so it counts UTF-16 code units, like
 * every editor API in the browser), and `endCol` is exclusive: the range
 * stops just before it.
 */
export interface TextRange {
  line: number;
  col: number;
  endLine: number;
  endCol: number;
}

/** One replacement that is part of a quick fix. */
export interface TextEdit extends TextRange {
  /** The text to put in place of the range ("" deletes it). */
  text: string;
}

/** A fix Ruff itself offers for a finding ("Remove unused import: `os`"). */
export interface QuickFix {
  /** Ruff's own description of the fix. */
  title: string;
  /** Applied together, last edit first, so earlier positions stay valid. */
  edits: TextEdit[];
  /**
   * False when the fix might change what the code does ("unsafe"). Ruff's
   * WebAssembly build does not say, so this comes from a cautious list of
   * rules whose fixes are known to be safe (`SAFE_FIX_RULES`).
   */
  safe: boolean;
}

/** A finding as the editor shows it: where to underline, and how to fix it. */
export interface LiveFinding {
  finding: Finding;
  range: TextRange;
  /** Null when Ruff offers no automatic fix for this rule. */
  quickFix: QuickFix | null;
}

/** The result of checking text that has not been forged yet. */
export interface LiveCheck {
  /**
   * Every finding in the text, in line order. Unlike a dungeon (which caps
   * the monsters per file), the editor shows all of them.
   */
  findings: LiveFinding[];
  quality: FileQuality;
  outline: FileOutline;
}

// ───────────────────────────── Forging ─────────────────────────────

/** A finding that survived an edit, before and after (its line may have moved). */
export interface KeptFinding {
  before: Finding;
  after: Finding;
}

/**
 * What a forge (save) changed, as plain facts. It says nothing about coins:
 * rewards depend on the player's save file and are worked out by
 * `applyForge` in src/lib/game/forge.ts.
 */
export interface ForgeReport {
  path: string;
  /** False for a non-Python file: it was saved, and nothing else below applies. */
  linted: boolean;
  /** Findings of the previous version that are gone: fixed for real, in the code. */
  fixed: Finding[];
  /** Findings that are new in this version. */
  introduced: Finding[];
  /** Findings present in both versions, matched up. Ids may differ when lines moved. */
  kept: KeptFinding[];
  /**
   * Grade and number of findings before and after. `findingCount` counts
   * every finding in the text (a dungeon shows at most a capped selection).
   * Meaningless when `linted` is false.
   *
   * A text with a syntax error cannot be linted for anything else, so while
   * a file is broken it is treated as still having the findings of its last
   * readable version: breaking code never counts as fixing it.
   */
  before: { grade: Grade; score: number; findingCount: number };
  after: { grade: Grade; score: number; findingCount: number };
  /** True when the file had findings before and has none now. */
  purified: boolean;
  /**
   * The file as the world now sees it (also already placed in
   * `workspace.analysis`). Its `fixedFindings` are the original findings that
   * are fixed in the saved text, which is what rewards are paid for.
   */
  file: AnalyzedFile | null;
}

/** One modified file, for the "Changes" list and for exporting. */
export interface FileChange {
  path: string;
  original: string;
  saved: string;
  linesAdded: number;
  linesRemoved: number;
}

// ───────────────────────────── The workspace ─────────────────────────────

export interface Workspace {
  /**
   * The current analysis of the repo. It starts as the analysis of the
   * original files with the player's stored edits applied, and is replaced
   * by a new object (never mutated) each time a Python file is forged or
   * reverted. Each `AnalyzedFile.realFixes` says how many of that file's
   * original findings are fixed in its saved text.
   */
  readonly analysis: Store<RepoAnalysis>;

  /** Every file that can be opened, Python files first, each group sorted by path. */
  entries(): WorkspaceEntry[];

  /**
   * The text of a file. Python files are already in memory; other files are
   * downloaded the first time they are opened. Rejects with an Error whose
   * message can be shown to the player (too large, binary, download failed).
   */
  read(path: string): Promise<FileText>;

  /**
   * Lints `source` as if it were the file at `path`, without saving anything.
   * Python files only (other paths reject).
   *
   * The editor calls this on every pause in typing, so answers could arrive
   * out of order. They never do: if a newer check for the same path was
   * requested meanwhile, the older call rejects with `SupersededError` (test
   * with `isSuperseded`), so a result that resolves is always for the newest text.
   */
  check(path: string, source: string): Promise<LiveCheck>;

  /** Returns `source` formatted by Ruff's formatter. Rejects if the text has a syntax error. */
  format(source: string): Promise<string>;

  /**
   * Saves `source` as the new text of `path`: remembers it in localStorage,
   * re-analyzes the file, puts the result into `analysis` and reports what
   * changed. Forging text equal to the current saved text reports no changes.
   * All or nothing: if the text cannot be analyzed the call rejects with a
   * message for the player and nothing is saved, so the editor keeps the text.
   */
  forge(path: string, source: string): Promise<ForgeReport>;

  /** Forges the original text again (undoes every edit to the file). */
  revert(path: string): Promise<ForgeReport>;

  /** The files whose saved text differs from the original, sorted by path. */
  changes(): FileChange[];

  /** Calls `listener` after every forge or revert. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;

  /** All changes as one unified diff (`git apply` can read it). "" when nothing changed. */
  exportPatch(): string;

  /** The changed files, with their full new text, as a zip archive. */
  exportZip(): Uint8Array;

  /** Stops the lint worker. The workspace must not be used afterwards. */
  dispose(): void;
}
