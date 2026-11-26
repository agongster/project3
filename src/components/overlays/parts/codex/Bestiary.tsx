"use client";

/**
 * The codex's "Bestiary" tab: every monster species, what kind of code
 * problem it stands for, and how many of them live in (or were chased out
 * of) this repo. Species that don't occur here are dimmed. Each card also
 * shows which of the species' variants the player has met in any repo
 * (VariantShelf).
 */
import { useMemo } from "react";
import { MONSTERS } from "@/lib/game/catalog";
import { familiesMet } from "@/lib/game/monsterLooks";
import { useStore } from "@/lib/game/useStore";
import { MONSTER_KINDS } from "@/lib/types";
import type { MonsterKind, SaveData, Store } from "@/lib/types";
import { cx } from "@/components/ui/kit";
import { useTicker } from "../hooks";
import { MonsterIcon } from "../MonsterIcon";
import { MONSTER_EMBODIES, SEVERITY_INFO } from "../monsterText";
import type { MonsterTally } from "../codexData";
import { VariantShelf } from "./VariantShelf";

/** Idle animation speed of the bestiary sprites. */
const FRAME_MS = 260;
const CARD_ICON_BOX = 64;
/** How many rule names to list per monster before "…and N more". */
const MAX_RULES_SHOWN = 3;

const NONE_MET: ReadonlySet<number> = new Set();

export function Bestiary({ tallies, save }: { tallies: ReadonlyMap<MonsterKind, MonsterTally>; save: Store<SaveData> }) {
  const frame = useTicker(FRAME_MS);
  const repos = useStore(save, (s) => s.repos);
  const met = useMemo(() => familiesMet({ repos }), [repos]);
  return (
    // Two columns on a small game screen, three when the panel is wide (a container query on the codex body).
    <ul className="grid grid-cols-2 gap-3 @3xl:grid-cols-3">
      {MONSTER_KINDS.map((kind) => (
        <BestiaryCard key={kind} kind={kind} tally={tallies.get(kind)} frame={frame} met={met.get(kind) ?? NONE_MET} />
      ))}
    </ul>
  );
}

function BestiaryCard({ kind, tally, frame, met }: { kind: MonsterKind; tally: MonsterTally | undefined; frame: number; met: ReadonlySet<number> }) {
  const monster = MONSTERS[kind];
  const severity = SEVERITY_INFO[monster.severity];
  const present = tally !== undefined;
  const rules = tally?.rules ?? [];
  return (
    <li className={cx("flex gap-3 bg-cream-deep/60 p-2", !present && "opacity-50")}>
      <MonsterIcon kind={kind} box={CARD_ICON_BOX} frame={present ? frame : 0} dim={!present} />
      <div className="min-w-0 text-sm">
        <h4 className="font-bold leading-tight">
          {monster.name}{" "}
          <span className="text-xs uppercase" style={{ color: severity.color }}>
            {severity.label}
          </span>
        </h4>
        <p className="italic">{monster.blurb}</p>
        <p className="mt-1">
          <span className="font-bold">Embodies:</span> {MONSTER_EMBODIES[kind]}
        </p>
        {rules.length > 0 && (
          <p className="text-sm opacity-80">
            Here: {rules.slice(0, MAX_RULES_SHOWN).join(", ")}
            {rules.length > MAX_RULES_SHOWN && ` …and ${rules.length - MAX_RULES_SHOWN} more`}
          </p>
        )}
        <p className="mt-1 font-bold">
          {present ? bestiaryCount(tally) : "Not found in this repo"}
        </p>
        <VariantShelf kind={kind} met={met} />
      </div>
    </li>
  );
}

/** "Dealt with 2 / 5 in this repo · 1 subdued": a species is beaten for good only when its bugs leave the code (fixed or sealed). */
function bestiaryCount(tally: MonsterTally): string {
  const waiting = tally.subdued > 0 ? ` · ${tally.subdued} subdued` : "";
  return `Dealt with ${tally.dealtWith} / ${tally.total} in this repo${waiting}`;
}
