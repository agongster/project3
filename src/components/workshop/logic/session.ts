/**
 * The Workshop's memory for one workspace: which files are open as tabs,
 * which one is in front, and the text of every buffer, including text the
 * player typed but has not forged yet.
 *
 * It lives *outside* the React tree (see `sessionFor`), so closing the
 * Workshop and opening it again, or switching between tabs, never loses
 * unsaved typing. It is not written to localStorage: only forged text is
 * kept across page reloads, by the workspace itself.
 *
 * Everything below `sessionFor` is a pure function `(state, …) → new state`.
 */
import { createStore } from "@/lib/game/store";
import type { Store } from "@/lib/types";
import type { FileText } from "@/lib/workspace/contract";

/** One file the editor has loaded. */
export interface Buffer {
  /** The text in the repo at this commit. */
  original: string;
  /** The text as last forged. */
  saved: string;
  /** The text in the editor right now (may be ahead of `saved`). */
  text: string;
}

export interface SessionState {
  /** Paths open as tabs, left to right. */
  tabs: readonly string[];
  /** The tab in front, or null when none is open. */
  active: string | null;
  /** Loaded files by path. A Map, so a file called "constructor" is just a file. */
  buffers: ReadonlyMap<string, Buffer>;
}

export interface WorkshopSession {
  store: Store<SessionState>;
  /**
   * The editor's own per-file state (CodeMirror's EditorState, which also
   * holds the undo history). Opaque here so this file does not import the
   * editor library; only the editor glue reads it.
   */
  editorStates: Map<string, unknown>;
}

export const EMPTY_SESSION: SessionState = { tabs: [], active: null, buffers: new Map() };

/** One session per workspace object, created on first use and forgotten with the workspace. */
const sessions = new WeakMap<object, WorkshopSession>();

export function sessionFor(workspace: object): WorkshopSession {
  let session = sessions.get(workspace);
  if (!session) {
    session = { store: createStore<SessionState>(EMPTY_SESSION), editorStates: new Map() };
    sessions.set(workspace, session);
  }
  return session;
}

// ───────────────────────────── Questions ─────────────────────────────

/** True when the buffer holds typing that has not been forged. */
export function isDirty(buffer: Buffer | undefined): boolean {
  return buffer !== undefined && buffer.text !== buffer.saved;
}

/** Paths with unforged typing, in tab order first, then any closed ones. */
export function dirtyPaths(state: SessionState): string[] {
  const dirty = [...state.buffers].filter(([, buffer]) => isDirty(buffer)).map(([path]) => path);
  const open = state.tabs.filter((path) => dirty.includes(path));
  return [...open, ...dirty.filter((path) => !state.tabs.includes(path))];
}

// ───────────────────────────── Changes ─────────────────────────────

function withBuffer(state: SessionState, path: string, buffer: Buffer): SessionState {
  const buffers = new Map(state.buffers);
  buffers.set(path, buffer);
  return { ...state, buffers };
}

/** Opens `path` as a tab (at the end, if it is not open yet) and brings it to the front. */
export function openTab(state: SessionState, path: string): SessionState {
  const tabs = state.tabs.includes(path) ? state.tabs : [...state.tabs, path];
  if (tabs === state.tabs && state.active === path) return state;
  return { ...state, tabs, active: path };
}

/**
 * Closes a tab. The buffer is kept, so unforged typing is still there when
 * the file is opened again. The neighbour to the right (or else the left)
 * comes to the front.
 */
export function closeTab(state: SessionState, path: string): SessionState {
  const index = state.tabs.indexOf(path);
  if (index < 0) return state;
  const tabs = state.tabs.filter((tab) => tab !== path);
  const active = state.active !== path ? state.active : (tabs[index] ?? tabs[index - 1] ?? null);
  return { ...state, tabs, active };
}

/**
 * Remembers a file the workspace just read. A buffer that already exists
 * keeps its unforged text; only the original and saved versions are updated.
 */
export function loadBuffer(state: SessionState, path: string, file: FileText): SessionState {
  const existing = state.buffers.get(path);
  const text = existing && isDirty(existing) ? existing.text : file.saved;
  if (existing && existing.original === file.original && existing.saved === file.saved && existing.text === text) return state;
  return withBuffer(state, path, { original: file.original, saved: file.saved, text });
}

/** The player typed: the buffer's current text changes. */
export function editBuffer(state: SessionState, path: string, text: string): SessionState {
  const buffer = state.buffers.get(path);
  if (!buffer || buffer.text === text) return state;
  return withBuffer(state, path, { ...buffer, text });
}

/**
 * `forgedText` was forged. Typing that happened while the forge was running
 * stays unforged, so `text` is left alone.
 */
export function markForged(state: SessionState, path: string, forgedText: string): SessionState {
  const buffer = state.buffers.get(path);
  if (!buffer) return state;
  return withBuffer(state, path, { ...buffer, saved: forgedText });
}

/** The file was reverted: every version is the original again. */
export function resetBuffer(state: SessionState, path: string, original: string): SessionState {
  if (!state.buffers.has(path)) return state;
  return withBuffer(state, path, { original, saved: original, text: original });
}
