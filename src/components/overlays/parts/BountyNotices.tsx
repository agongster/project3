"use client";

/**
 * The notice board's WANTED posters (see src/lib/game/bounties.ts): each one
 * quotes the real line of code a monster hides at and names only the folder
 * and the line. An open bounty shows the monster as a black silhouette; once
 * it is defeated the poster reveals it and gets a red CLAIMED stamp.
 */
import { bountyClue, isBountyClaimed, type Bounty } from "@/lib/game/bounties";
import type { RepoProgress } from "@/lib/types";
import { MonsterIcon } from "./MonsterIcon";
import { PixelSprite } from "./PixelSprite";
import { uiIcon } from "./sprites";

/** The wanted monster's picture box, in screen px. */
const MUGSHOT_BOX = 48;
/** Hides who the wanted monster is until it is caught. */
const SILHOUETTE = { filter: "brightness(0)", opacity: 0.8 };

export function BountyNotices({ bounties, progress }: { bounties: readonly Bounty[]; progress: RepoProgress }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {bounties.map((bounty) => (
        <WantedPoster key={bounty.findingId} bounty={bounty} claimed={isBountyClaimed(progress, bounty)} />
      ))}
    </div>
  );
}

function WantedPoster({ bounty, claimed }: { bounty: Bounty; claimed: boolean }) {
  return (
    <article className="relative flex min-w-0 flex-col items-center gap-1 overflow-hidden bg-cream-deep/80 p-2 text-center shadow-[inset_0_0_0_2px_rgb(43_27_61_/_0.25)]">
      <h4 className="font-title text-[10px] tracking-widest text-berry">WANTED</h4>
      <span style={claimed ? undefined : SILHOUETTE}>
        <MonsterIcon kind={bounty.monster} box={MUGSHOT_BOX} />
      </span>
      <p className="text-xs font-bold leading-snug">{capitalize(bountyClue(bounty))}</p>
      <code className="w-full break-all bg-ink px-1 py-0.5 text-left font-mono text-[11px] leading-snug text-cream">{bounty.code}</code>
      <p className="mt-auto flex items-center gap-1 text-xs font-bold">
        <PixelSprite sprite={uiIcon("coin")} scale={2} />
        Reward: {bounty.reward} coins
      </p>
      {claimed && (
        <span
          aria-label="Claimed"
          className="font-title pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 -rotate-12 border-4 border-berry px-2 py-1 text-sm text-berry opacity-90"
        >
          CLAIMED
        </span>
      )}
    </article>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
