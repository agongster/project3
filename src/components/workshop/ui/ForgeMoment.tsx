"use client";

/**
 * The moment after a forge, drawn over the corner of the editor without
 * taking the keyboard: banished monsters pop away one after another with
 * their coins, sealed ones are listed plainly (no sparkle, no coins: a real
 * fix is the celebrated path), new bugs are announced gently, a changed
 * grade flips its letter, and a purified file gets a big banner across the editor.
 *
 * It never blocks typing and leaves on its own after MOMENT_MS (or at once
 * with the × button).
 */
import type { CSSProperties } from "react";
import { GRADE_INFO } from "@/components/overlays/parts/GradeBadge";
import { PixelSprite } from "@/components/overlays/parts/PixelSprite";
import { lookFromId, uiIcon } from "@/components/overlays/parts/sprites";
import { useTimeout } from "@/components/overlays/parts/hooks";
import type { Grade } from "@/lib/types";
import type { ShownMoment } from "../hooks/useForging";
import { creptInText, gradeImproved, sealedText } from "../logic/forgeMoment";
import { clip } from "./bits";
import { MonsterThumb } from "./MonsterThumb";

/** How long the summary stays (ms). */
export const MOMENT_MS = 5200;
/** How long the purified banner stays (ms). */
export const BANNER_MS = 2400;
/** Delay between two banished monsters popping (ms). */
const STAGGER_MS = 160;
/** At most this many monsters are listed; the rest are counted. */
const MAX_LISTED = 6;
/** Longest bug title or reward line shown. */
const MAX_LINE_LENGTH = 80;
const MONSTER_BOX = 32;

function GradeFlip({ from, to }: { from: Grade; to: Grade }) {
  return (
    <span className="ws-grade-flip" aria-label={`Grade ${from} to ${to}`}>
      <span className="ws-grade-chip ws-grade-old" style={{ background: GRADE_INFO[from].color }}>
        {from}
      </span>
      <span aria-hidden="true">→</span>
      <span className="ws-grade-chip ws-grade-new" style={{ background: GRADE_INFO[to].color }}>
        {to}
      </span>
      <span className={gradeImproved(from, to) ? "ws-good" : "ws-faint-ink"}>{gradeImproved(from, to) ? "up!" : "down"}</span>
    </span>
  );
}

export function ForgeMomentCard({ shown, onDone }: { shown: ShownMoment; onDone: () => void }) {
  const { moment } = shown;
  useTimeout(onDone, MOMENT_MS, shown.id);
  const listed = moment.banished.slice(0, MAX_LISTED);
  const coins = moment.rewards?.coins ?? 0;
  const xp = moment.rewards?.xp ?? 0;

  return (
    <aside className="ws-moment px-panel anim-slide-up" aria-label="Save results">
      <header className="ws-moment-head">
        <span className="font-title ws-moment-title">{shown.reverted ? "Reverted" : "Saved!"}</span>
        <span className="ws-moment-path">{clip(moment.paths.join(", "), MAX_LINE_LENGTH)}</span>
        <button type="button" className="ws-x" aria-label="Dismiss" onClick={onDone}>
          ×
        </button>
      </header>

      {listed.length > 0 && (
        <ul className="ws-banished">
          {listed.map((monster, i) => (
            <li key={monster.id} className="ws-banish-row" style={{ "--delay": `${i * STAGGER_MS}ms` } as CSSProperties}>
              <span className="ws-banish-sprite">
                <MonsterThumb kind={monster.monster} size={MONSTER_BOX} look={lookFromId(monster.id, monster.monster)} />
                <span className="ws-banish-sparkle" aria-hidden="true">
                  <PixelSprite sprite={uiIcon("sparkle", i)} scale={2} />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <strong>{monster.name} banished!</strong>
                <span className="ws-faint-ink">
                  {" "}
                  {clip(monster.title, MAX_LINE_LENGTH)} · line {monster.line}
                </span>
              </span>
              {monster.coins !== null && (
                <span className="ws-banish-coin">
                  <PixelSprite sprite={uiIcon("coin")} scale={2} />+{monster.coins}
                </span>
              )}
            </li>
          ))}
          {moment.banished.length > listed.length && <li className="ws-faint-ink">…and {moment.banished.length - listed.length} more</li>}
        </ul>
      )}

      {moment.sealed.slice(0, MAX_LISTED).map((monster) => (
        <p key={monster.id} className="ws-sealed">
          <span className="ws-sealed-thumb">
            <MonsterThumb kind={monster.monster} size={20} look={lookFromId(monster.id, monster.monster)} />
          </span>{" "}
          {sealedText(monster)}
        </p>
      ))}
      {moment.sealed.length > MAX_LISTED && <p className="ws-sealed">…and {moment.sealed.length - MAX_LISTED} more ignored</p>}

      {moment.creptIn.slice(0, MAX_LISTED).map((monster) => (
        <p key={monster.id} className="ws-crept">
          <MonsterThumb kind={monster.monster} size={20} look={lookFromId(monster.id, monster.monster)} /> {creptInText(monster, shown.reverted)}
        </p>
      ))}
      {moment.creptIn.length > MAX_LISTED && <p className="ws-crept">…and {moment.creptIn.length - MAX_LISTED} more new bugs (no harm done)</p>}

      {moment.grades.map((grade) => (
        <p key={grade.path} className="ws-moment-grade">
          Grade <GradeFlip from={grade.from} to={grade.to} />
          {moment.grades.length > 1 && <span className="ws-faint-ink"> {clip(grade.path, MAX_LINE_LENGTH)}</span>}
        </p>
      ))}

      {(coins > 0 || xp > 0) && (
        <p className="ws-moment-pay">
          {coins > 0 && (
            <span className="ws-pay-coins">
              <PixelSprite sprite={uiIcon("coin")} scale={2} /> +{coins} coins
            </span>
          )}
          {xp > 0 && <span className="ws-pay-xp">+{xp} XP</span>}
        </p>
      )}
      {moment.rewards?.lines.slice(0, MAX_LISTED).map((line, i) => (
        <p key={i} className="ws-pay-line">
          ★ {clip(line, MAX_LINE_LENGTH)}
        </p>
      ))}
    </aside>
  );
}

/** "FILE PURIFIED!" across the editor. Click-through, so it never gets in the way. */
export function PurifiedBanner({ shown, onDone }: { shown: ShownMoment; onDone: () => void }) {
  useTimeout(onDone, BANNER_MS, shown.id);
  const paths = shown.moment.purified;
  return (
    <div className="ws-purified" role="status">
      <div className="ws-purified-inner">
        <span className="font-title ws-purified-title">{paths.length > 1 ? `${paths.length} FILES PURIFIED!` : "FILE PURIFIED!"}</span>
        <span className="ws-purified-ribbon">{clip(paths.join(", "), MAX_LINE_LENGTH)} is purified: its prize chest waits</span>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`ws-sparkle ws-sparkle-${i}`} aria-hidden="true">
            <PixelSprite sprite={uiIcon("sparkle", i)} scale={3} />
          </span>
        ))}
      </div>
    </div>
  );
}
