"use client";

/**
 * The notice board's WANTED posters (see src/lib/game/bounties.ts): each one
 * quotes the real line of code a monster hides at and names only the folder
 * and the line. An open bounty shows the monster as a black silhouette; once
 * it is CAPTURED (subdued in a fight, or its bug fixed for real first) the
 * poster reveals it and gets a red CAPTURED stamp; a bug sealed with
 * `# noqa` before anyone caught it gets a grey SEALED stamp (unpaid). An
 * open poster offers "Fix it for real", which opens the Workshop where the
 * monster hides.
 */
import { bountyClue, bountyState, type Bounty, type BountyState } from "@/lib/game/bounties";
import type { RepoProgress } from "@/lib/types";
import { MonsterIcon } from "./MonsterIcon";
import { WorkshopLink } from "./WorkshopLink";
import { PixelSprite } from "./PixelSprite";
import { lookFromId, uiIcon } from "./sprites";

/** The wanted monster's picture box, in screen px. */
const MUGSHOT_BOX = 48;
/** Hides who the wanted monster is until it is caught. */
const SILHOUETTE = { filter: "brightness(0)", opacity: 0.8 };
/** The stamp across a closed poster: red ink for a capture, grey for a seal. */
const STAMP: Readonly<Record<Exclude<BountyState, "open">, { label: string; className: string }>> = {
  captured: { label: "CAPTURED", className: "border-berry text-berry" },
  sealed: { label: "SEALED", className: "border-ink-soft text-ink-soft" },
};

interface BountyNoticesProps {
  bounties: readonly Bounty[];
  progress: RepoProgress;
  onFix: (bounty: Bounty) => void;
}

export function BountyNotices({ bounties, progress, onFix }: BountyNoticesProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {bounties.map((bounty) => (
        <WantedPoster key={bounty.findingId} bounty={bounty} state={bountyState(progress, bounty)} onFix={() => onFix(bounty)} />
      ))}
    </div>
  );
}

function WantedPoster({ bounty, state, onFix }: { bounty: Bounty; state: BountyState; onFix: () => void }) {
  const claimed = state !== "open";
  return (
    <article className="relative flex min-w-0 flex-col items-center gap-1 overflow-hidden bg-cream-deep/80 p-2 text-center shadow-[inset_0_0_0_2px_rgb(43_27_61_/_0.25)]">
      <h4 className="font-title text-pixel-sm text-berry">WANTED</h4>
      <span style={claimed ? undefined : SILHOUETTE}>
        <MonsterIcon kind={bounty.monster} box={MUGSHOT_BOX} look={lookFromId(bounty.findingId, bounty.monster)} />
      </span>
      <p className="text-sm font-bold leading-snug">{capitalize(bountyClue(bounty))}</p>
      <code className="w-full break-all bg-ink px-1 py-0.5 text-left font-mono text-xs leading-snug text-cream">{bounty.code}</code>
      <p className="mt-auto flex items-center gap-1 text-xs font-bold">
        <PixelSprite sprite={uiIcon("coin")} scale={2} />
        Capture reward: {bounty.reward} coins
      </p>
      {!claimed && <WorkshopLink className="text-sm" onClick={onFix} />}
      {state !== "open" && (
        <span
          aria-label={STAMP[state].label}
          className={`font-title pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 -rotate-12 border-4 px-2 py-1 text-pixel-sm opacity-90 ${STAMP[state].className}`}
        >
          {STAMP[state].label}
        </span>
      )}
    </article>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
