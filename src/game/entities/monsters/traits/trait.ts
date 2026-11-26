/**
 * The TRAIT interface: what makes a monster behave like its bug.
 *
 * A Brain (brain.ts) decides how a monster moves and attacks — that depends
 * only on its archetype. A Trait sits on top and shows the finding itself:
 * the Phantom that is only a shimmer until its name is defined, the Swallow
 * Toad that gulps down your shots, the Mimic wearing a builtin's name…
 * Which finding gets which trait is plain data in src/lib/analysis/traits.ts;
 * createBodies (index.ts) builds the matching object.
 *
 * Every hook is optional, and a monster without a trait (`null`) fights
 * exactly as before. Traits are decoration around ONE finding: they never
 * pay rewards or record defeats themselves (the director does, once).
 *
 * The behaviour hooks the Monster calls (update, hits, shots) never run
 * while it is dazed or dying, so a dazed toad swallows nothing and a dazed
 * monster stops growing; the drawing hooks may still show it (drooping noodles).
 */
import type { ProjectileName } from "@/game/art/weapons";
import type { Light } from "../../../scenes/scene";
import type { MonsterWorld, Pose } from "../brain";
import type { Monster } from "../monster";

/** A hero projectile as the Swallow Toad sees it (see combat/projectiles.ts). */
export interface IncomingShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sprite: ProjectileName;
}

/** A little tag a beaten monster leaves behind (it floats up and is swept away, see leftovers.ts). */
export interface LeftoverTag {
  text: string;
  /** Paper colour of the tag. */
  paper: string;
}

export interface Trait {
  /** Each step while the monster is alive and not dazed, after its brain (or instead of it, see holdsBrain). */
  update?(m: Monster, world: MonsterWorld, dt: number): void;
  /** While true the brain is switched off (the undefined phantom shimmers, the burping toad sees stars). */
  holdsBrain?(m: Monster): boolean;
  /** True while hits should land without damage (hits on an undefined name only raise NameError). */
  absorbsHit?(m: Monster, world: MonsterWorld): boolean;
  /** True while the monster counts as an "object" for the hero's attacks: no damage numbers, no pet pecks. */
  passesThrough?(m: Monster): boolean;
  /** A hit landed and took HP (not the killing blow). */
  onHit?(m: Monster, world: MonsterWorld): void;
  /** One of the hero's projectiles reached the monster; true = it was swallowed and must vanish. */
  catchShot?(m: Monster, world: MonsterWorld, shot: IncomingShot): boolean;
  /** The monster noticed the hero. */
  onNotice?(m: Monster, world: MonsterWorld): void;
  /** The hero fainted: drop anything half-done (what the monster has become, like its size, stays). */
  reset?(m: Monster): void;
  /**
   * One of its bodies started dying; `lastBody` is true when that defeats
   * the finding. Returns a coin multiplier for that defeat (1 = none).
   */
  onDefeat?(m: Monster, world: MonsterWorld, lastBody: boolean): number;
  /** True while its own label or speech bubble takes the place of the name tag (nameTags.ts). */
  hidesNameTag?(m: Monster): boolean;
  /** Overrides the brain's pose (the toad's full cheeks while it is about to burp). */
  pose?(m: Monster): Pose | null;
  /** Flat marks on the floor (a rune, a countdown ring), drawn under every body. */
  drawFloor?(g: CanvasRenderingContext2D, m: Monster, time: number): void;
  /** Drawn just before the body (noodles, after-images). */
  drawBehind?(g: CanvasRenderingContext2D, m: Monster, time: number): void;
  /** Drawn above the darkness (a rune's name, a label, a speech bubble). */
  drawOverlay?(g: CanvasRenderingContext2D, m: Monster, time: number): void;
  /** Extra light (a glowing rune). */
  lights?(m: Monster, out: Light[]): void;
  /** What the monster leaves behind when its finding is defeated. */
  leftover?(m: Monster): LeftoverTag | null;
}
