/**
 * The Workshop's public props: what the game hands the editor when it opens
 * it, and what the editor hands back. Import them from "@/components/workshop".
 */
import type { ReactNode } from "react";
import type { AudioApi } from "@/game/bridge";
import type { Finding, SaveData, Store } from "@/lib/types";
import type { ForgeReport, Workspace } from "@/lib/workspace/contract";

/** What the game paid for one forge, shown in the forge summary. */
export interface ForgeRewards {
  coins: number;
  xp: number;
  /** Extra lines to show ("Quest complete: Document take_order"), already plain text. */
  lines: string[];
  /**
   * Optional: the fixes that were paid (`applyForge(...).paid.fixes`). With
   * it, each banished monster shows its own "+coins"; without it, only the
   * total is shown.
   */
  paidFixes?: readonly Finding[];
}

/** Lets an extra side-panel tab talk to the editor. */
export interface WorkshopTabContext {
  /** Opens a file (and optionally puts the cursor on a 1-based line). */
  openFile(path: string, line?: number): void;
  /** The file in front, or null. */
  activePath: string | null;
}

/** A side-panel tab added by another feature (the Quests panel arrives this way). */
export interface WorkshopExtraTab {
  /** Unique among the tabs; "bugs", "grade" and "changes" are taken. */
  id: string;
  label: string;
  render: (context: WorkshopTabContext) => ReactNode;
}

export interface WorkshopProps {
  workspace: Workspace;
  /** The player's save: coins, level and repo progress. The Workshop only reads it. */
  save: Store<SaveData>;
  /** `owner/repo@sha` key of this repo's progress in the save (see repoKey in src/game/bridge.ts). */
  repoKey: string;
  audio: AudioApi;
  /** Open this file (at this 1-based line) when the Workshop opens. */
  initial?: { path: string; line?: number };
  /** Called after every forge and revert with the workspace's report; returns what the game paid, if anything. */
  onForged?: (report: ForgeReport) => ForgeRewards | void;
  /** "Back to the world". Unforged typing is kept for the next visit. */
  onClose: () => void;
  extraTabs?: readonly WorkshopExtraTab[];
}
