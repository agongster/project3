/**
 * Overlays are the HTML screens that appear on top of the paused game:
 * chest reveals, the Wishing Well, the bag, the bug codex, and so on.
 *
 * The app shell keeps at most one `OverlayRequest` open at a time and renders
 * it through `OverlayHost`. Each overlay component receives the same
 * `OverlayContext` so it can read/write the save, play sounds, and close
 * itself (closing resumes the game).
 */
import type { AudioApi } from "@/game/bridge";
import type { Finding, RepoAnalysis, SaveData, Store } from "@/lib/types";

export type OverlayRequest =
  /** A treasure chest: reward for a clean file, or for clearing a dungeon. */
  | { kind: "chest"; source: "clean-file" | "dungeon-clear"; path: string }
  /** The Wishing Well (gacha). */
  | { kind: "gacha" }
  /** Inventory: equip weapons, charms, hats, pets, trails; see the collection. */
  | { kind: "bag" }
  /** Change the hero's look and the scenery theme. */
  | { kind: "wardrobe" }
  /** Every finding in the repo (the bug to-do list). */
  | { kind: "codex"; focusFindingId?: string }
  /** Notice board: repo statistics. */
  | { kind: "board" }
  /** One finding in detail (shown when a boss is defeated). */
  | { kind: "bugCard"; finding: Finding }
  /** All dungeons cleared. */
  | { kind: "victory" }
  /** An NPC or sign talking. */
  | { kind: "dialog"; speaker: string; lines: string[] }
  /** Pause menu (settings, controls, exit). */
  | { kind: "pause" };

export interface OverlayContext {
  analysis: RepoAnalysis;
  /** Key of this repo's progress in `SaveData.repos`. */
  repoKey: string;
  save: Store<SaveData>;
  audio: AudioApi;
  /** Replace the current overlay with another one (e.g. pause → bag). */
  open(request: OverlayRequest): void;
  /** Close the overlay and resume the game. */
  close(): void;
  /** Leave the world and go back to the title screen. */
  exitToTitle(): void;
}

/** Props every overlay component receives. */
export interface OverlayProps<K extends OverlayRequest["kind"]> {
  request: Extract<OverlayRequest, { kind: K }>;
  ctx: OverlayContext;
}
