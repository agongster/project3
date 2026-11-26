"use client";

/**
 * Workshop test page (/dev/workshop): the gamified editor on the offline Demo
 * Kingdom, over a stand-in for the paused game.
 *
 *   /dev/workshop                         the "world", with a button (or W) to open the Workshop
 *   /dev/workshop?open=bakery/orders.py   open the Workshop on a file straight away (&line=4)
 *   /dev/workshop?persist=1               keep forged edits in localStorage (default: memory only)
 *   /dev/workshop?quests=0                without the Quests tab (an `extraTabs` example)
 *   /dev/workshop?repo=psf/requests       a real GitHub repo instead of the demo (costs API calls)
 *
 * The save lives in memory only, so poking around here never touches your
 * real progress. The "world" counts every key that reaches it while the
 * Workshop is open: that number must stay 0.
 *
 * For scripts: `window.__workshop` has the save, the workspace and that count.
 */
import { useEffect, useMemo, useState } from "react";
import { Workshop, preloadWorkshop } from "@/components/workshop";
import { PixelButton, KeyCap } from "@/components/ui/kit";
import type { RepoAnalysis, SaveData, Store } from "@/lib/types";
import { openWorkspace, type Workspace, type WorkspaceTarget } from "@/lib/workspace";
import { repoKey } from "@/game/bridge";
import { createDevSave, devAudio, devRewards } from "./devServices";
import { questsExtraTab } from "./QuestsTab";

declare global {
  interface Window {
    __workshop?: { save: () => SaveData; workspace: Workspace; keysReachingWorld: () => string[]; analysis: () => RepoAnalysis };
  }
}

interface Loaded {
  workspace: Workspace;
  save: Store<SaveData>;
  key: string;
  quests: boolean;
}

/** Keys that reached the window while the Workshop was open (must stay empty), as "key on element". */
const keysReachingWorld: string[] = [];

export default function WorkshopDevPage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [status, setStatus] = useState("Building the Demo Kingdom…");
  const [open, setOpen] = useState<{ path: string; line?: number } | true | null>(null);
  const [worldKeys, setWorldKeys] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const controller = new AbortController();
    const persist = params.get("persist") === "1";
    const [owner, repo] = (params.get("repo") ?? "").split("/");
    const target: WorkspaceTarget = owner && repo ? { kind: "repo", owner, repo } : { kind: "demo" };
    openWorkspace(target, (progress) => setStatus(progress.label), controller.signal, persist ? {} : { storage: null, sleep: async () => undefined })
      .then((workspace) => {
        const save = createDevSave();
        const key = repoKey(workspace.analysis.get());
        setLoaded({ workspace, save, key, quests: params.get("quests") !== "0" });
        window.__workshop = { save: () => save.get(), workspace, keysReachingWorld: () => [...keysReachingWorld], analysis: () => workspace.analysis.get() };
        const file = params.get("open");
        if (file) setOpen({ path: file, line: params.has("line") ? Number(params.get("line")) : undefined });
      })
      .catch((error: unknown) => setStatus(`Could not open the demo: ${error instanceof Error ? error.message : String(error)}`));
    return () => controller.abort();
  }, []);

  const extraTabs = useMemo(() => (loaded?.quests ? [questsExtraTab(loaded.workspace, loaded.save, loaded.key)] : []), [loaded]);

  // The stand-in world: W opens the Workshop; any key that arrives while it is open is counted.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (open !== null) {
        const target = event.target instanceof HTMLElement ? event.target.tagName.toLowerCase() : "?";
        keysReachingWorld.push(`${event.key} on ${target}`);
        setWorldKeys(keysReachingWorld.length);
        return;
      }
      if (event.key === "w" && loaded) setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loaded]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-night p-6 text-cream">
      <h1 className="font-title text-lg text-gold">The world (paused)</h1>
      <p>{loaded ? `${loaded.workspace.entries().length} files in ${loaded.key}` : status}</p>
      <p className="text-sm opacity-75" data-testid="world-keys">
        Keys that reached the world while the Workshop was open: {worldKeys}
      </p>
      {loaded && (
        <PixelButton tone="gold" onMouseEnter={preloadWorkshop} onClick={() => setOpen(true)}>
          Open the Workshop <KeyCap>W</KeyCap>
        </PixelButton>
      )}
      {loaded && open !== null && (
        <Workshop
          workspace={loaded.workspace}
          save={loaded.save}
          repoKey={loaded.key}
          audio={devAudio}
          initial={open === true ? undefined : open}
          onForged={(report) => devRewards(loaded.save, loaded.key, report)}
          onClose={() => setOpen(null)}
          extraTabs={extraTabs}
        />
      )}
    </main>
  );
}
