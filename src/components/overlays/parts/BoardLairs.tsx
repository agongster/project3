"use client";

/**
 * The notice board's "Boss lairs" note: every boss of the repo and every
 * dungeon's champion (src/lib/game/champions.ts), with its name, its file
 * and line, and how it is doing in the SPEC's words: still lurking, or
 * ticked off once it is subdued, fixed or sealed. "Fix it for real" opens
 * the Workshop on its line while its bug is still in the code.
 */
import { clipPath } from "@/lib/analysis/repoText";
import { lairName, type Lair } from "@/lib/game/champions";
import { lookOf } from "@/lib/game/monsterLooks";
import type { FindingState } from "@/lib/game/progress";
import type { FileOutline, RepoAnalysis } from "@/lib/types";
import { DoneMark } from "./DoneMark";
import { MonsterIcon } from "./MonsterIcon";
import { WorkshopLink } from "./WorkshopLink";

/** Big enough for a 32 px boss at 1× (smaller monsters get 2×). */
const LAIR_ICON_BOX = 32;
/** File paths are clipped from the left (keeping the file name) to this many characters. */
const MAX_PATH_CHARS = 40;

/** How each state reads on the board, and its colour. */
const STATE_WORDS: Readonly<Record<FindingState, { label: string; className: string }>> = {
  alive: { label: "Lurking", className: "text-berry" },
  subdued: { label: "Subdued", className: "text-[#2a6f8a]" },
  fixed: { label: "Fixed", className: "text-leaf-deep" },
  sealed: { label: "Sealed", className: "text-ink-soft" },
};

interface BoardLairsProps {
  lairs: readonly Lair[];
  analysis: RepoAnalysis;
  onFix: (lair: Lair) => void;
}

export function BoardLairs({ lairs, analysis, onFix }: BoardLairsProps) {
  if (lairs.length === 0) {
    return <p className="text-sm">No boss lairs here: no boss, and no dungeon big enough to crown a champion. Enjoy the peace!</p>;
  }
  const lurking = lairs.filter((lair) => lair.state === "alive").length;
  const outlineOf = (path: string): FileOutline | undefined => analysis.files.find((f) => f.path === path)?.outline;
  return (
    <div>
      <p className="mb-2 text-sm">
        {lurking === 0 ? "Every boss and champion has been beaten!" : `${lurking} of ${lairs.length} still lurking. Look for the banners by the houses.`}
      </p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
        {lairs.map((lair) => (
          <LairRow key={lair.finding.id} lair={lair} outline={outlineOf(lair.path)} onFix={() => onFix(lair)} />
        ))}
      </ul>
    </div>
  );
}

function LairRow({ lair, outline, onFix }: { lair: Lair; outline: FileOutline | undefined; onFix: () => void }) {
  const state = STATE_WORDS[lair.state];
  const inCode = lair.state === "alive" || lair.state === "subdued";
  const name = outline ? lairName(lair, outline) : lair.finding.title;
  return (
    <li className="flex min-w-0 items-center gap-2 text-sm">
      <MonsterIcon kind={lair.finding.monster} box={LAIR_ICON_BOX} look={lookOf(lair.finding)} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{name}</p>
        <p className="truncate text-xs">
          {clipPath(lair.path, MAX_PATH_CHARS)}:{lair.finding.line} · {lair.finding.title}
        </p>
        {inCode && <WorkshopLink onClick={onFix} className="text-xs" />}
      </div>
      <span className={`flex shrink-0 items-center text-xs font-bold uppercase ${state.className}`}>
        <DoneMark done={lair.state !== "alive"} />
        {state.label}
      </span>
    </li>
  );
}
