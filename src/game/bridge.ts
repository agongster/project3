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
 *   - the GameHandle            (UI → engine: pause / resume / destroy)
 */
import type { Dungeon, Finding, Overworld, RepoAnalysis, SaveData, Store } from "@/lib/types";

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
  /** Set while inside a dungeon. */
  dungeon: { path: string; remaining: number; total: number } | null;
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
 * Things the engine asks the UI to show. For every event marked (pauses) the
 * engine pauses itself first; the UI must call `game.resume()` when its
 * overlay closes.
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
  /** (pauses) An NPC or sign is talking. */
  | { type: "dialog"; speaker: string; lines: string[] }
  /** (pauses) Show the full bug card (boss defeated, or player inspected a monster). */
  | { type: "bugCard"; finding: Finding }
  /** (pauses) The player pressed the menu key (Esc / Tab). */
  | { type: "menu" }
  /** (pauses) Every dungeon in the repo is cleared. */
  | { type: "victory" }
  /** A monster was defeated (small toast with the bug title; does not pause). */
  | { type: "squashed"; finding: Finding; coins: number }
  /** A dungeon was fully cleared (celebration banner; does not pause). */
  | { type: "purified"; path: string }
  /** The player levelled up (does not pause). */
  | { type: "levelUp"; level: number; title: string }
  /** Short message (does not pause). */
  | { type: "toast"; text: string; tone: "info" | "good" | "warn" };

export interface GameOptions {
  canvas: HTMLCanvasElement;
  analysis: RepoAnalysis;
  world: Overworld;
  /** Builds the dungeon for a file path on demand (deterministic). */
  makeDungeon: (path: string) => Dungeon;
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
