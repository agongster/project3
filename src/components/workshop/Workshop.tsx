"use client";

/**
 * The Workshop: a full-window code editor inside the game.
 *
 *   ┌ TopBar: repo › path ............ coins · Lv · Forge · Polish · Back ┐
 *   ├ Explorer ┬ EditorTabs ─────────────────────────────┬ FileSheet ─────┤
 *   │ (village)│ EditorPane (CodeMirror + monsters)      │ Bugs/Grade/    │
 *   │          │   bug card · forge moment · banner      │ Changes/extras │
 *   ├──────────┴─────────────────────────────────────────┴────────────────┤
 *   └ StatusBar: live check · "Ready to forge: 2 fixes" · Ln, Col        ┘
 *
 * This component wires the parts together; the decisions live in logic/
 * (pure, tested), the editor in editor/, and the work of forging and
 * checking in hooks/. Every key pressed in here stops at the Workshop's
 * root, so the game underneath never moves while you type.
 */
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createStore } from "@/lib/game/store";
import { useStore } from "@/lib/game/useStore";
import type { QuickFix } from "@/lib/workspace/contract";
import type { EditorHandle, EditorHooks } from "./editor/types";
import { useEditorSync, type OpenOptions } from "./hooks/useEditorSync";
import { useForging } from "./hooks/useForging";
import { markHelpSeen } from "./hooks/useHelpSeen";
import { useKeysStayHere } from "./hooks/useKeysStayHere";
import { useLiveCheck } from "./hooks/useLiveCheck";
import { useFileLoader, useSession, useWorkspaceLists } from "./hooks/useWorkspaceFiles";
import { forgePreview, forgePreviewText } from "./logic/findingDiff";
import { ancestorFolders } from "./logic/fileTree";
import { LANGUAGE_LABELS, languageForPath } from "./logic/languages";
import { closeTab, dirtyPaths, editBuffer, isDirty } from "./logic/session";
import { commandFor, type WorkshopCommand } from "./logic/shortcuts";
import type { WorkshopExtraTab, WorkshopProps } from "./types";
import { WorkshopPopups, type PopupState } from "./ui/WorkshopPopups";
import { EditorPane } from "./ui/EditorPane";
import { EditorTabs } from "./ui/EditorTabs";
import { Explorer } from "./ui/Explorer";
import { EditorLayers } from "./ui/EditorLayers";
import { StatusBar } from "./ui/StatusBar";
import { TopBar } from "./ui/TopBar";
import { WorkshopSheet, type SheetActions } from "./ui/WorkshopSheet";
import { cardAnchor, downloadFile } from "./ui/placement";
import { cycleRegion, focusFirst } from "./ui/regions";
import "./workshop.css";
import "./ui/editor.css";
import "./ui/popups.css";

/** Repos up to this many files open with every folder expanded. */
const EXPAND_ALL_LIMIT = 60;
/** The same empty list every render, so the file sheet is not redrawn for nothing. */
const NO_EXTRA_TABS: readonly WorkshopExtraTab[] = [];
/** Joins paths into one comparable string (a path can't contain NUL). */
const PATH_SEPARATOR = "\u0000";

export default function Workshop(props: WorkshopProps) {
  const { workspace, save, repoKey, audio, initial, onForged, onClose, extraTabs = NO_EXTRA_TABS } = props;
  const { session, state } = useSession(workspace);
  const { entries, changes } = useWorkspaceLists(workspace);
  const analysis = useStore(workspace.analysis, (a) => a);
  const saveData = useStore(save, (s) => s);

  const [editor, setEditor] = useState<EditorHandle | null>(null);
  // The cursor moves on every key: it lives in its own little store, so only the status bar redraws.
  const [cursor] = useState(() => createStore({ line: 1, col: 1 }));
  const [popup, setPopup] = useState<PopupState>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => {
    const folders = entries.length <= EXPAND_ALL_LIMIT ? entries.flatMap((entry) => ancestorFolders(entry.path)) : [];
    return new Set([...folders, ...ancestorFolders(initial?.path ?? state.active ?? "")]);
  });
  const [welcomeBack] = useState(() => dirtyPaths(session.store.get()).length);

  const rootRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const explorerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const active = state.active;
  const buffer = active !== null ? state.buffers.get(active) : undefined;
  const kinds = useMemo(() => new Map(entries.map((entry) => [entry.path, entry.kind])), [entries]);
  const python = active !== null && kinds.get(active) === "python";
  // Recomputed only when the set of unforged files changes, not on every keystroke.
  const dirtyKey = dirtyPaths(state).join(PATH_SEPARATOR);
  const dirtyList = useMemo(() => (dirtyKey === "" ? [] : dirtyKey.split(PATH_SEPARATOR)), [dirtyKey]);
  const dirty = useMemo(() => new Set(dirtyList), [dirtyList]);

  const loader = useFileLoader(workspace, active);
  const check = useLiveCheck(workspace, active, buffer?.text ?? null, buffer?.saved ?? null, python);
  const forging = useForging({
    workspace,
    session,
    editor,
    audio,
    onForged,
    initialTick: welcomeBack > 0 ? `Welcome back: your unforged typing in ${welcomeBack} ${welcomeBack === 1 ? "file" : "files"} is still here` : null,
  });
  const liveFindings = check.live?.check.findings ?? null;
  const sync = useEditorSync({ editor, session, active, buffer, live: check.live });
  const shownPath = sync.shownPath;
  const loaded = buffer !== undefined;

  // Open the file the game asked for, once: `initial` is where the Workshop opens, not a live setting.
  const openInitial = useEffectEvent(() => {
    if (initial) sync.openFile(initial.path, { line: initial.line, focus: true });
  });
  useEffect(() => openInitial(), []);

  // Take the keyboard when the Workshop opens, so no key lands on the game behind it.
  useEffect(() => {
    if (rootRef.current?.contains(document.activeElement)) return;
    if (!focusFirst(explorerRef.current, ['[role="treeitem"][tabindex="0"]', "input"])) rootRef.current?.focus();
  }, []);

  useKeysStayHere();

  // ───────────────────────────── Actions ─────────────────────────────

  const syncOpenFile = sync.openFile;
  const openFile = useCallback(
    (path: string, options: OpenOptions = {}) => {
      setExpanded((previous) => new Set([...previous, ...ancestorFolders(path)]));
      syncOpenFile(path, options);
    },
    [syncOpenFile],
  );
  const toggleFolder = useCallback((path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  }, []);
  const openFromExplorer = useCallback((path: string) => openFile(path, { focus: true }), [openFile]);

  const repoName = analysis.repo.repo;
  const sheetActions = useMemo<SheetActions>(
    () => ({
      onJump: (line, col) => editor?.goTo(line, col),
      onOpen: (path, line) => openFile(path, { line, focus: true }),
      onDiff: (path) => setPopup({ kind: "diff", path }),
      onRevert: (path) => setPopup({ kind: "revert", path }),
      onDownloadPatch: () => downloadFile(`${repoName}.patch`, workspace.exportPatch(), "text/x-diff"),
      onDownloadZip: () => downloadFile(`${repoName}-changes.zip`, workspace.exportZip(), "application/zip"),
    }),
    [editor, openFile, workspace, repoName],
  );

  /**
   * Puts the keyboard back in the Workshop when the element that had it
   * disappeared (a Revert button whose file is no longer changed…): on the
   * page body, keys would go to the game instead.
   */
  function rescueFocus() {
    const now = document.activeElement;
    if (now && now !== document.body && rootRef.current?.contains(now)) return;
    if (editor && shownPath !== null) editor.focus();
    else rootRef.current?.focus();
  }

  function forgeActive() {
    if (active === null || !loaded) return;
    void forging.forge([active]);
  }

  /** Every file with unforged typing, including the one in front if its last keystrokes haven't reached the session yet. */
  function forgeAll() {
    const activeText = active !== null ? (editor?.textOf(active) ?? null) : null;
    const activeChanged = active !== null && activeText !== null && buffer !== undefined && activeText !== buffer.saved;
    void forging.forge(activeChanged && !dirtyList.includes(active) ? [...dirtyList, active] : dirtyList);
  }

  async function polish() {
    if (!python || active === null || !editor || editor.shownPath() !== active) return;
    const before = editor.textOf(active) ?? "";
    try {
      const formatted = await workspace.format(before);
      if (editor.shownPath() !== active || editor.textOf(active) !== before) return;
      editor.replaceText(formatted);
      audio.sfx(formatted === before ? "uiMove" : "equip");
      forging.say(formatted === before ? "Already polished ✓" : "Polished ✓ (undo with Ctrl/Cmd+Z)");
    } catch (error) {
      audio.sfx("error");
      forging.say(error instanceof Error ? error.message : "Polish could not tidy this code.", "warn");
    }
  }

  function openCardAt(line: number, ids: readonly string[]) {
    const area = paneRef.current;
    if (!editor || !area) return;
    const anchor = cardAnchor(editor.lineBox(line), area.getBoundingClientRect());
    setPopup({ kind: "bug", line, ids: [...ids], anchor });
  }

  function applyFixScroll(fix: QuickFix) {
    const live = check.live;
    if (!editor || active === null || !live || editor.textOf(active) !== live.text) {
      forging.say("The code just changed: wait a moment for a fresh check", "warn");
      return;
    }
    editor.applyEdits(fix.edits);
    setPopup(null);
    editor.focus();
    audio.sfx("equip");
    forging.say("Fix scroll used! Forge to make it real");
  }

  function jumpToBug(direction: 1 | -1) {
    if (!editor) return;
    const line = editor.nextMonsterLine(cursor.get().line, direction);
    if (line !== null) editor.goTo(line);
  }

  function run(command: WorkshopCommand) {
    switch (command) {
      case "forge":
        return forgeActive();
      case "forgeAll":
        return forgeAll();
      case "quickOpen":
        return setPopup({ kind: "quickOpen" });
      case "search":
        return shownPath !== null && shownPath === active ? editor?.openSearch() : undefined;
      case "bugCard": {
        const line = cursor.get().line;
        const ids = editor?.findingIdsAt(line) ?? [];
        return ids.length > 0 ? openCardAt(line, ids) : forging.say("No monster on this line", "warn");
      }
      case "nextBug":
        return jumpToBug(1);
      case "previousBug":
        return jumpToBug(-1);
      case "polish":
        return void polish();
      case "nextRegion":
      case "previousRegion":
        return cycleRegion(regions(), command === "nextRegion" ? 1 : -1);
      case "back":
        return onClose();
    }
  }

  function regions() {
    return [
      { element: explorerRef.current, focus: () => focusFirst(explorerRef.current, ['[role="treeitem"][tabindex="0"]', "input"]) },
      { element: paneRef.current, focus: () => (editor && shownPath ? editor.focus() : focusFirst(paneRef.current, ["button"])) },
      { element: sheetRef.current, focus: () => focusFirst(sheetRef.current, ['[role="tab"][aria-selected="true"]']) },
      { element: rootRef.current?.querySelector<HTMLElement>(".ws-top") ?? null, focus: () => focusFirst(rootRef.current, ["[data-ws-primary]", ".ws-actions button"]) },
    ];
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // The game listens on window: nothing typed here may reach it.
    event.stopPropagation();
    if (event.nativeEvent.defaultPrevented) return;
    const command = commandFor(event);
    if (!command) return;
    // Also keeps the browser's own Ctrl+S / Ctrl+P (save page, print) away while a popup is open.
    event.preventDefault();
    if (popup === null) run(command);
  }

  const editorHooks: EditorHooks = {
    onText: (path, text) => session.store.set((s) => editBuffer(s, path, text)),
    onCursor: (line, col) => cursor.set({ line, col }),
    onMonsterClick: (line, ids) => openCardAt(line, ids),
    onScroll: () => {
      if (popup?.kind === "bug" && editor && paneRef.current) {
        setPopup({ ...popup, anchor: cardAnchor(editor.lineBox(popup.line), paneRef.current.getBoundingClientRect()) });
      }
    },
  };

  // ───────────────────────────── Drawing ─────────────────────────────

  // "Ready to forge: 2 fixes": the live findings against those of the saved text.
  const bugsNow = check.live?.check.findings.map((item) => item.finding) ?? [];
  const bugsSaved = check.baseline?.check.findings.map((item) => item.finding) ?? bugsNow;
  const preview = buffer === undefined ? null : forgePreviewText(forgePreview(bugsSaved, bugsNow), isDirty(buffer));
  const covered = active === null || !loaded || shownPath !== active;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="ws-root"
      role="dialog"
      aria-modal="true"
      aria-label="Workshop: the code editor"
      onKeyDown={onKeyDown}
      onKeyUp={(event) => event.stopPropagation()}
      onBlur={(event) => {
        if (event.relatedTarget === null) window.setTimeout(rescueFocus, 0);
      }}
    >
      <TopBar
        repoName={`${analysis.repo.owner}/${analysis.repo.repo}`}
        activePath={active}
        save={save}
        canForge={loaded}
        hot={isDirty(buffer)}
        dirtyCount={dirtyList.length}
        canPolish={python && loaded}
        busy={forging.busy}
        onForge={forgeActive}
        onForgeAll={forgeAll}
        onPolish={() => void polish()}
        onHelp={() => setPopup({ kind: "help" })}
        onBack={onClose}
      />
      <div className="ws-main">
        <div ref={explorerRef} className="ws-explorer-slot">
          <Explorer
            entries={entries}
            analysis={analysis}
            save={saveData}
            repoKey={repoKey}
            active={active}
            dirty={dirty}
            expanded={expanded}
            onToggleFolder={toggleFolder}
            onOpen={openFromExplorer}
          />
        </div>
        <section className="ws-center" aria-label="Editor">
          <EditorTabs
            tabs={state.tabs}
            active={active}
            dirty={dirty}
            onSelect={(path, fromKeyboard) => openFile(path, { focus: !fromKeyboard })}
            onClose={(path) => session.store.set((s) => closeTab(s, path))}
          />
          <EditorPane ref={paneRef} editorStates={session.editorStates} hooks={editorHooks} onReady={setEditor} covered={covered}>
            <EditorLayers
              active={active}
              loaded={loaded}
              loadError={loader.error}
              onRetry={loader.retry}
              moment={forging.moment}
              onMomentDone={forging.dismissMoment}
              tick={forging.tick}
            />
          </EditorPane>
        </section>
        <div ref={sheetRef} className="ws-sheet-slot">
          <WorkshopSheet
            python={python}
            path={loaded ? active : null}
            live={check.live}
            status={check.status}
            dirty={isDirty(buffer)}
            changes={changes}
            dirtyCount={dirtyList.length}
            busy={forging.busy}
            extraTabs={extraTabs}
            actions={sheetActions}
          />
        </div>
      </div>
      <StatusBar
        hasFile={loaded}
        checkStatus={check.status}
        forgeText={preview}
        tick={forging.tick}
        cursor={cursor}
        language={active ? LANGUAGE_LABELS[languageForPath(active)] : ""}
        dirtyCount={dirtyList.length}
      />
      <WorkshopPopups
        popup={popup}
        entries={entries}
        changes={changes}
        liveFindings={liveFindings}
        fixReady={check.fresh}
        onClose={() => setPopup(null)}
        onOpen={(path) => {
          setPopup(null);
          openFile(path, { focus: true });
        }}
        onUseFix={applyFixScroll}
        onRevert={(path) => {
          setPopup(null);
          void forging.revert(path).then(rescueFocus);
        }}
        onDismissHelp={() => {
          markHelpSeen();
          setPopup(null);
          // The "Got it" button that had the keyboard disappears with the popup: once it is gone, take the focus back.
          requestAnimationFrame(rescueFocus);
        }}
      />
    </div>
  );
}
