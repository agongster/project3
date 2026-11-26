"use client";

/**
 * The one popup the Workshop can have open at a time: the bug card next to a
 * monster, quick-open, the revert confirmation, the diff view, or help.
 */
import { PixelButton } from "@/components/ui/kit";
import type { SealPlan } from "@/lib/game/seal";
import type { FileChange, LiveFinding, QuickFix, WorkspaceEntry } from "@/lib/workspace/contract";
import { BugCard } from "./BugCard";
import { clip } from "./bits";
import { DiffView } from "./DiffView";
import { HelpPanel } from "./HelpPanel";
import type { CardAnchor } from "./placement";
import { Popup } from "./Popup";
import { QuickOpen } from "./QuickOpen";

export type PopupState =
  | null
  | { kind: "bug"; line: number; ids: string[]; anchor: CardAnchor }
  | { kind: "quickOpen" }
  | { kind: "revert"; path: string }
  | { kind: "diff"; path: string }
  | { kind: "help" };

interface WorkshopPopupsProps {
  popup: PopupState;
  entries: readonly WorkspaceEntry[];
  changes: readonly FileChange[];
  liveFindings: readonly LiveFinding[] | null;
  fixReady: boolean;
  onClose: () => void;
  onOpen: (path: string) => void;
  onUseFix: (fix: QuickFix) => void;
  sealPlan: (live: LiveFinding) => SealPlan;
  onUseSeal: (live: LiveFinding) => void;
  onRevert: (path: string) => void;
  onDismissHelp: () => void;
}

/** The findings a card shows: the ones drawn on the line, or (if a newer check renamed them) whatever is on that line now. */
function cardFindings(all: readonly LiveFinding[], ids: readonly string[], line: number): LiveFinding[] {
  const byId = all.filter((live) => ids.includes(live.finding.id));
  return byId.length > 0 ? byId : all.filter((live) => live.finding.line === line);
}

export function WorkshopPopups(props: WorkshopPopupsProps) {
  const { popup, onClose } = props;
  if (popup === null) return null;

  switch (popup.kind) {
    case "bug":
      return (
        <div className="ws-card-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
          <BugCard
            findings={cardFindings(props.liveFindings ?? [], popup.ids, popup.line)}
            anchor={popup.anchor}
            fixReady={props.fixReady}
            onUseFix={props.onUseFix}
            sealPlan={props.sealPlan}
            onUseSeal={props.onUseSeal}
            onClose={onClose}
          />
        </div>
      );
    case "quickOpen":
      return <QuickOpen entries={props.entries} onOpen={props.onOpen} onClose={onClose} />;
    case "diff": {
      const change = props.changes.find((candidate) => candidate.path === popup.path);
      return <DiffView path={popup.path} original={change?.original ?? ""} saved={change?.saved ?? ""} onClose={onClose} />;
    }
    case "revert":
      return (
        <Popup label="Revert file" onClose={onClose} className="ws-confirm">
          <h2 className="font-title ws-confirm-title">Revert this file?</h2>
          <p>
            <code>{clip(popup.path, 80)}</code> goes back to the text in the repo. Your forged edits to it, and any unforged typing, are thrown away.
          </p>
          <p className="ws-faint-ink">Its bugs come back as monsters (no penalty).</p>
          <div className="ws-confirm-actions">
            <PixelButton tone="cream" small onClick={onClose} data-autofocus>
              Keep my edits
            </PixelButton>
            <PixelButton tone="berry" small onClick={() => props.onRevert(popup.path)}>
              Revert
            </PixelButton>
          </div>
        </Popup>
      );
    case "help":
      return (
        <Popup label="How the Workshop works" onClose={onClose} className="ws-help-popup">
          <HelpPanel onDismiss={props.onDismissHelp} dismissLabel="Back to the code" />
        </Popup>
      );
  }
}
