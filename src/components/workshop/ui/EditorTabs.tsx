"use client";

/**
 * The open files as tabs above the editor. A dot marks unforged typing;
 * closing a tab never throws that typing away (it waits in the session).
 * Left/Right move between tabs, Delete closes the focused one.
 */
import type { KeyboardEvent } from "react";
import { clip } from "./bits";

/** Longest file name on a tab. */
const MAX_TAB_LABEL = 32;

interface EditorTabsProps {
  tabs: readonly string[];
  active: string | null;
  dirty: ReadonlySet<string>;
  /** `fromKeyboard`: chosen with the arrow keys, so the keyboard stays on the tabs. */
  onSelect: (path: string, fromKeyboard: boolean) => void;
  onClose: (path: string) => void;
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function EditorTabs({ tabs, active, dirty, onSelect, onClose }: EditorTabsProps) {
  if (tabs.length === 0) return <div className="ws-tabs ws-tabs-empty" />;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.indexOf(active ?? "");
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step !== 0) {
      event.preventDefault();
      const next = tabs[(index + step + tabs.length) % tabs.length];
      onSelect(next, true);
      event.currentTarget.querySelector<HTMLElement>(`[data-tab="${CSS.escape(next)}"]`)?.focus();
    } else if (event.key === "Delete" && active) {
      event.preventDefault();
      onClose(active);
    }
  }

  return (
    <div className="ws-tabs" role="tablist" aria-label="Open files" onKeyDown={onKeyDown}>
      {tabs.map((path) => {
        const selected = path === active;
        const unsaved = dirty.has(path);
        return (
          <div key={path} className={`ws-tab${selected ? " ws-tab-active" : ""}`} title={path}>
            <button
              type="button"
              role="tab"
              data-tab={path}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className="ws-tab-label"
              onClick={(event) => onSelect(path, event.detail === 0)}
            >
              {clip(fileName(path), MAX_TAB_LABEL)}
              {unsaved && <span className="ws-dirty-dot" aria-label="unforged typing" />}
            </button>
            <button type="button" className="ws-tab-close" tabIndex={-1} aria-label={`Close ${fileName(path)}`} onClick={() => onClose(path)}>
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
