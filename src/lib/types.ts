/**
 * Shared data contracts for Lintlands.
 *
 * Every module (analysis pipeline, world generator, art, engine, UI) talks to
 * the others through the plain-data shapes in this file, so this is the best
 * place to start reading the codebase.
 *
 *   GitHub repo ──► RepoListing ──► RepoAnalysis ──► Overworld / Dungeon ──► game
 *                  (/api/repo)     (Ruff in a        (worldgen)
 *                                   Web Worker)
 */
import type { FileOutline } from "@/lib/analysis/outline";

export type { Definition, FileOutline, OutlineComment } from "@/lib/analysis/outline";

// ───────────────────────────── Repo ─────────────────────────────

/** A repository pinned to one exact commit. */
export interface RepoRef {
  owner: string;
  repo: string;
  /** Branch (or tag) name the user asked for, or the default branch. */
  ref: string;
  /** Full commit SHA. Every file is fetched from this commit. */
  sha: string;
}

export interface RepoFileEntry {
  path: string;
  /** Size in bytes. */
  size: number;
}

/** Successful response body of `GET /api/repo?repo=owner/name`. */
export interface RepoListing {
  repo: RepoRef;
  description: string | null;
  stars: number;
  /** Python files that survived filtering (vendored dirs, size cap, file cap). */
  files: RepoFileEntry[];
  skipped: { vendored: number; tooLarge: number; overCap: number };
  /** True when GitHub itself truncated the tree (very large repos). */
  truncated: boolean;
}

export type ApiErrorCode = "bad_input" | "not_found" | "rate_limited" | "no_python" | "upstream";

/** Error response body of `/api/repo` (sent with a non-2xx status). */
export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; retryAfterSec?: number };
}

// ─────────────────────────── Findings ───────────────────────────

/** How dangerous a finding is. Decides monster strength and rewards. */
export type Severity = "minion" | "elite" | "boss";

export type FindingCategory =
  | "unused" // dead imports / variables / arguments
  | "todo" // TODO / FIXME comments, commented-out code
  | "style" // redefinitions, pointless statements, simplifiable code
  | "bug" // likely runtime bugs (undefined names, bad comparisons, ...)
  | "trap" // subtle gotchas (mutable defaults, late-binding closures, ...)
  | "error-handling" // bare / blind excepts, swallowed errors
  | "complexity" // too complex / too long / too many arguments
  | "security" // injection, eval, hardcoded secrets, unsafe deserialization
  | "syntax"; // the file does not even parse

/** Every monster species. Each finding is embodied by exactly one of these. */
export type MonsterKind =
  // minions
  | "dustBunny" // unused code
  | "todoMite" // TODO comments & commented-out code
  | "echoBat" // style / redefinitions
  // elites
  | "gremlin" // likely bugs
  | "phantom" // undefined names (things that are not really there)
  | "mimic" // traps that look innocent
  | "swallowToad" // swallowed exceptions
  | "spaghetti" // tangled, overly complex functions
  // bosses
  | "keyThief" // hardcoded secrets
  | "evalSerpent" // eval / exec / injection
  | "glitchKing"; // syntax errors

export const MONSTER_KINDS: readonly MonsterKind[] = [
  "dustBunny",
  "todoMite",
  "echoBat",
  "gremlin",
  "phantom",
  "mimic",
  "swallowToad",
  "spaghetti",
  "keyThief",
  "evalSerpent",
  "glitchKing",
];

export interface SnippetLine {
  /** 1-based line number in the file. */
  n: number;
  text: string;
  /** True for the line(s) the finding points at. */
  hit: boolean;
}

/** One static-analysis finding = one monster in a dungeon. */
export interface Finding {
  /** Stable id: `${path}:${line}:${col}:${code}`. */
  id: string;
  path: string;
  /** Ruff rule code such as "F401", or "SYNTAX" for a syntax error. */
  code: string;
  /** Short human title, e.g. "Unused import". */
  title: string;
  /** Ruff's own message, e.g. "`os` imported but unused". */
  message: string;
  /** 1-based positions. */
  line: number;
  col: number;
  endLine: number;
  endCol: number;
  severity: Severity;
  category: FindingCategory;
  monster: MonsterKind;
  /** A few lines of source around the finding (shown on the bug card). */
  snippet: SnippetLine[];
  /** One friendly sentence on how to fix it. */
  tip: string;
}

// ─────────────────────────── Good code ──────────────────────────

/** S is the best. Decides how good a clean file's treasure chest is. */
export type Grade = "S" | "A" | "B" | "C";

export interface FileQuality {
  /** 0–100. */
  score: number;
  grade: Grade;
  /** Human-readable reasons, e.g. "Every function has a docstring". */
  highlights: string[];
  metrics: {
    /** Number of `def` / `class` definitions found. */
    definitions: number;
    /** 0–1: share of definitions with a docstring. */
    docCoverage: number;
    /** 0–1: share of functions with type hints. */
    hintCoverage: number;
    /** 0–1: share of non-blank lines that are comments. */
    commentRatio: number;
    /** Count of "quality probe" lint hits (complexity, length, ...). */
    probeHits: number;
  };
}

/** What kind of building a file becomes. */
export type FileKind = "module" | "test" | "init" | "script";

export interface AnalyzedFile {
  path: string;
  size: number;
  lineCount: number;
  /** "failed" = could not be downloaded; it has no findings and no chest. */
  status: "ok" | "failed";
  kind: FileKind;
  /** The monsters. Capped per file and sorted by line number. */
  findings: Finding[];
  /** How many additional findings were dropped by the per-file cap. */
  overflow: number;
  quality: FileQuality;
  /**
   * The file's functions, classes, comments and imports (empty for a failed
   * file). This is what lets the world show the repo's own code and words.
   */
  outline: FileOutline;
  /**
   * How many of this file's *original* findings the player has fixed for
   * real, by editing the code in the Workshop (see src/lib/workspace/).
   * Missing or 0 for a file that was never edited. `findings` never includes
   * those: they no longer exist in the saved text.
   */
  realFixes?: number;
}

export interface RepoStats {
  fileCount: number;
  lineCount: number;
  findingCount: number;
  bySeverity: Record<Severity, number>;
  /** Files with zero findings. */
  cleanFiles: number;
  /** Files with at least one finding. */
  buggyFiles: number;
}

/** Everything the game needs to know about a repo. Plain JSON, no classes. */
export interface RepoAnalysis {
  repo: RepoRef;
  description: string | null;
  stars: number;
  files: AnalyzedFile[];
  stats: RepoStats;
  /** Non-fatal notices to show the player ("Showing the first 150 files"). */
  warnings: string[];
  /** True for the built-in offline demo kingdom. */
  demo: boolean;
  /** A short plain-text blurb from the repo's README (src/lib/analysis/readme.ts); null or missing when there is none. */
  readme?: string | null;
}

/** Progress events reported while a repo is being analyzed (loading screen). */
export interface AnalyzeProgress {
  stage: "listing" | "downloading" | "linting" | "building" | "done";
  /** Items finished / total in the current stage (0/0 if not countable). */
  done: number;
  total: number;
  /** Friendly status line, e.g. "Fetching scrolls… 12/40". */
  label: string;
}

// ───────────────────────────── World ────────────────────────────

export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Ground tile ids. These are *logical* tiles: the scenery theme decides what
 * they look like (grass is pink-ish in Sakura, white in Snow, ...).
 */
export const Ground = {
  Grass: 0,
  /** Region accent ground (flower field / darker grass / etc.). */
  Meadow: 1,
  Path: 2,
  /** Town-square cobblestone. */
  Plaza: 3,
  Water: 4,
  Sand: 5,
  Bridge: 6,
  // dungeon tiles
  DungeonFloor: 7,
  DungeonFloorAlt: 8,
  /** Top of a wall (solid). */
  DungeonWall: 9,
  /** Front face of a wall, drawn below a DungeonWall tile (solid). */
  DungeonWallFace: 10,
  /** Out-of-bounds darkness (solid). */
  DungeonVoid: 11,
  /** The doormat tile that leaves the dungeon. */
  DungeonExit: 12,
} as const;
export type GroundId = (typeof Ground)[keyof typeof Ground];

/** Things placed on top of the ground. Position is the tile of their base. */
export type PropKind =
  // overworld scenery
  | "tree"
  | "treeAlt"
  | "bush" // breakable: drops coins
  | "rock"
  | "flower"
  | "mushroom"
  | "stump"
  | "lamp"
  | "fence"
  | "bench"
  | "lantern" // marks an empty __init__.py
  // overworld landmarks (interactive)
  | "sign" // region signpost
  | "well" // the Wishing Well (gacha)
  | "wardrobe" // change your look
  | "board" // notice board with repo stats
  | "fountain"
  // dungeon
  | "pot" // breakable
  | "crate" // breakable
  | "torch"
  | "bones"
  | "crystal"
  | "web"
  | "plaque"; // shows the file path

export interface Prop {
  kind: PropKind;
  /** Tile coordinates of the prop's base. */
  x: number;
  y: number;
  /** Picks a visual variation (0..255). */
  variant: number;
  /** Solid props block movement on their base tile. */
  solid: boolean;
  /** Optional text (signs, plaques, lanterns). */
  text?: string;
}

/** A grid of ground tiles plus a collision mask (row-major, index = y*width+x). */
export interface TileMap {
  width: number;
  height: number;
  ground: Uint8Array;
  /** 1 = blocked, 0 = walkable. */
  solid: Uint8Array;
}

export interface Region {
  id: string;
  /** Display name, e.g. "Town Square" or "src/". */
  name: string;
  /** Top-level directory this region represents ("" for the root). */
  dir: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fileCount: number;
}

/** Bigger files become bigger buildings; test files become watchtowers. */
export type BuildingKind = "cottage" | "house" | "manor" | "tower";

export interface Building {
  id: string;
  /** Path of the file this building represents. */
  path: string;
  kind: BuildingKind;
  /** Footprint in tiles (solid). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Walkable tile directly in front of the door (stand here and press E). */
  door: Point;
  regionId: string;
  /** True when the file has findings: the building is a dungeon entrance. */
  corrupted: boolean;
  /** Picks a visual variation (roof color etc.). */
  variant: number;
}

export interface NpcSpawn {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Seed for a random villager look. */
  lookSeed: number;
  /** What they say (facts about the repo). */
  lines: string[];
  /** Short sayings (printable ASCII, already clipped) popped in a speech bubble when the hero is near. */
  bubbles?: string[];
}

export interface Overworld extends TileMap {
  seed: number;
  regions: Region[];
  buildings: Building[];
  props: Prop[];
  npcs: NpcSpawn[];
  /** Tile where the player first appears (in Town Square). */
  spawn: Point;
}

export interface MonsterSpawn {
  /** The finding this monster embodies. */
  findingId: string;
  kind: MonsterKind;
  x: number;
  y: number;
}

/** A dungeon is generated on demand for one file with findings. */
export interface Dungeon extends TileMap {
  path: string;
  seed: number;
  rooms: Rect[];
  /** Tile the player appears on. */
  entrance: Point;
  /** Tile (Ground.DungeonExit) that leaves the dungeon. */
  exit: Point;
  monsters: MonsterSpawn[];
  props: Prop[];
  /** Where the reward chest appears once every monster is defeated. */
  chest: Point;
  /** What each room stands for in the file, in the same order as `rooms` (see worldgen/roomPlan.ts). */
  roomInfo: DungeonRoom[];
}

/** The part of the file one dungeon room stands for. */
export interface DungeonRoom {
  /** "module" = the entry hall (module-level code); "function" = one or more functions, methods or class bodies. */
  kind: "module" | "function";
  /** Short name for the plaque and the HUD, e.g. "def take_order()" or "module" (already clipped). */
  label: string;
  /** Names of the definitions in the room, in source order (clipped; empty for the module hall). */
  names: string[];
  /** First and last source line (1-based, inclusive) of the code the room stands for. */
  line: number;
  endLine: number;
  /** Branching statements in the room's code (0 = straight-line code; shapes the room's interior walls). */
  branches: number;
  /** First docstring line (the module docstring for the hall), or null when undocumented. */
  docstring: string | null;
  /** True when the code is documented: the room gets plenty of torches. */
  lit: boolean;
  /** True when a boss lives here: the room is an open arena without interior walls. */
  arena: boolean;
}

// ───────────────────────── Player & items ───────────────────────

export type ThemeId = "meadow" | "sakura" | "autumn" | "snow" | "beach" | "night";

/** Indices into the option lists in `src/lib/game/catalog.ts`. */
export interface CharacterLook {
  name: string;
  skin: number;
  hairStyle: number;
  hairColor: number;
  outfit: number;
  outfitColor: number;
  eyes: number;
  accessory: number;
}

export type Rarity = "common" | "rare" | "epic" | "legendary";
export type ItemSlot = "weapon" | "charm" | "hat" | "pet" | "trail";

export interface EquippedItems {
  weapon: string;
  hat: string | null;
  pet: string | null;
  trail: string | null;
  /** Up to MAX_CHARMS passive power-ups. */
  charms: string[];
}

/** Progress inside one repo (keyed by `owner/repo@sha`). */
export interface RepoProgress {
  /** Finding ids of defeated monsters. */
  defeated: string[];
  /** Paths of dungeons that are fully cleared. */
  cleared: string[];
  /** Paths whose treasure chest has been opened. */
  opened: string[];
  /** Health milestones (25/50/75/100) already rewarded. */
  milestones: number[];
  /** Finding ids of notice-board bounties already settled (src/lib/game/bounties.ts). Missing in older saves. */
  bounties?: string[];
}

/** Where a chest item was found: the function (or class) and the file it came from. */
export interface Engraving {
  /** "get_batch()", "Trainer.fit()" or "OrderBook"; null when the file had no usable definition. */
  name: string | null;
  path: string;
}

/** Everything persisted to localStorage. */
export interface SaveData {
  version: 1;
  /** False until the player has finished the character creator once. */
  created: boolean;
  look: CharacterLook;
  theme: ThemeId;
  coins: number;
  xp: number;
  /** Item ids the player owns (collection is shared across all repos). */
  owned: string[];
  equipped: EquippedItems;
  gacha: { totalPulls: number; sinceEpic: number; sinceLegendary: number };
  repos: Record<string, RepoProgress>;
  settings: { sfx: number; music: number; screenShake: boolean };
  /** Where each chest item came from, by item id (src/lib/game/engraving.ts). Missing in older saves. */
  engravings?: Record<string, Engraving>;
  stats: {
    bugsSquashed: number;
    chestsOpened: number;
    dungeonsCleared: number;
    wishes: number;
    /** Dazed elites and bosses finished by picking the right fix (see src/lib/game/finisher.ts). */
    fixesPicked: number;
  };
}

/** A tiny observable store (see `src/lib/game/store.ts`). */
export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
}
