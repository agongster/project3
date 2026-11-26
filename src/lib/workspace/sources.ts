/**
 * Where a workspace's files come from: a real GitHub repo (repoSource.ts) or
 * the built-in Demo Kingdom (below). Both hand `openWorkspace` the same thing.
 */
import type { AnalysisMeta, SourceFile } from "@/lib/analysis/analyzeSources";
import { DEMO_DELAYS, DEMO_OTHER_FILES, DEMO_SOURCES, demoMeta, pretendToDownloadDemo, utf8Size } from "@/lib/analysis/demo";
import type { ProgressCallback } from "@/lib/analysis/progress";
import type { RepoFileEntry } from "@/lib/types";

/** A repo's files as loaded, before linting. */
export interface WorkspaceSource {
  meta: Omit<AnalysisMeta, "readme">;
  /** The README's blurb for the town's welcome, still downloading (null when there is none). */
  readme: Promise<string | null>;
  /** The Python files, already downloaded (`source` null = the download failed). */
  python: SourceFile[];
  /** The other text files (README, config, …): listed, downloaded only when opened. */
  others: RepoFileEntry[];
  /** Downloads the original text of one of `others`. Rejects with a message the player can read. */
  fetchOther(path: string): Promise<string>;
  /** Pauses (ms) that keep the demo's loading screen on view; 0 for a real repo. */
  pacing: { perLint: number; building: number };
}

/** No artificial pauses: a real repo takes long enough by itself. */
export const NO_PACING: WorkspaceSource["pacing"] = { perLint: 0, building: 0 };

/** The Demo Kingdom: everything is in memory, the loading screen only pretends to download. */
export async function demoSource(onProgress: ProgressCallback, signal: AbortSignal | undefined, sleep: (ms: number, signal?: AbortSignal) => Promise<void>): Promise<WorkspaceSource> {
  await pretendToDownloadDemo(onProgress, signal, sleep);
  const otherTexts = new Map(DEMO_OTHER_FILES.map((file) => [file.path, file.text]));
  return {
    meta: demoMeta(),
    readme: Promise.resolve(demoMeta().readme ?? null),
    python: DEMO_SOURCES.map((file) => ({ path: file.path, size: utf8Size(file.source), source: file.source })),
    others: DEMO_OTHER_FILES.map((file) => ({ path: file.path, size: utf8Size(file.text) })),
    fetchOther: async (path) => {
      const text = otherTexts.get(path);
      if (text === undefined) throw new Error("That file isn't part of the Demo Kingdom.");
      return text;
    },
    pacing: { perLint: DEMO_DELAYS.perLint, building: DEMO_DELAYS.building },
  };
}
