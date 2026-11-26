"use client";

/**
 * The Bugs tab: every live finding of the file in front, top to bottom.
 * Clicking one moves the cursor to it (and Ctrl/Cmd+. there opens its card).
 */
import { SEVERITY_INFO } from "@/components/overlays/parts/monsterText";
import { MONSTERS } from "@/lib/game/catalog";
import { lookOf } from "@/lib/game/monsterLooks";
import type { LiveFinding } from "@/lib/workspace/contract";
import type { CheckStatus } from "../../hooks/useLiveCheck";
import { ShortcutKeys, clip } from "../bits";
import { MonsterThumb } from "../MonsterThumb";

/** Longest message shown in a list row. */
const MAX_ROW_MESSAGE = 90;
/** The list stops here; a huge generated file can have thousands of findings. */
const MAX_ROWS = 200;
const MONSTER_BOX = 24;

interface BugsTabProps {
  python: boolean;
  findings: readonly LiveFinding[] | null;
  status: CheckStatus;
  /** The text has unforged typing. */
  dirty: boolean;
  onJump: (finding: LiveFinding) => void;
}

export function BugsTab({ python, findings, status, dirty, onJump }: BugsTabProps) {
  if (!python) return <p className="ws-sheet-note">Only Python files have monsters. This one is just for reading and editing.</p>;
  if (findings === null) return <p className="ws-sheet-note">{status === "failed" ? "The bug detector is not available right now." : "Looking for monsters…"}</p>;
  if (findings.length === 0) {
    return (
      <div className="ws-sheet-note ws-all-clear">
        <p className="font-title">All clear!</p>
        <p>{dirty ? "No monsters in this code. Forge it to make it real." : "No monsters in this file."}</p>
      </div>
    );
  }

  const shown = findings.slice(0, MAX_ROWS);
  return (
    <div>
      <p className="ws-sheet-note">
        {findings.length} {findings.length === 1 ? "monster" : "monsters"} in the live code. <ShortcutKeys command="nextBug" /> next, <ShortcutKeys command="bugCard" /> card
      </p>
      <ul className="ws-bug-list">
        {shown.map((live) => {
          const { finding } = live;
          return (
            <li key={finding.id}>
              <button type="button" className="ws-bug-row" onClick={() => onJump(live)}>
                <MonsterThumb kind={finding.monster} size={MONSTER_BOX} look={lookOf(finding)} />
                <span className="min-w-0 flex-1">
                  <span className="ws-bug-row-title">
                    {finding.title} <span style={{ color: SEVERITY_INFO[finding.severity].color }}>{MONSTERS[finding.monster].name}</span>
                  </span>
                  <span className="ws-bug-row-message">{clip(finding.message, MAX_ROW_MESSAGE)}</span>
                </span>
                <span className="ws-bug-row-line">
                  L{finding.line}
                  {live.quickFix && (
                    <span className="ws-scroll-mark" title="A fix scroll is available">
                      ✦
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {findings.length > shown.length && <p className="ws-sheet-note">…and {findings.length - shown.length} more.</p>}
    </div>
  );
}
