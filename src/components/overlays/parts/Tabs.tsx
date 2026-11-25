"use client";

/**
 * A row of pixel tabs (codex: Bugs / Bestiary; bag: one tab per item slot).
 * Follows the ARIA tabs pattern: Left/Right arrows move between tabs.
 */
import type { KeyboardEvent, ReactNode } from "react";
import { PixelButton } from "@/components/ui/kit";

export interface TabDef<T extends string> {
  id: T;
  label: ReactNode;
}

interface TabsProps<T extends string> {
  tabs: readonly TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  /** Accessible name of the tab list. */
  label: string;
}

export function Tabs<T extends string>({ tabs, active, onChange, label }: TabsProps<T>) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === active);
    const next = tabs[(index + step + tabs.length) % tabs.length];
    onChange(next.id);
    // Keep keyboard focus on the newly active tab.
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1" onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <PixelButton
            key={tab.id}
            role="tab"
            data-tab={tab.id}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            tone={selected ? "gold" : "cream"}
            small
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </PixelButton>
        );
      })}
    </div>
  );
}
