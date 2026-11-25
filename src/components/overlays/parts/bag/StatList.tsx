"use client";

/** A label/value list of stats; lines measured in hearts also show heart icons. */
import { PixelSprite } from "../PixelSprite";
import type { StatLine } from "../itemText";
import { uiIcon } from "../sprites";

const HEART_SCALE = 2;
/** More hearts than this are summarised in text only, so a row never wraps. */
const MAX_HEART_ICONS = 8;

export function StatList({ lines }: { lines: readonly StatLine[] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
      {lines.map((line, index) => (
        <div key={`${line.label}-${index}`} className="contents">
          <dt className="font-bold">{line.label}</dt>
          <dd className="flex flex-wrap items-center gap-1">
            {line.hearts !== undefined && line.hearts <= MAX_HEART_ICONS * 2 && <Hearts halfHearts={line.hearts} />}
            <span>{line.text}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Full and half heart icons for a number of half-hearts. */
function Hearts({ halfHearts }: { halfHearts: number }) {
  const full = Math.floor(halfHearts / 2);
  const half = halfHearts % 2 === 1;
  return (
    <span className="inline-flex flex-wrap gap-px" aria-hidden="true">
      {Array.from({ length: full }, (_, index) => (
        <PixelSprite key={index} sprite={uiIcon("heartFull")} scale={HEART_SCALE} />
      ))}
      {half && <PixelSprite sprite={uiIcon("heartHalf")} scale={HEART_SCALE} />}
    </span>
  );
}
