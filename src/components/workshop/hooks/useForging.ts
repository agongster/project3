/**
 * Forging (saving) and reverting, and the moment that follows.
 *
 *   forge(paths) ─► workspace.forge(path, text) ─► onForged(report) ─► the moment
 *                   (the world updates)             (the game pays)     (banished monsters,
 *                                                                        purified banner, …)
 *
 * The text forged is read straight from the editor, so the last keystrokes
 * count even if they have not reached the session yet. Typing during a forge
 * is fine: whatever was typed after the text was read stays unforged.
 */
import { useState } from "react";
import type { AudioApi } from "@/game/bridge";
import type { ForgeReport, Workspace } from "@/lib/workspace/contract";
import type { EditorHandle } from "../editor/types";
import { describeForge, gradeImproved, mergeMoments, type ForgeMoment } from "../logic/forgeMoment";
import { editBuffer, markForged, resetBuffer, type WorkshopSession } from "../logic/session";
import type { ForgeRewards } from "../types";

/** A moment on screen; `id` restarts its animations when a new one replaces it. */
export interface ShownMoment {
  id: number;
  /** True after a revert (bugs "are back" rather than "crept in"). */
  reverted: boolean;
  moment: ForgeMoment;
}

/** A short line in the status bar ("Forged README.md ✓"). */
export interface Tick {
  id: number;
  text: string;
  tone: "good" | "warn";
}

interface ForgingOptions {
  workspace: Workspace;
  session: WorkshopSession;
  editor: EditorHandle | null;
  audio: AudioApi;
  onForged?: (report: ForgeReport) => ForgeRewards | void;
  /** A line for the status bar when the Workshop opens ("Welcome back…"), or null. */
  initialTick: string | null;
}

/** Delay between the sounds of a celebration (ms), so they read as a little tune. */
const SOUND_STEP_MS = 140;

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function useForging({ workspace, session, editor, audio, onForged, initialTick }: ForgingOptions) {
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<ShownMoment | null>(null);
  const [tick, setTick] = useState<Tick | null>(() => (initialTick ? { id: 0, text: initialTick, tone: "good" } : null));

  function say(text: string, tone: Tick["tone"] = "good") {
    setTick({ id: Date.now(), text, tone });
  }

  function playSounds(moment: ForgeMoment) {
    const sounds: Parameters<AudioApi["sfx"]>[0][] = [];
    if (moment.banished.length > 0) sounds.push("squash", "coin");
    if (moment.grades.some((grade) => gradeImproved(grade.from, grade.to))) sounds.push("levelUp");
    if (moment.purified.length > 0) sounds.push("purify");
    if (sounds.length === 0) sounds.push("uiSelect");
    sounds.forEach((name, i) => window.setTimeout(() => audio.sfx(name), i * SOUND_STEP_MS));
  }

  function present(reverted: boolean, moment: ForgeMoment, quietText: string) {
    if (moment.quiet) {
      audio.sfx("uiMove");
      say(quietText);
      return;
    }
    playSounds(moment);
    setShown({ id: Date.now(), reverted, moment });
    say(quietText);
  }

  /** Forges each path in turn and plays one moment for all of them. */
  async function forge(paths: readonly string[]) {
    if (busy || paths.length === 0) return;
    setBusy(true);
    const moments: ForgeMoment[] = [];
    try {
      for (const path of paths) {
        const buffer = session.store.get().buffers.get(path);
        if (!buffer) continue;
        const text = editor?.textOf(path) ?? buffer.text;
        const report = await workspace.forge(path, text);
        session.store.set((state) => markForged(editBuffer(state, path, text), path, text));
        moments.push(describeForge(report, onForged?.(report)));
      }
      const label = paths.length === 1 ? fileName(paths[0]) : `${paths.length} files`;
      present(false, mergeMoments(moments), `Forged ${label} ✓`);
    } catch (error) {
      audio.sfx("error");
      // Nothing was saved (a forge is all or nothing): the typing stays unforged, and the workspace's message says why.
      say(error instanceof Error ? error.message : "The forge failed, so nothing was saved.", "warn");
    } finally {
      setBusy(false);
    }
  }

  /** Puts a file back to its original text (the caller has already asked for confirmation). */
  async function revert(path: string) {
    if (busy) return;
    setBusy(true);
    try {
      const report = await workspace.revert(path);
      const original = session.store.get().buffers.get(path)?.original ?? (await workspace.read(path)).original;
      session.store.set((state) => resetBuffer(state, path, original));
      editor?.resetFile(path, original);
      present(true, describeForge(report, onForged?.(report)), `Reverted ${fileName(path)}`);
    } catch (error) {
      audio.sfx("error");
      say(error instanceof Error ? error.message : "The revert failed, so nothing changed.", "warn");
    } finally {
      setBusy(false);
    }
  }

  return { busy, forge, revert, moment: shown, dismissMoment: () => setShown(null), tick, say };
}
