"use client";

/**
 * Under a finding's title in the codex: which variant of its species the
 * monster is (its colour family, src/lib/game/monsterLooks.ts), whether it
 * is its dungeon's champion (src/lib/game/champions.ts), and its modifier
 * with what it does (src/lib/game/monsterModifiers.ts).
 */
import { championName, isChampion } from "@/lib/game/champions";
import { familyName, lookOf } from "@/lib/game/monsterLooks";
import { MODIFIERS, modifierOf } from "@/lib/game/monsterModifiers";
import type { Finding, RepoAnalysis } from "@/lib/types";

const PILL = "inline-block px-1.5 py-0.5 text-xs font-bold";

export function VarietyLine({ finding, analysis }: { finding: Finding; analysis: RepoAnalysis }) {
  const file = analysis.files.find((f) => f.path === finding.path);
  const champion = file ? isChampion(file, finding) : false;
  const modifierId = modifierOf(finding, champion);
  const modifier = modifierId ? MODIFIERS[modifierId] : null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className={`${PILL} bg-cream-deep`}>{familyName(finding.monster, lookOf(finding).family)}</span>
      {champion && file && <span className={`${PILL} bg-gold text-ink`}>{championName(finding, file.outline)}</span>}
      {modifier && (
        <span>
          <span className={`${PILL} bg-grape/20`}>{modifier.label}</span> {modifier.blurb}
        </span>
      )}
    </p>
  );
}
