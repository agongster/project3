"use client";

/**
 * Fills the file sheet's built-in tabs (Bugs, Grade, Changes) from the
 * Workshop's state, and passes on the extra tabs other features add.
 */
import { memo } from "react";
import type { FileChange, LiveFinding } from "@/lib/workspace/contract";
import type { CheckStatus, CheckedText } from "../hooks/useLiveCheck";
import type { WorkshopExtraTab } from "../types";
import { BugsTab } from "./sheet/BugsTab";
import { ChangesTab } from "./sheet/ChangesTab";
import { FileSheet } from "./sheet/FileSheet";
import { GradeTab } from "./sheet/GradeTab";

/** What the sheet's buttons do (one stable object, so the sheet only redraws when its data changes). */
export interface SheetActions {
  onJump: (line: number, col?: number) => void;
  onOpen: (path: string, line?: number) => void;
  onDiff: (path: string) => void;
  onRevert: (path: string) => void;
  onDownloadPatch: () => void;
  onDownloadZip: () => void;
}

interface WorkshopSheetProps {
  python: boolean;
  path: string | null;
  live: CheckedText | null;
  status: CheckStatus;
  /** The file in front has unforged typing. */
  dirty: boolean;
  changes: readonly FileChange[];
  dirtyCount: number;
  busy: boolean;
  extraTabs: readonly WorkshopExtraTab[];
  actions: SheetActions;
}

/** Memoized: typing redraws the Workshop often, and a sheet with hundreds of bugs listed is not free. */
export const WorkshopSheet = memo(function WorkshopSheet(props: WorkshopSheetProps) {
  const { python, path, live, status, actions } = props;
  const findings = live?.check.findings ?? null;
  const hasFile = path !== null;

  const bugs = hasFile ? (
    <BugsTab python={python} findings={findings} status={status} dirty={props.dirty} onJump={(item: LiveFinding) => actions.onJump(item.finding.line, item.finding.col)} />
  ) : (
    <p className="ws-sheet-note">Open a file to see its monsters.</p>
  );
  const grade = hasFile ? (
    <GradeTab
      python={python}
      quality={live?.check.quality ?? null}
      outline={live?.check.outline ?? null}
      bugCount={findings?.length ?? 0}
      text={live?.text ?? ""}
      onJump={(line) => actions.onJump(line)}
    />
  ) : (
    <p className="ws-sheet-note">Open a Python file to see its grade.</p>
  );
  const changes = (
    <ChangesTab
      changes={props.changes}
      dirtyCount={props.dirtyCount}
      busy={props.busy}
      onOpen={(changed) => actions.onOpen(changed)}
      onDiff={actions.onDiff}
      onRevert={actions.onRevert}
      onDownloadPatch={actions.onDownloadPatch}
      onDownloadZip={actions.onDownloadZip}
    />
  );

  return (
    <FileSheet
      panels={{ bugs, grade, changes }}
      badges={{ bugs: python ? (findings?.length ?? 0) : 0, changes: props.changes.length }}
      extraTabs={props.extraTabs}
      context={{ openFile: (target, line) => actions.onOpen(target, line), activePath: path }}
    />
  );
});
