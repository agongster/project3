/**
 * Contract for the loading mini-game ("Bug Catch") that is shown while a repo
 * is being downloaded and analysed.
 */
import type { AudioApi } from "@/game/bridge";
import type { CharacterLook, ThemeId } from "@/lib/types";

export interface LoadingGameProps {
  audio: AudioApi;
  /** The player's own hero is the one catching bugs. */
  look: CharacterLook;
  hatId: string | null;
  theme: ThemeId;
  /** Called every time the score changes. The score becomes bonus coins. */
  onScore?: (score: number) => void;
  /** Freeze the mini-game (e.g. while an error dialog is showing). */
  paused?: boolean;
  className?: string;
}

/** Most bonus coins a single loading screen can award. */
export const MAX_LOADING_BONUS = 40;
