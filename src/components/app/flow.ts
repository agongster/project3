/**
 * The app's screens as plain data. `App.tsx` keeps exactly one `Screen` in
 * state and swaps it as the player moves through the game:
 *
 *   title ──► creator (first visit / "Edit hero") ──► loading ──► playing
 *     ▲                                                  │            │
 *     └──────────── error / cancel ◄─────────────────────┘            │
 *     └────────────────────────── "Leave world" ◄────────────────────┘
 */
import type { AnalyzeErrorCode } from "@/lib/analysis/errors";
import type { Overworld, RepoAnalysis } from "@/lib/types";

/** Which world to build: the offline demo, or a GitHub repo. */
export type WorldTarget = { kind: "demo" } | { kind: "repo"; owner: string; repo: string; ref?: string };

/** A finished analysis plus the overworld generated from it. */
export interface LoadedWorld {
  analysis: RepoAnalysis;
  world: Overworld;
}

/** A failed analysis, shown as a friendly panel on the title screen. */
export interface FlowError {
  code: AnalyzeErrorCode | "unknown";
  message: string;
  /** Only for rate limits: seconds until GitHub lets us try again. */
  retryAfterSec?: number;
  /** What the player was trying to load, so "Try again" can retry it. */
  target: WorldTarget;
}

export type Screen =
  | { name: "title"; error: FlowError | null }
  /** `next` is the world to load after the hero is saved (null = go back to the title). */
  | { name: "creator"; next: WorldTarget | null }
  | { name: "loading"; target: WorldTarget }
  | { name: "playing"; loaded: LoadedWorld };

export const DEMO_TARGET: WorldTarget = { kind: "demo" };

/** Human label for a target: "Demo Kingdom" or "owner/repo". */
export function targetLabel(target: WorldTarget): string {
  return target.kind === "demo" ? "Demo Kingdom" : `${target.owner}/${target.repo}`;
}
