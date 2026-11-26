"use client";

/**
 * The editor area: downloads the editor (CodeMirror) the first time it
 * mounts, creates it, and hands its handle up with `onReady`. Whatever the
 * Workshop wants on top of the code (loading and error states, the bug card,
 * the forge moment) comes in as `children` and is layered over it.
 *
 * The editor itself stays mounted while files load or fail, so switching
 * files never rebuilds it.
 */
import { useEffect, useEffectEvent, useRef, useState, type ReactNode, type Ref } from "react";
import { PixelButton } from "@/components/ui/kit";
import { loadEditorKit } from "../editor/loadKit";
import type { EditorHandle, EditorHooks } from "../editor/types";

interface EditorPaneProps {
  /** The session's per-file editor states (kept when the Workshop closes). */
  editorStates: Map<string, unknown>;
  hooks: EditorHooks;
  onReady: (editor: EditorHandle | null) => void;
  /** Hide the code (no file, or the file is loading / failed). */
  covered: boolean;
  children?: ReactNode;
  /** The area's element (the Workshop places popups relative to it). */
  ref?: Ref<HTMLDivElement>;
}

export function EditorPane({ editorStates, hooks, onReady, covered, children, ref }: EditorPaneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [kitError, setKitError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const onText = useEffectEvent((path: string, text: string) => hooks.onText(path, text));
  const onCursor = useEffectEvent((line: number, col: number) => hooks.onCursor(line, col));
  const onMonsterClick = useEffectEvent((line: number, ids: string[]) => hooks.onMonsterClick(line, ids));
  const onScroll = useEffectEvent(() => hooks.onScroll());
  const ready = useEffectEvent((editor: EditorHandle | null) => onReady(editor));

  useEffect(() => {
    let editor: EditorHandle | null = null;
    let cancelled = false;
    loadEditorKit()
      .then((kit) => {
        const host = hostRef.current;
        if (cancelled || !host) return;
        editor = kit.createEditor(host, editorStates, {
          onText: (path, text) => onText(path, text),
          onCursor: (line, col) => onCursor(line, col),
          onMonsterClick: (line, ids) => onMonsterClick(line, ids),
          onScroll: () => onScroll(),
        });
        ready(editor);
      })
      .catch(() => {
        if (!cancelled) setKitError("The editor could not be downloaded. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
      if (editor) {
        ready(null);
        editor.destroy();
      }
    };
  }, [editorStates, attempt]);

  return (
    <div ref={ref} className="ws-editor-area">
      <div ref={hostRef} className={`ws-editor-host${covered ? " ws-covered" : ""}`} />
      {kitError && (
        <div className="ws-editor-state">
          <p>{kitError}</p>
          <PixelButton
            tone="gold"
            small
            onClick={() => {
              setKitError(null);
              setAttempt((n) => n + 1);
            }}
          >
            Retry
          </PixelButton>
        </div>
      )}
      {children}
    </div>
  );
}
