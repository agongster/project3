"use client";

/**
 * A read-only diff of one file: its original text in the repo against its
 * forged text, as numbered lines (removed in red, added in green). Repo text
 * is shown as plain React text, never as HTML.
 */
import { useMemo } from "react";
import { PixelButton } from "@/components/ui/kit";
import { diffRows, MAX_DIFF_ROWS } from "../logic/diffRows";
import { clip } from "./bits";
import { Popup } from "./Popup";

/** Very long lines are cut so one minified line can't stretch the view forever. */
const MAX_LINE_LENGTH = 400;

interface DiffViewProps {
  path: string;
  original: string;
  saved: string;
  onClose: () => void;
}

export function DiffView({ path, original, saved, onClose }: DiffViewProps) {
  const { rows, truncated } = useMemo(() => diffRows(original, saved), [original, saved]);
  return (
    <Popup label={`Changes to ${path}`} onClose={onClose} className="ws-diff-popup">
      <header className="ws-popup-head">
        <h2 className="font-title">Changes</h2>
        <span className="ws-faint-ink">{clip(path, 80)} · original → saved</span>
        <PixelButton tone="cream" small onClick={onClose} data-autofocus>
          Close
        </PixelButton>
      </header>
      <div className="ws-diff px-scroll" role="table" aria-label="Line changes">
        {rows.length === 0 && <p className="ws-sheet-note">No differences.</p>}
        {rows.map((row, i) =>
          row.kind === "gap" ? (
            <div key={i} className="ws-diff-gap" role="row">
              ⋯
            </div>
          ) : (
            <div key={i} className={`ws-diff-row ws-diff-${row.kind}`} role="row">
              <span className="ws-diff-num" role="cell">
                {row.oldLine ?? ""}
              </span>
              <span className="ws-diff-num" role="cell">
                {row.newLine ?? ""}
              </span>
              <span className="ws-diff-mark" role="cell" aria-label={row.kind}>
                {row.kind === "added" ? "+" : row.kind === "removed" ? "−" : " "}
              </span>
              <code className="ws-diff-text" role="cell">
                {clip(row.text, MAX_LINE_LENGTH) || " "}
              </code>
            </div>
          ),
        )}
        {truncated && <p className="ws-sheet-note">Only the first {MAX_DIFF_ROWS} lines of the diff are shown; the patch download has everything.</p>}
      </div>
    </Popup>
  );
}
