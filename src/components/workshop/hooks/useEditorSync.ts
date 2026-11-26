/**
 * Keeps the editor in step with the Workshop's state:
 *
 *   - the active tab's file is shown once its text is loaded;
 *   - "open this file at line 12" waits until the file is on screen;
 *   - every new live check is handed to the gutter, with the little
 *     arrive / leave effects for monsters that came or went since the last one.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveFinding } from "@/lib/workspace/contract";
import type { EditorFinding, EditorHandle, MarkerJuice } from "../editor/types";
import { matchFindings } from "../logic/findingDiff";
import { languageForPath } from "../logic/languages";
import { openTab, type Buffer, type WorkshopSession } from "../logic/session";
import type { CheckedText } from "./useLiveCheck";

export interface OpenOptions {
  /** 1-based line to put the cursor on. */
  line?: number;
  /** Move the keyboard into the code. */
  focus?: boolean;
}

interface SyncOptions {
  editor: EditorHandle | null;
  session: WorkshopSession;
  active: string | null;
  buffer: Buffer | undefined;
  live: CheckedText | null;
}

function toEditorFindings(findings: readonly LiveFinding[]): EditorFinding[] {
  return findings.map(({ finding, range }) => ({ id: finding.id, monster: finding.monster, severity: finding.severity, title: finding.title, range }));
}

/** Which monsters arrived and which left between two checks of the same file. */
function juiceBetween(previous: readonly LiveFinding[] | null, next: readonly LiveFinding[]): MarkerJuice {
  if (!previous) return { freshIds: [], goneIds: [] };
  const match = matchFindings(
    previous.map((item) => item.finding),
    next.map((item) => item.finding),
  );
  return { freshIds: match.added.map((finding) => finding.id), goneIds: match.gone.map((finding) => finding.id) };
}

export function useEditorSync({ editor, session, active, buffer, live }: SyncOptions) {
  const [shownPath, setShownPath] = useState<string | null>(null);
  /** Where to put the cursor once a file is on screen. */
  const pending = useRef<{ path: string; line?: number; focus: boolean } | null>(null);
  /** The file whose show() is under way, so it is not asked for twice. */
  const showing = useRef<string | null>(null);
  /** The findings last drawn in the gutter, to tell which ones are new. */
  const pushed = useRef<{ path: string; findings: readonly LiveFinding[] } | null>(null);

  // Show the active file in the editor once it is loaded.
  const loaded = buffer !== undefined;
  const bufferText = buffer?.text ?? "";
  useEffect(() => {
    if (!editor || active === null || !loaded) return;
    if (editor.shownPath() === active || showing.current === active) return;
    showing.current = active;
    const path = active;
    editor.show(path, bufferText, languageForPath(path)).then(() => {
      if (showing.current === path) showing.current = null;
      // The editor knows best: a newer show() may have overtaken this one.
      setShownPath(editor.shownPath());
    });
  }, [editor, active, loaded, bufferText]);

  // Once a file is on screen (and visible), put the cursor where it was asked for.
  useEffect(() => {
    const wanted = pending.current;
    if (!editor || shownPath === null || wanted?.path !== shownPath) return;
    pending.current = null;
    if (wanted.line !== undefined) editor.goTo(wanted.line);
    else if (wanted.focus) editor.focus();
  }, [editor, shownPath]);

  // Hand each new live check to the gutter.
  useEffect(() => {
    if (!editor || !live || shownPath !== live.path) return;
    const previous = pushed.current?.path === live.path ? pushed.current.findings : null;
    if (editor.setFindings(live.path, live.text, toEditorFindings(live.check.findings), juiceBetween(previous, live.check.findings))) {
      pushed.current = { path: live.path, findings: live.check.findings };
    }
  }, [editor, live, shownPath]);

  /** Opens `path` as the active tab (and moves the cursor there when asked). Stable between renders. */
  const openFile = useCallback(
    (path: string, options: OpenOptions = {}) => {
      if (editor?.shownPath() === path && session.store.get().active === path) {
        if (options.line !== undefined) editor.goTo(options.line);
        else if (options.focus) editor.focus();
        return;
      }
      pending.current = { path, line: options.line, focus: options.focus ?? false };
      session.store.set((state) => openTab(state, path));
    },
    [editor, session],
  );

  return { shownPath, openFile };
}
