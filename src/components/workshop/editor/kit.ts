/**
 * The CodeMirror editor behind the Workshop, wrapped in a small handle (see
 * types.ts) so the React components never touch CodeMirror directly.
 *
 * This module is the heavy part of the Workshop and is only downloaded when
 * the Workshop opens (loadKit.ts imports it dynamically).
 *
 * One EditorView shows one file at a time. Every file keeps its own
 * EditorState (text, cursor, undo history) in `states`, a map owned by the
 * Workshop session, so switching tabs or closing and reopening the Workshop
 * brings a file back exactly as it was, undo history included. That is also
 * why the view reports changes through `dispatchTransactions` instead of an
 * update listener inside the state: a cached state must not hold callbacks
 * of a view that no longer exists.
 */
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab, isolateHistory } from "@codemirror/commands";
import { bracketMatching, foldGutter, foldKeymap, indentOnInput } from "@codemirror/language";
import { highlightSelectionMatches, openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { EditorSelection, EditorState, Transaction, type Extension, type StateEffect } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import type { TextEdit } from "@/lib/workspace/contract";
import type { LanguageId } from "../logic/languages";
import { editsToChanges, minimalChange, offsetToPosition, positionToOffset, toUnixBreaks } from "../logic/positions";
import { loadLanguage } from "./languages";
import { lineEndingsOf, textOf } from "./lineEndings";
import { clearPoofsEffect, findingEffects, findingIdsOnLine, monsterGutter, monsterLines, setFindingsEffect } from "./monsters";
import { workshopHighlight, workshopTheme } from "./theme";
import type { EditorHandle, EditorHooks } from "./types";

/** Typing is passed to the Workshop at most this often (ms); a debounce, so long files stay smooth. */
export const TEXT_SYNC_MS = 150;
/** How long the sparkle stays where a monster left (ms). */
export const POOF_MS = 900;
/** Tab width in columns (Python's convention). */
const TAB_SIZE = 4;

/** A file's editor state plus where it was scrolled to. */
interface CachedFile {
  state: EditorState;
  scroll: StateEffect<unknown> | null;
}

/** Hooks of each live view, so extensions inside a (cached, view-independent) state can reach them. */
const viewHooks = new WeakMap<EditorView, EditorHooks>();

/** Everything every file gets, before its language. */
function baseExtensions(): Extension[] {
  return [
    monsterGutter((view, line, ids) => viewHooks.get(view)?.onMonsterClick(line, ids)),
    lineNumbers(),
    foldGutter({ openText: "▾", closedText: "▸" }),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    EditorState.tabSize.of(TAB_SIZE),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true }),
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
    EditorView.contentAttributes.of({ "aria-label": "Code editor" }),
    workshopTheme,
    workshopHighlight,
  ];
}

async function createState(text: string, language: LanguageId): Promise<EditorState> {
  const languageExtension = await loadLanguage(language);
  return EditorState.create({
    doc: text,
    extensions: [baseExtensions(), languageExtension, lineEndingsOf(text)],
  });
}

/** One undoable step that is not merged with the typing before or after it. */
const SEPARATE_STEP = isolateHistory.of("full");

/** Creates the editor inside `parent`. `states` outlives the editor (it belongs to the session). */
export function createEditor(parent: HTMLElement, states: Map<string, unknown>, hooks: EditorHooks): EditorHandle {
  let shown: string | null = null;
  let showTicket = 0;
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  let poofTimer: ReturnType<typeof setTimeout> | null = null;

  const view = new EditorView({
    parent,
    dispatchTransactions(transactions, target) {
      target.update(transactions);
      if (transactions.some((tr) => tr.docChanged)) scheduleTextSync();
      if (transactions.some((tr) => tr.docChanged || tr.selection)) reportCursor();
    },
  });
  viewHooks.set(view, hooks);
  const onScroll = () => hooks.onScroll();
  view.scrollDOM.addEventListener("scroll", onScroll, { passive: true });

  function cached(path: string): CachedFile | undefined {
    return states.get(path) as CachedFile | undefined;
  }

  function syncTextNow() {
    if (syncTimer !== null) clearTimeout(syncTimer);
    syncTimer = null;
    if (shown !== null) hooks.onText(shown, textOf(view.state));
  }

  function scheduleTextSync() {
    if (syncTimer !== null) clearTimeout(syncTimer);
    syncTimer = setTimeout(syncTextNow, TEXT_SYNC_MS);
  }

  function reportCursor() {
    const { line, col } = offsetToPosition(view.state.doc, view.state.selection.main.head);
    hooks.onCursor(line, col);
  }

  /** Remembers the file shown (state and scroll position) before showing another. */
  function stash() {
    if (shown === null) return;
    syncTextNow();
    states.set(shown, { state: view.state, scroll: view.scrollSnapshot() } satisfies CachedFile);
  }

  return {
    async show(path, text, language) {
      const ticket = ++showTicket;
      stash();
      const previous = cached(path);
      const reuse = previous && textOf(previous.state) === text;
      const state = reuse ? previous.state : await createState(text, language);
      // Another file was asked for while the language pack was loading.
      if (ticket !== showTicket) return;
      shown = path;
      view.setState(state);
      if (reuse && previous.scroll) view.dispatch({ effects: previous.scroll });
      states.set(path, { state, scroll: null } satisfies CachedFile);
      reportCursor();
    },

    shownPath: () => shown,

    textOf(path) {
      if (path === shown) return textOf(view.state);
      const previous = cached(path);
      return previous ? textOf(previous.state) : null;
    },

    setFindings(path, checkedText, findings, juice) {
      if (path !== shown || textOf(view.state) !== checkedText) return false;
      view.dispatch({ effects: findingEffects(view.state, findings, juice) });
      if (juice.goneIds.length > 0) {
        if (poofTimer !== null) clearTimeout(poofTimer);
        poofTimer = setTimeout(() => view.dispatch({ effects: clearPoofsEffect.of(null) }), POOF_MS);
      }
      return true;
    },

    applyEdits(edits: readonly TextEdit[]) {
      const changes = editsToChanges(view.state.doc, edits);
      if (changes.length === 0) return;
      view.dispatch({
        changes,
        annotations: [SEPARATE_STEP, Transaction.userEvent.of("input.fix")],
        scrollIntoView: true,
      });
    },

    replaceText(next) {
      // Compared with "\n" breaks on both sides, so the offsets are the editor's own.
      const change = minimalChange(view.state.doc.toString(), toUnixBreaks(next));
      if (!change) return;
      view.dispatch({ changes: change, annotations: [SEPARATE_STEP, Transaction.userEvent.of("input.format")] });
    },

    resetFile(path, text) {
      // The old monsters go too: their places mean nothing in the new text, and the next check brings the right ones.
      const replaceAll = (state: EditorState) => ({
        changes: { from: 0, to: state.doc.length, insert: text },
        effects: setFindingsEffect.of({ findings: [], juice: { freshIds: [], goneIds: [] } }),
        annotations: SEPARATE_STEP,
      });
      if (path === shown) {
        view.dispatch(replaceAll(view.state));
        syncTextNow();
        return;
      }
      const previous = cached(path);
      if (previous) states.set(path, { state: previous.state.update(replaceAll(previous.state)).state, scroll: previous.scroll } satisfies CachedFile);
    },

    forget(path) {
      states.delete(path);
    },

    goTo(line, col = 1) {
      const anchor = positionToOffset(view.state.doc, line, col);
      view.dispatch({
        selection: EditorSelection.cursor(anchor),
        effects: EditorView.scrollIntoView(anchor, { y: "center" }),
      });
      view.focus();
    },

    findingIdsAt: (line) => findingIdsOnLine(view.state, line),

    nextMonsterLine(line, direction) {
      const lines = monsterLines(view.state);
      if (lines.length === 0) return null;
      if (direction === 1) return lines.find((candidate) => candidate > line) ?? lines[0];
      return [...lines].reverse().find((candidate) => candidate < line) ?? lines[lines.length - 1];
    },

    lineBox(line) {
      const docLine = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines));
      const start = view.coordsAtPos(docLine.from);
      if (!start) return null;
      const gutterRight = view.contentDOM.getBoundingClientRect().left;
      return { top: start.top, bottom: start.bottom, left: gutterRight };
    },

    focus: () => view.focus(),

    openSearch() {
      view.focus();
      openSearchPanel(view);
    },

    destroy() {
      stash();
      if (poofTimer !== null) clearTimeout(poofTimer);
      view.scrollDOM.removeEventListener("scroll", onScroll);
      viewHooks.delete(view);
      view.destroy();
    },
  };
}
