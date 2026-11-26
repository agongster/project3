"use client";

/**
 * The file sheet: the right-hand side panel with one tab per view of the
 * work (Bugs, Grade, Changes) plus any tabs other features add (the Quests
 * panel arrives as an `extraTab`). Left/Right move between the tabs.
 */
import { useState, type KeyboardEvent, type ReactNode } from "react";
import type { WorkshopExtraTab, WorkshopTabContext } from "../../types";

/** The built-in tabs. */
export type SheetTabId = "bugs" | "grade" | "changes";

interface FileSheetProps {
  /** The content of each built-in tab. */
  panels: Readonly<Record<SheetTabId, ReactNode>>;
  /** Small counts shown on the tab buttons. */
  badges: Partial<Record<SheetTabId, number>>;
  extraTabs: readonly WorkshopExtraTab[];
  context: WorkshopTabContext;
}

const BUILT_IN: readonly { id: SheetTabId; label: string }[] = [
  { id: "bugs", label: "Bugs" },
  { id: "grade", label: "Grade" },
  { id: "changes", label: "Changes" },
];

export function FileSheet({ panels, badges, extraTabs, context }: FileSheetProps) {
  const [chosen, setChosen] = useState<string>("bugs");
  const tabs = [...BUILT_IN.map((tab) => ({ id: tab.id as string, label: tab.label })), ...extraTabs.map((tab) => ({ id: tab.id, label: tab.label }))];
  const active = tabs.some((tab) => tab.id === chosen) ? chosen : "bugs";
  const extra = extraTabs.find((tab) => tab.id === active);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === active);
    const next = tabs[(index + step + tabs.length) % tabs.length];
    setChosen(next.id);
    event.currentTarget.querySelector<HTMLElement>(`[data-sheet-tab="${CSS.escape(next.id)}"]`)?.focus();
  }

  return (
    <aside className="ws-sheet" aria-label="File sheet">
      <div className="ws-sheet-tabs" role="tablist" aria-label="File sheet" onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const count = badges[tab.id as SheetTabId];
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`ws-sheet-tab-${tab.id}`}
              data-sheet-tab={tab.id}
              aria-selected={tab.id === active}
              aria-controls="ws-sheet-panel"
              tabIndex={tab.id === active ? 0 : -1}
              className={`ws-sheet-tab${tab.id === active ? " ws-sheet-tab-active" : ""}`}
              onClick={() => setChosen(tab.id)}
            >
              {tab.label}
              {count !== undefined && count > 0 && <span className="ws-tab-count">{count}</span>}
            </button>
          );
        })}
      </div>
      <div id="ws-sheet-panel" role="tabpanel" aria-labelledby={`ws-sheet-tab-${active}`} className="ws-sheet-body px-scroll">
        {extra ? extra.render(context) : panels[active as SheetTabId]}
      </div>
    </aside>
  );
}
