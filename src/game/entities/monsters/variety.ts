/**
 * VARIETY: what makes one monster differ from the others of its species,
 * gathered into one BODY PLAN when the monster is built (traits/index.ts):
 *
 *   look      colours, ears, markings and a size step   src/lib/game/monsterLooks.ts
 *   modifier  Swift, Sturdy, Shy, Bold, Tiny or Giant   src/lib/game/monsterModifiers.ts
 *   champion  the dungeon's toughest monster, crowned   src/lib/game/champions.ts
 *
 * The plan turns those into the numbers the Monster uses: a tuned copy of
 * its catalog entry (the walking speed its brain reads), its health, and
 * size / reach / notice multipliers. Everything is derived from the finding,
 * so the same finding always gets the same body.
 */
import { CHAMPION_STATS, championHp } from "@/lib/game/champions";
import { MONSTERS, type MonsterDef } from "@/lib/game/catalog";
import { lookOf, lookScale, PLAIN_LOOK, type MonsterLook } from "@/lib/game/monsterLooks";
import { MODIFIERS, modifiedHp, modifierOf, type ModifierDef, type ModifierId } from "@/lib/game/monsterModifiers";
import type { Finding } from "@/lib/types";

export interface BodyPlan {
  /** The species' catalog entry, with the walking speed a modifier changed. */
  def: MonsterDef;
  hp: number;
  look: MonsterLook;
  modifier: ModifierDef | null;
  champion: boolean;
  /** Drawing and hit-radius scale: the look's size step, a Tiny / Giant modifier, or a champion's size. */
  sizeScale: number;
  /** How close the hero must come to get bumped, as a share of the species' usual reach. */
  reachScale: number;
  /** How far away it notices the hero, as a share of its brain's usual radius. */
  noticeScale: number;
}

/** The plain body of a species (the headless tests' monsters, and anything built without a finding's plan). */
export function plainPlan(def: MonsterDef): BodyPlan {
  return { def, hp: def.hp, look: PLAIN_LOOK, modifier: null, champion: false, sizeScale: 1, reachScale: 1, noticeScale: 1 };
}

type PlanFinding = Pick<Finding, "id" | "code" | "monster" | "severity">;

/** The body plan of a finding's monster. `champion` comes from championOf (the dungeon's toughest monster). */
export function bodyPlan(finding: PlanFinding, champion: boolean): BodyPlan {
  return champion ? championPlan(finding) : modifiedPlan(finding, modifierOf(finding));
}

/** A champion's body: its species made bigger and tougher (CHAMPION_STATS); never a modifier. */
export function championPlan(finding: PlanFinding): BodyPlan {
  const species = MONSTERS[finding.monster];
  return { def: species, hp: championHp(species.hp), look: lookOf(finding), modifier: null, champion: true, sizeScale: CHAMPION_STATS.sizeScale, reachScale: 1, noticeScale: 1 };
}

/** An ordinary body with the given modifier (or none). */
export function modifiedPlan(finding: PlanFinding, id: ModifierId | null): BodyPlan {
  const species = MONSTERS[finding.monster];
  const look = lookOf(finding);
  const modifier = id ? MODIFIERS[id] : null;
  // A Tiny or Giant modifier sets the size outright; otherwise the look's size step does.
  const sizeScale = modifier && modifier.size !== 1 ? modifier.size : lookScale(look);
  return {
    def: modifier ? { ...species, speed: species.speed * modifier.speed } : species,
    hp: modifiedHp(species.hp, id),
    look,
    modifier,
    champion: false,
    sizeScale,
    reachScale: modifier?.reach ?? 1,
    noticeScale: modifier?.notice ?? 1,
  };
}
