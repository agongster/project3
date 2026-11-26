/**
 * MONSTER MODIFIERS: a mild twist on how one monster fights, so two monsters
 * of the same kind rarely move exactly alike. Shown in its name tag
 * ("Swift · Unused import · L12") and in the Codex.
 *
 * Every modifier gives something and takes something, so fights get more
 * varied without getting harder on average:
 *
 *   Swift   walks faster        · less health
 *   Sturdy  more health         · walks slower
 *   Shy     notices you later   · runs off for a moment when badly hurt
 *   Bold    spots you sooner    · less health
 *   Tiny    small: hard to hit, short reach   · more health
 *   Giant   big: easy to hit, long reach      · less health
 *
 * Which monster gets which is decided by its finding alone (a hash of the
 * finding's id), so it never changes between visits. Bosses and champions
 * never get one (their fights are tuned by hand), and a modifier never goes
 * on a monster whose trait would fight it (MODIFIER_CLASHES).
 */
import { traitBehaviour, type TraitBehaviour } from "@/lib/analysis/traits";
import { MONSTERS, type MonsterArchetype } from "@/lib/game/catalog";
import { hashString, mulberry32 } from "@/lib/rng";
import type { Finding } from "@/lib/types";

export type ModifierId = "swift" | "sturdy" | "shy" | "bold" | "tiny" | "giant";

export interface ModifierDef {
  id: ModifierId;
  /** One word for the name tag. */
  label: string;
  /** What it does, for the Codex. */
  blurb: string;
  /** Health multiplier (rounded, never below 1 HP). */
  hp: number;
  /** Walking speed multiplier (attacks keep their tuned speed and reach). */
  speed: number;
  /** Body size multiplier: drawing and the hero's hit radius. */
  size: number;
  /** Multiplier of how close the hero must be to get bumped. */
  reach: number;
  /** Multiplier of the distance at which it notices the hero. */
  notice: number;
  /** Runs away for a moment when its health gets low (see SHY_FLEE in the engine). */
  fleesWhenHurt: boolean;
}

export const MODIFIERS: Readonly<Record<ModifierId, ModifierDef>> = {
  swift: { id: "swift", label: "Swift", blurb: "Quick on its feet, but goes down sooner.", hp: 0.7, speed: 1.3, size: 1, reach: 1, notice: 1, fleesWhenHurt: false },
  sturdy: { id: "sturdy", label: "Sturdy", blurb: "Takes more hits, but plods along slowly.", hp: 1.4, speed: 0.75, size: 1, reach: 1, notice: 1, fleesWhenHurt: false },
  shy: { id: "shy", label: "Shy", blurb: "Only notices you up close, and runs off for a moment when badly hurt.", hp: 1, speed: 1, size: 1, reach: 1, notice: 0.6, fleesWhenHurt: true },
  bold: { id: "bold", label: "Bold", blurb: "Spots you from further away, but folds sooner.", hp: 0.8, speed: 1.1, size: 1, reach: 1, notice: 1.4, fleesWhenHurt: false },
  tiny: { id: "tiny", label: "Tiny", blurb: "Small: hard to hit and short of reach, so it has a little more health.", hp: 1.3, speed: 1.1, size: 0.75, reach: 0.75, notice: 1, fleesWhenHurt: false },
  giant: { id: "giant", label: "Giant", blurb: "Big: easy to hit and long of reach, so it has less health.", hp: 0.7, speed: 0.85, size: 1.3, reach: 1.25, notice: 1, fleesWhenHurt: false },
};

export const MODIFIER_IDS = Object.keys(MODIFIERS) as ModifierId[];

/** Share of ordinary monsters that get a modifier. */
export const MODIFIER_CHANCE = 0.5;

/** Modifiers that would fight a trait's behaviour (traits/ in the engine). */
export const MODIFIER_CLASHES: Readonly<Partial<Record<TraitBehaviour, readonly ModifierId[]>>> = {
  // The mutable default grows with every hit: its size is its story.
  growsWhenHit: ["tiny", "giant"],
  // A bat and its echo share one finding's health and must stay twins.
  echoTwin: MODIFIER_IDS,
  // The shimmer and the burp switch the brain off; running away would too.
  undefinedName: ["shy"],
  swallowsShots: ["shy"],
};

/** Archetypes whose whole act a modifier would spoil: only these modifiers are allowed. */
export const ARCHETYPE_MODIFIERS: Readonly<Partial<Record<MonsterArchetype, readonly ModifierId[]>>> = {
  // The Todo Mite is a chase, never a fight: only modifiers that make it easier to catch.
  skitter: ["sturdy", "giant"],
  // The Mimic's act is waking up when you come close.
  ambusher: ["swift", "sturdy", "tiny", "giant"],
  // Bosses never get one.
  boss: [],
};

/** The modifiers this finding's monster may get (none for a champion). */
export function allowedModifiers(finding: Pick<Finding, "code" | "monster">, champion: boolean): ModifierId[] {
  if (champion) return [];
  const archetype = MONSTERS[finding.monster].archetype;
  const behaviour = traitBehaviour(finding);
  const clashes = behaviour ? (MODIFIER_CLASHES[behaviour] ?? []) : [];
  const allowed = ARCHETYPE_MODIFIERS[archetype] ?? MODIFIER_IDS;
  return allowed.filter((id) => !clashes.includes(id));
}

/** The modifier of a finding's monster, or null (see the file comment). Same finding, same answer. */
export function modifierOf(finding: Pick<Finding, "id" | "code" | "monster">, champion = false): ModifierId | null {
  const allowed = allowedModifiers(finding, champion);
  if (allowed.length === 0) return null;
  const random = mulberry32(hashString(`${finding.id}|modifier`));
  if (random() >= MODIFIER_CHANCE) return null;
  return allowed[Math.min(allowed.length - 1, Math.floor(random() * allowed.length))];
}

/** A modified health value: rounded, never below 1. */
export function modifiedHp(baseHp: number, modifier: ModifierId | null): number {
  if (!modifier) return baseHp;
  return Math.max(1, Math.round(baseHp * MODIFIERS[modifier].hp));
}
