/**
 * Runs the whole "repo → world" pipeline for the loading screen:
 * opening the workspace (download + Ruff + the player's stored edits)
 * followed by overworld generation.
 *
 * The work starts when the component mounts and is cancelled (AbortSignal)
 * when it unmounts, so leaving the loading screen never leaves a download
 * (or a lint worker) running in the background.
 */
import { useEffect, useEffectEvent, useState } from "react";
import { AnalyzeError } from "@/lib/analysis/errors";
import { openWorkspace } from "@/lib/workspace";
import { generateOverworld } from "@/lib/worldgen";
import type { AnalyzeProgress } from "@/lib/types";
import type { FlowError, LoadedWorld, WorldTarget } from "@/components/app/flow";

export type LoaderState =
  | { status: "running"; progress: AnalyzeProgress | null }
  | { status: "ready"; loaded: LoadedWorld };

/** Where each analysis stage starts on the overall 0–1 progress bar. */
const STAGE_SPAN: Record<AnalyzeProgress["stage"], [start: number, end: number]> = {
  listing: [0, 0.1],
  downloading: [0.1, 0.5],
  linting: [0.5, 0.9],
  building: [0.9, 0.97],
  done: [1, 1],
};

/** Turns a stage + "12/40" counter into one smooth 0–1 value for the progress bar. */
export function overallProgress(progress: AnalyzeProgress | null): number {
  if (!progress) return 0;
  const [start, end] = STAGE_SPAN[progress.stage];
  const within = progress.total > 0 ? progress.done / progress.total : 0;
  return start + (end - start) * within;
}

const UNKNOWN_ERROR_MESSAGE = "Something went wrong while building your world. Want to try again?";

/** Any thrown value → a FlowError the title screen can show. */
function toFlowError(error: unknown, target: WorldTarget): FlowError {
  if (error instanceof AnalyzeError) {
    return { code: error.code, message: error.message, retryAfterSec: error.retryAfterSec, target };
  }
  console.error("Lintlands: building the world failed", error);
  return { code: "unknown", message: UNKNOWN_ERROR_MESSAGE, target };
}

/**
 * @param onError called once if the analysis fails (not when it is cancelled)
 */
export function useWorldLoader(target: WorldTarget, onError: (error: FlowError) => void): LoaderState {
  const [state, setState] = useState<LoaderState>({ status: "running", progress: null });
  // An Effect Event always sees the latest `onError` without restarting the download.
  const reportError = useEffectEvent(onError);

  useEffect(() => {
    const controller = new AbortController();
    const onProgress = (progress: AnalyzeProgress) => {
      if (!controller.signal.aborted) setState({ status: "running", progress });
    };

    openWorkspace(target, onProgress, controller.signal)
      .then((workspace) => {
        // Cancelled while the last step finished: nobody will use this workspace, so stop its worker.
        if (controller.signal.aborted) return workspace.dispose();
        const analysis = workspace.analysis.get();
        const loaded: LoadedWorld = { workspace, analysis, world: generateOverworld(analysis) };
        setState({ status: "ready", loaded });
      })
      .catch((error: unknown) => {
        // Cancelling (Cancel button, or React re-running this effect) is not an error.
        if (controller.signal.aborted) return;
        reportError(toFlowError(error, target));
      });

    return () => controller.abort();
  }, [target]);

  return state;
}
