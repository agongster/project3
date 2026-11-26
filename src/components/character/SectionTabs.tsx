"use client";

/**
 * The creator's section tabs (Body / Hair / Face / Outfit / Extras).
 * Keyboard: Tab reaches the chosen tab; the arrow keys, Home and End switch
 * tabs, the usual way for a tab list.
 */
import type { KeyboardEvent } from "react";
import { PixelButton } from "@/components/ui/kit";
import { SECTIONS, type SectionId } from "./lookSections";
import { nextPosition } from "./SwatchGrid";

interface Props {
  value: SectionId;
  onChange: (id: SectionId) => void;
  /** Prefix for the tab / panel element ids (from React's useId). */
  idPrefix: string;
}

export function tabId(prefix: string, id: SectionId): string {
  return `${prefix}-tab-${id}`;
}

export function panelId(prefix: string, id: SectionId): string {
  return `${prefix}-panel-${id}`;
}

export function SectionTabs({ value, onChange, idPrefix }: Props) {
  const current = SECTIONS.findIndex((section) => section.id === value);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = nextPosition(event.key, current, SECTIONS.length);
    if (next === null) return;
    event.preventDefault();
    onChange(SECTIONS[next].id);
    const tab = event.currentTarget.children.item(next);
    if (tab instanceof HTMLElement) tab.focus();
  };

  return (
    <div role="tablist" aria-label="Hero sections" className="flex flex-wrap gap-1.5" onKeyDown={onKeyDown}>
      {SECTIONS.map((section) => {
        const active = section.id === value;
        return (
          <PixelButton
            key={section.id}
            id={tabId(idPrefix, section.id)}
            role="tab"
            aria-selected={active}
            aria-controls={panelId(idPrefix, section.id)}
            tabIndex={active ? 0 : -1}
            tone={active ? "gold" : "cream"}
            small
            onClick={() => onChange(section.id)}
          >
            {section.label}
          </PixelButton>
        );
      })}
    </div>
  );
}
