/**
 * Friendly loading-screen messages, shared by the real analysis and the demo
 * so both feel the same.
 */
import type { AnalyzeProgress } from "@/lib/types";

export type ProgressCallback = (progress: AnalyzeProgress) => void;

const STAGE_LABELS: Record<AnalyzeProgress["stage"], string> = {
  listing: "Reading the kingdom map…",
  downloading: "Unrolling scrolls…",
  linting: "Sniffing for bugs…",
  building: "Raising the kingdom…",
  done: "The kingdom awaits!",
};

/** Builds a progress event; countable stages get "12/40" appended to the label. */
export function progressEvent(stage: AnalyzeProgress["stage"], done = 0, total = 0): AnalyzeProgress {
  const label = total > 0 ? `${STAGE_LABELS[stage]} ${done}/${total}` : STAGE_LABELS[stage];
  return { stage, done, total, label };
}
