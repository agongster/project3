"use client";

/**
 * The compact bug card that opens next to a monster in the gutter: who the
 * monster is, the real problem (rule, Ruff's message, how it fights, how to
 * fix it) and two scrolls, each one undoable step:
 *
 *   fix scroll    Ruff's own fix, when it has one: the celebrated path (gold,
 *                 first, Enter), a real fix that pays its reward
 *   seal scroll   always offered, so nobody gets stuck: adds `# noqa: CODE`
 *                 to the line (src/lib/game/seal.ts). The monster is gone,
 *                 but the bug is only accepted, not fixed: no reward. A
 *                 syntax error can't be sealed; the card says so plainly.
 *
 * Several bugs on one line are paged with ‹ ›. Esc closes it and returns
 * the keyboard to the editor.
 */
import { useRef, useState, type KeyboardEvent } from "react";
import { MonsterIcon } from "@/components/overlays/parts/MonsterIcon";
import { SEVERITY_INFO } from "@/components/overlays/parts/monsterText";
import { TraitLine } from "@/components/overlays/parts/codex/TraitLine";
import { useTicker } from "@/components/overlays/parts/hooks";
import { KeyCap, PixelButton } from "@/components/ui/kit";
import { MONSTERS } from "@/lib/game/catalog";
import { lookOf } from "@/lib/game/monsterLooks";
import { sealComment, type SealPlan } from "@/lib/game/seal";
import type { LiveFinding, QuickFix } from "@/lib/workspace/contract";
import { clip, useFocusTrap } from "./bits";
import type { CardAnchor } from "./placement";

/** Ruff's message and fix title can quote long code; they are cut at this length. */
const MAX_MESSAGE_LENGTH = 240;
const PORTRAIT_BOX = 56;
const FRAME_MS = 220;

interface BugCardProps {
  findings: readonly LiveFinding[];
  /** Where the card goes on screen (next to its line). */
  anchor: CardAnchor;
  /** False while the live check is behind the typing: the fix positions could be stale. */
  fixReady: boolean;
  onUseFix: (fix: QuickFix) => void;
  /** What the seal scroll would do for a finding (the edit, or why it can't). */
  sealPlan: (live: LiveFinding) => SealPlan;
  onUseSeal: (live: LiveFinding) => void;
  onClose: () => void;
}

export function BugCard({ findings, anchor, fixReady, onUseFix, sealPlan, onUseSeal, onClose }: BugCardProps) {
  const [index, setIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const frame = useTicker(FRAME_MS);
  useFocusTrap(cardRef);

  const live = findings[Math.min(index, findings.length - 1)];
  if (!live) return null;
  const { finding, quickFix } = live;
  const seal = sealPlan(live);
  const monster = MONSTERS[finding.monster];
  const severity = SEVERITY_INFO[finding.severity];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (findings.length > 1 && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      setIndex((i) => (i + step + findings.length) % findings.length);
    }
  }

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`${monster.name}: ${finding.title}`}
      className="ws-bug-card px-panel anim-pop"
      // The stylesheet's cap (.ws-bug-card), or less when the line leaves less room before the window's edge.
      style={{ left: anchor.left, top: anchor.top, bottom: anchor.bottom, maxHeight: `min(70vh, 520px, ${anchor.maxHeight}px)` }}
      onKeyDown={onKeyDown}
    >
      <header className="ws-bug-card-head">
        <MonsterIcon kind={finding.monster} box={PORTRAIT_BOX} frame={frame} look={lookOf(finding)} />
        <div className="min-w-0 flex-1">
          <p className="font-title ws-bug-card-name">{monster.name}</p>
          <p className="ws-bug-card-severity" style={{ color: severity.color }}>
            {severity.label} · line {finding.line}
          </p>
          <h3 className="ws-bug-card-title">
            {finding.title} <code>{finding.code}</code>
          </h3>
        </div>
        <button type="button" className="ws-x" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>

      <section>
        <h4 className="ws-card-label">Ruff says</h4>
        <p>{clip(finding.message, MAX_MESSAGE_LENGTH)}</p>
      </section>
      <TraitLine finding={finding} className="ws-card-trait" />
      <section className="ws-card-tip">
        <h4 className="ws-card-label">How to fix it</h4>
        <p>{finding.tip}</p>
      </section>

      <footer className="ws-bug-card-foot">
        <div className="ws-scrolls">
          <div className="ws-scroll-buttons">
            {quickFix && (
              <PixelButton tone={quickFix.safe ? "gold" : "rose"} small disabled={!fixReady} onClick={() => onUseFix(quickFix)} data-autofocus>
                Use the fix scroll <KeyCap>Enter</KeyCap>
              </PixelButton>
            )}
            {seal.ok && (
              <PixelButton tone="cream" small disabled={!fixReady} onClick={() => onUseSeal(live)} title={`Adds "${sealComment(finding.code)}" to line ${seal.line}`}>
                Seal scroll
              </PixelButton>
            )}
          </div>
          {quickFix ? (
            <p className="ws-fix-title">
              {clip(quickFix.title, MAX_MESSAGE_LENGTH)}
              {!quickFix.safe && <span className="ws-unsafe"> · unsafe: may change what the code does, read it after</span>}
            </p>
          ) : (
            <p className="ws-faint-ink">No fix scroll for this one: fix it by hand, then Forge.</p>
          )}
          <SealNote plan={seal} code={finding.code} />
        </div>
        {findings.length > 1 && (
          <div className="ws-pager" aria-label="More bugs on this line">
            <button type="button" className="ws-x" aria-label="Previous bug" onClick={() => setIndex((i) => (i - 1 + findings.length) % findings.length)}>
              ‹
            </button>
            <span>
              {index + 1} / {findings.length}
            </span>
            <button type="button" className="ws-x" aria-label="Next bug" onClick={() => setIndex((i) => (i + 1) % findings.length)}>
              ›
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}

/**
 * What the seal scroll does (it is quieter than the fix scroll on purpose:
 * cream, second, "no reward"), or, for a syntax error, a plain word on why
 * it can't be sealed.
 */
function SealNote({ plan, code }: { plan: SealPlan; code: string }) {
  if (!plan.ok) return <p className="ws-seal-note">{plan.reason}</p>;
  return (
    <p className="ws-seal-note">
      Seal scroll: adds <code>{sealComment(code)}</code>. The monster goes, but the bug is only accepted, not fixed: no reward.
    </p>
  );
}
