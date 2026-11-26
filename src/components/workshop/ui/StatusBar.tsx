"use client";

/**
 * The status bar under the editor: is the live check running, what would a
 * forge change right now ("Ready to forge: 2 fixes · 1 new"), the last forge
 * ("Forged orders.py ✓"), and where the cursor is.
 */
import { useStore } from "@/lib/game/useStore";
import type { Store } from "@/lib/types";
import type { CheckStatus } from "../hooks/useLiveCheck";
import type { Tick } from "../hooks/useForging";

const CHECK_LABELS: Readonly<Record<CheckStatus, string>> = {
  off: "No monsters in this file type",
  checking: "Looking for monsters…",
  ready: "Live check on",
  failed: "Live check unavailable",
};

interface StatusBarProps {
  hasFile: boolean;
  checkStatus: CheckStatus;
  /** "Ready to forge: 2 fixes", or null when there is nothing to say. */
  forgeText: string | null;
  tick: Tick | null;
  /** The cursor position (its own store: it changes on every key). */
  cursor: Store<{ line: number; col: number }>;
  language: string;
  /** Files with unforged typing (kept when the Workshop closes, and the bar says so). */
  dirtyCount: number;
}

export function StatusBar({ hasFile, checkStatus, forgeText, tick, cursor, language, dirtyCount }: StatusBarProps) {
  const { line, col } = useStore(cursor, (position) => position);
  return (
    <footer className="ws-status">
      {hasFile && (
        <>
          <span className={`ws-check ws-check-${checkStatus}`}>{CHECK_LABELS[checkStatus]}</span>
          {forgeText && (
            <span className="ws-forge-preview" data-testid="forge-preview">
              {forgeText}
            </span>
          )}
        </>
      )}
      <span className="ws-status-spacer" />
      <span role="status" aria-live="polite" className="ws-tick-slot">
        {tick && (
          <span key={tick.id} className={`ws-tick ws-tick-${tick.tone}`}>
            {tick.text}
          </span>
        )}
      </span>
      {dirtyCount > 0 && (
        <span className="ws-kept-note" title="Unforged typing is kept for your next visit; Forge to make it part of the world">
          {dirtyCount === 1 ? "1 unforged file" : `${dirtyCount} unforged files`}, kept if you leave
        </span>
      )}
      {hasFile && (
        <>
          <span>
            Ln {line}, Col {col}
          </span>
          <span>{language}</span>
        </>
      )}
    </footer>
  );
}
