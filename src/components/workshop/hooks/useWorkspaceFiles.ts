/**
 * The workspace as React state: its file list and changes (refreshed after
 * every forge and revert), its live analysis, the Workshop session (tabs and
 * buffers), and the reading of files into buffers.
 */
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/game/useStore";
import type { Workspace } from "@/lib/workspace/contract";
import { loadBuffer, sessionFor } from "../logic/session";

/** Longest error message shown for a file that failed to load (it can come from the network). */
export const MAX_LOAD_ERROR_LENGTH = 200;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** `entries()` and `changes()`, re-read whenever the workspace reports a forge or revert. */
export function useWorkspaceLists(workspace: Workspace) {
  const [lists, setLists] = useState(() => ({ entries: workspace.entries(), changes: workspace.changes() }));
  useEffect(
    () =>
      workspace.subscribe(() => {
        setLists({ entries: workspace.entries(), changes: workspace.changes() });
      }),
    [workspace],
  );
  return lists;
}

/** The session (tabs and buffers) of this workspace, as React state. */
export function useSession(workspace: Workspace) {
  const session = sessionFor(workspace);
  const state = useStore(session.store, (s) => s);
  return { session, state };
}

/**
 * Reads the active file into its buffer when it has none yet. A file that
 * fails to load gets an error message (shown with a Retry button) instead.
 */
export function useFileLoader(workspace: Workspace, active: string | null) {
  const session = sessionFor(workspace);
  const loaded = useStore(session.store, (s) => (active !== null ? s.buffers.has(active) : true));
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(new Map());
  const reading = useRef(new Set<string>());
  const failed = active !== null && errors.has(active);

  useEffect(() => {
    if (active === null || loaded || failed || reading.current.has(active)) return;
    const path = active;
    reading.current.add(path);
    workspace
      .read(path)
      .then((file) => session.store.set((s) => loadBuffer(s, path, file)))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "This file could not be opened.";
        setErrors((previous) => new Map(previous).set(path, clip(message, MAX_LOAD_ERROR_LENGTH)));
      })
      .finally(() => reading.current.delete(path));
  }, [workspace, session, active, loaded, failed]);

  /** Forgets the error so the next render tries again. */
  function retry(path: string) {
    setErrors((previous) => {
      const next = new Map(previous);
      next.delete(path);
      return next;
    });
  }

  return { error: active !== null ? (errors.get(active) ?? null) : null, retry };
}
