/**
 * The contract between the three runtime pieces of the game:
 *
 *   React UI (menus, HUD, overlays)  ◄──events / stores──►  canvas engine  ──►  audio
 *
 * The engine never imports React, and React never reaches into engine
 * internals. They only share:
 *   - the persisted save store  (Store<SaveData>, see src/lib/game/store.ts)
 *   - the HUD store             (Store<HudState>, written by the engine every frame it changes)
 *   - GameEvents                (engine → UI: "the player opened a chest", ...)
 *   - the GameHandle            (UI → engine: pause / resume / destroy, the
 *                                answer to a `finisher` question, and each
 *                                new analysis after the code was edited)
 */
import type { AnalyzedFile, Dungeon, Finding, Overworld, RepoAnalysis, SaveData, Store } from "@/lib/types";

// ─────────────────────────── Screen size ────────────────────────

/**
 * The game is drawn at this small internal resolution (25 × 14 tiles) and the
 * canvas element is then scaled up by a whole number with CSS, which is what
 * gives it the chunky pixel-art look.
 *
 * Division of labour: the ENGINE sets `canvas.width/height` to these values
 * and never touches CSS; the UI SHELL picks the integer scale that fits the
 * window and sets the canvas's CSS size (and lays the HUD over it).
 */
export const VIEW_W = 400;
export const VIEW_H = 225;

// ───────────────────────────── Audio ────────────────────────────

export type SfxName =
  | "uiMove"
  | "uiSelect"
  | "uiBack"
  | "step"
  | "swing"
  | "shoot"
  | "slam"
  | "hit"
  | "crit"
  | "squash" // a monster is defeated
  | "bossRoar"
  | "bossDown"
  | "hurt"
  | "faint"
  | "dash"
  | "coin"
  | "heart"
  | "break" // bush / pot / crate
  | "door"
  | "chestOpen"
  | "gachaSpin"
  | "revealCommon"
  | "revealRare"
  | "revealEpic"
  | "revealLegendary"
  | "equip"
  | "purify" // dungeon cleared
  | "levelUp"
  | "talk"
  | "quack"
  | "splash" // wishing-well coin toss
  | "error"
  | "catch" // loading mini-game
  | "victory";

export type MusicTrack = "title" | "overworld" | "dungeon" | "boss" | "loading" | "victory";

export interface AudioApi {
  /** Must be called from a user gesture (click / key press) to start audio. */
  unlock(): void;
  /** Play a one-shot sound effect. `pitch` is a playback-rate style multiplier (default 1). */
  sfx(name: SfxName, opts?: { pitch?: number; volume?: number }): void;
  /** Cross-fade to a looping music track (null = silence). */
  music(track: MusicTrack | null): void;
  /** Tints the music to match the scenery theme. */
  setTheme(theme: SaveData["theme"]): void;
  /** Volumes are 0–1. */
  setVolumes(sfx: number, music: number): void;
}

// ───────────────────────── Engine ↔ UI ──────────────────────────

/** Live values the HUD shows. Written by the engine, read by React. */
export interface HudState {
  scene: "overworld" | "dungeon";
  /** Half-hearts. */
  hp: number;
  maxHp: number;
  combo: number;
  /** Name of the region / dungeon file the player is in. */
  location: string;
  /** "Press E to …" hint, or null. */
  prompt: string | null;
  /**
   * Set while inside a dungeon: `remaining` monsters still fight (out of
   * `total`), and `toFix` of the file's bugs are still in its code.
   */
  dungeon: { path: string; remaining: number; total: number; toFix: number } | null;
  /** Set while a boss is alive in the current dungeon. */
  boss: { name: string; hp: number; maxHp: number } | null;
  /** Dash cooldown progress, 0 (just used) → 1 (ready). */
  dashReady: number;
}

export const INITIAL_HUD: HudState = {
  scene: "overworld",
  hp: 10,
  maxHp: 10,
  combo: 0,
  location: "Town Square",
  prompt: null,
  dungeon: null,
  boss: null,
  dashReady: 1,
};

/**
 * Where the Workshop (the code editor) should open: a file and a 1-based
 * line, just a file, or nowhere in particular (`path` null: the Workshop
 * opens on whatever it showed last).
 */
export interface WorkshopTarget {
  path: string | null;
  line?: number;
}

/**
 * Things the engine asks the UI to show. For every event marked (pauses) the
 * engine pauses itself first; the UI must call `game.resume()` when its
 * overlay closes. Events are plain data: the only one that needs an answer
 * (`finisher`) gets it through `GameHandle.resolveFinisher`.
 */
export type GameEvent =
  /** (pauses) A treasure chest: a clean file's reward, or the prize for clearing a dungeon. */
  | { type: "chest"; source: "clean-file" | "dungeon-clear"; path: string }
  /** (pauses) The player used the Wishing Well. */
  | { type: "gacha" }
  /** (pauses) The player used the wardrobe. */
  | { type: "wardrobe" }
  /** (pauses) The player read the notice board (repo stats). */
  | { type: "board" }
  /**
   * (pauses) An NPC or sign is talking. `edit` adds a button that opens the
   * Workshop there (a dungeon plaque's "Edit this function").
   */
  | { type: "dialog"; speaker: string; lines: string[]; edit?: { label: string; target: WorkshopTarget } }
  /** (pauses) Open the Workshop (a clean building's "Read the code"). */
  | { type: "workshop"; target: WorkshopTarget }
  /** (pauses) Show the full bug card (boss defeated, or player inspected a monster). */
  | { type: "bugCard"; finding: Finding }
  /**
   * (pauses) The hero is finishing a dazed elite or boss: ask "Which fix really
   * squashes this bug?". Answer with `game.resolveFinisher` before `game.resume()`.
   */
  | { type: "finisher"; finding: Finding }
  /** (pauses) The player pressed the menu key (Esc / Tab). */
  | { type: "menu" }
  /** (pauses) Every bug in the repo is fixed or sealed: every dungeon is purified. */
  | { type: "victory" }
  /** A monster was beaten in a fight: subdued (small toast with the bug title; does not pause). */
  | { type: "squashed"; finding: Finding; coins: number }
  /** The last fighting monster of a dungeon was subdued: the dungeon is quiet (banner; does not pause). */
  | { type: "quiet"; path: string }
  /** A dungeon's file has no bug left: it is purified (celebration banner; does not pause). */
  | { type: "purified"; path: string }
  /** The player levelled up (does not pause). */
  | { type: "levelUp"; level: number; title: string }
  /** Short message (does not pause). */
  | { type: "toast"; text: string; tone: "info" | "good" | "warn" };

export interface GameOptions {
  canvas: HTMLCanvasElement;
  analysis: RepoAnalysis;
  world: Overworld;
  /** Builds the dungeon of a file on demand (deterministic for the same file). */
  makeDungeon: (file: AnalyzedFile) => Dungeon;
  save: Store<SaveData>;
  hud: Store<HudState>;
  audio: AudioApi;
  emit: (event: GameEvent) => void;
}

export interface GameHandle {
  start(): void;
  /** Freeze simulation and ignore gameplay input (an overlay is open). */
  pause(): void;
  resume(): void;
  /**
   * The answer to a `finisher` event: did the player pick the finding's real
   * fix? Right = a critical fix (juicier death, double coins and XP); wrong =
   * a normal defeat. Call it before `resume()`. If the game resumes without
   * an answer (the overlay was closed), the monster is defeated normally.
   */
  resolveFinisher(findingId: string, correct: boolean): void;
  /**
   * The other answer to a `finisher` event: "I'll fix it for real". The dazed
   * monster gets back up with a sliver of health instead of going down, so
   * the Workshop has a bug left to fix. Call it before `resume()`.
   */
  spareFinisher(findingId: string): void;
  /**
   * The code was edited: from now on the game follows `analysis` (the
   * workspace's new one) without restarting. Buildings change state at once;
   * a dungeon the hero stands in re-forms when the game resumes. `fixedIds`
   * are ids (as the world knew them) of findings fixed for real in the code:
   * their monsters dissolve as "rewritten" instead of just vanishing;
   * `sealedIds` were only sealed with `# noqa` and fade out more plainly.
   * Calling it again with the same analysis only adds ids.
   */
  updateAnalysis(analysis: RepoAnalysis, fixedIds?: readonly string[], sealedIds?: readonly string[]): void;
  /** Where the Workshop should open for the hero's situation (the file they are in or in front of). */
  workshopTarget(): WorkshopTarget;
  /** Stop the loop and remove every listener. */
  destroy(): void;
  /** Test/debug helper: jump into the dungeon for `path` (or back out with null). */
  warp(path: string | null): void;
}

/** Key used for a repo's progress in `SaveData.repos`. */
export function repoKey(analysis: Pick<RepoAnalysis, "repo">): string {
  const { owner, repo, sha } = analysis.repo;
  return `${owner}/${repo}@${sha.slice(0, 12)}`;
}
