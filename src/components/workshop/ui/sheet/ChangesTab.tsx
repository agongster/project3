"use client";

/**
 * The Changes tab: every file whose forged text differs from the repo, with
 * its +/− line counts, a diff view, a revert (after a confirmation), and the
 * two ways to take the work home: a patch for `git apply`, or a zip of the
 * changed files. Nothing is ever sent anywhere: both are built in the browser.
 */
import { PixelButton } from "@/components/ui/kit";
import type { FileChange } from "@/lib/workspace/contract";
import { clip } from "../bits";

const MAX_PATH_LENGTH = 60;

interface ChangesTabProps {
  changes: readonly FileChange[];
  /** Paths with unforged typing (not part of the changes until forged). */
  dirtyCount: number;
  busy: boolean;
  onOpen: (path: string) => void;
  onDiff: (path: string) => void;
  onRevert: (path: string) => void;
  onDownloadPatch: () => void;
  onDownloadZip: () => void;
}

export function ChangesTab({ changes, dirtyCount, busy, onOpen, onDiff, onRevert, onDownloadPatch, onDownloadZip }: ChangesTabProps) {
  return (
    <div className="ws-changes">
      {changes.length === 0 ? (
        <p className="ws-sheet-note">No saved changes yet. Edit a file and press Save: it shows up here.</p>
      ) : (
        <ul className="ws-change-list">
          {changes.map((change) => (
            <li key={change.path} className="ws-change">
              <button type="button" className="ws-change-path" onClick={() => onOpen(change.path)} title={change.path}>
                {clip(change.path, MAX_PATH_LENGTH)}
              </button>
              <span className="ws-change-counts">
                <span className="ws-added">+{change.linesAdded}</span> <span className="ws-removed">−{change.linesRemoved}</span>
              </span>
              <span className="ws-change-actions">
                <PixelButton tone="cream" small onClick={() => onDiff(change.path)}>
                  Diff
                </PixelButton>
                <PixelButton tone="rose" small disabled={busy} onClick={() => onRevert(change.path)}>
                  Revert
                </PixelButton>
              </span>
            </li>
          ))}
        </ul>
      )}
      {dirtyCount > 0 && (
        <p className="ws-sheet-note">
          {dirtyCount} {dirtyCount === 1 ? "file has" : "files have"} unsaved typing, not part of the export until saved.
        </p>
      )}
      <div className="ws-export">
        <PixelButton tone="sky" small disabled={changes.length === 0} onClick={onDownloadPatch}>
          Download patch
        </PixelButton>
        <PixelButton tone="sky" small disabled={changes.length === 0} onClick={onDownloadZip}>
          Download zip
        </PixelButton>
      </div>
      <p className="ws-sheet-note ws-faint">Edits live in this browser only. Nothing is sent to GitHub.</p>
    </div>
  );
}
