/**
 * Building a finding's monster WITH its trait: which trait (the data in
 * src/lib/analysis/traits.ts says), the names it shows (traitNames.ts), and
 * where its rune or echo goes (FloorSpots, found on the real map at run time).
 *
 *   createBodies(spawn, finding, world, setup) → [monster]  or  [voice, echo]
 *
 * Usually one body. An Echo Bat whose code says something twice gets a
 * second body (its echo) on free floor next to it, sharing the finding's
 * HP; when no free tile is near, it is simply a plain bat. Every body also
 * gets its finding's BODY PLAN (../variety.ts): its look, a modifier, or the
 * champion's crown when it is the dungeon's champion (a champion is always
 * one big body, never an echo pair).
 */
import { MONSTERS } from "@/lib/game/catalog";
import { definitionAt, type FileOutline } from "@/lib/analysis/outline";
import { traitBehaviour, type TraitBehaviour } from "@/lib/analysis/traits";
import { firstName, mutableDefault, noodleCount, noteText, secretTag, undefinedName, unusedTag } from "@/lib/analysis/traitNames";
import type { Finding, MonsterSpawn } from "@/lib/types";
import type { MonsterWorld } from "../brain";
import { createBrain } from "../brains";
import { Monster } from "../monster";
import { bodyPlan, type BodyPlan } from "../variety";
import { DisguiseNameTrait } from "./disguiseName";
import { EchoPair, EchoTrait } from "./echo";
import type { FloorSpots, SpotRange } from "./floorSpots";
import { GrowthTrait } from "./growth";
import { LeavesNameTrait } from "./leftovers";
import { NoodlesTrait } from "./noodles";
import { SqueakTrait } from "./squeak";
import { SwallowTrait } from "./swallow";
import type { Trait } from "./trait";
import { UndefinedNameTrait } from "./undefinedName";

/** The Phantom's rune lies 2–4 tiles from it: near enough to see both, far enough to read. */
export const RUNE_RANGE: SpotRange = { min: 2, max: 4 };
/** The echo starts 1–2.5 tiles from its bat. */
export const ECHO_RANGE: SpotRange = { min: 1, max: 2.5 };
/** Paper colours of left-behind tags: dusty for unused names, gold for a leaked secret. */
const DUST_PAPER = "#efe6d2";
const SECRET_PAPER = "#ffe08a";

/** What building a dungeon's monsters needs from the dungeon. */
export interface TraitSetup {
  spots: FloorSpots;
  outline: FileOutline;
  /** The finding id of the dungeon's champion (championOf in src/lib/game/champions.ts), or null. */
  championId: string | null;
}

/** The monster bodies one finding gets (see the file comment). */
export function createBodies(spawn: MonsterSpawn, finding: Finding, world: MonsterWorld, setup: TraitSetup): Monster[] {
  const plan = bodyPlan(finding, finding.id === setup.championId);
  const behaviour = traitBehaviour(finding);
  const twins = behaviour === "echoTwin" && !plan.champion ? echoBodies(spawn, finding, world, setup, plan) : null;
  if (twins) return twins;
  return [new Monster(spawn, finding, createBrain(spawn.kind, plan.champion), world, { trait: createTrait(behaviour, finding, spawn, setup), plan })];
}

/** A bat and its echo, splitting the finding's HP; the echo never hurts. Null when it can't have one. */
function echoBodies(spawn: MonsterSpawn, finding: Finding, world: MonsterWorld, setup: TraitSetup, plan: BodyPlan): Monster[] | null {
  const def = MONSTERS[spawn.kind];
  // Only minions: they are never dazed, so "the last body pays" is the whole story.
  if (plan.hp < 2 || def.severity !== "minion") return null;
  const spot = setup.spots.claimNear(spawn.x, spawn.y, ECHO_RANGE);
  if (!spot) return null;
  const pair = new EchoPair();
  const voiceHp = Math.ceil(plan.hp / 2);
  const voice = new Monster(spawn, finding, createBrain(spawn.kind), world, { trait: new EchoTrait(pair, "voice"), plan, hp: voiceHp });
  const echoSpawn = { ...spawn, x: spot.x, y: spot.y };
  const echo = new Monster(echoSpawn, finding, createBrain(spawn.kind), world, { trait: new EchoTrait(pair, "echo"), plan, hp: plan.hp - voiceHp, touchDamage: 0 });
  return [voice, echo];
}

function createTrait(behaviour: TraitBehaviour | null, finding: Finding, spawn: MonsterSpawn, setup: TraitSetup): Trait | null {
  switch (behaviour) {
    case "undefinedName":
      return new UndefinedNameTrait(undefinedName(finding), setup.spots.claimNear(spawn.x, spawn.y, RUNE_RANGE));
    case "growsWhenHit": {
      const grown = mutableDefault(finding);
      return new GrowthTrait(grown.name, grown.opener);
    }
    case "swallowsShots":
      return new SwallowTrait();
    case "leavesName":
      return leavesName(finding);
    case "squeaksNote":
      return new SqueakTrait(noteText(finding));
    case "wearsName": {
      const name = firstName(finding);
      return name ? new DisguiseNameTrait(name) : null;
    }
    case "noodles":
      return new NoodlesTrait(noodleCount(finding, definitionAt(setup.outline, finding.line)?.branches ?? null));
    case "echoTwin": // no free floor for the echo: a plain bat
    case null:
      return null;
  }
}

/** The tag a beaten monster drops: the leaked secret's name (Key Thief) or the unused name (Dust Bunny). */
function leavesName(finding: Finding): Trait | null {
  if (finding.monster === "keyThief") return new LeavesNameTrait({ text: secretTag(finding), paper: SECRET_PAPER });
  const text = unusedTag(finding) ?? firstName(finding);
  return text ? new LeavesNameTrait({ text, paper: DUST_PAPER }) : null;
}
