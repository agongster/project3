/**
 * Monster sprites: one cute-menacing bug-creature per `MonsterKind`, in
 * several LOOKS (colour family, feature, marking: src/lib/game/monsterLooks.ts).
 *
 *   drawSprite(ctx, monsterSprite("echoBat", frame, "normal", lookOf(finding)), m.x, m.y, { flipX: m.vx < 0 });
 *
 * Conventions
 *  - Canvas: a square of `MONSTERS[kind].size` px (16, 24 or 32), whatever the look.
 *  - Anchor: bottom-centre (size/2, size) — the monster's feet. Flyers
 *    (bat, phantom) hover a few px above that point, so draw a shadow at it.
 *  - Every monster faces RIGHT; mirror with `flipX` to face left.
 *  - `frame` is any integer (wraps modulo MONSTER_FRAMES[kind]); advance it
 *    every ~180 ms for idle animation.
 *  - variant "flash" is a solid-white silhouette for hit feedback;
 *    "disguised" only changes the mimic (an innocent-looking chest).
 *  - `look` defaults to PLAIN_LOOK, the species' classic picture. Its
 *    numbers wrap onto the species' own tables, so any input is safe and the
 *    sprite cache stays bounded. `sizeStep` is not part of the picture: the
 *    engine scales the body when it draws it.
 *
 * The drawings themselves live in monstersMinions.ts, monstersElites.ts and
 * monstersBoss.ts, their colours in monstersPalettes.ts; this file only
 * wires them up and caches the results.
 */
import { LOOK_FAMILIES, LOOK_FEATURES, LOOK_MARKINGS, MARKED_KINDS, PLAIN_LOOK, type MonsterLook } from "@/lib/game/monsterLooks";
import type { MonsterKind } from "@/lib/types";
import { cached, flashSprite, mod, type Pix, type Sprite } from "./engine";
import { glitchKing, evalSerpent, keyThief } from "./monstersBoss";
import { gremlin, mimic, phantom, spaghetti, swallowToad } from "./monstersElites";
import { dustBunny, echoBat, todoMite } from "./monstersMinions";

export type MonsterVariant = "normal" | "flash" | "disguised";

/** Animation frames per monster (the mimic's disguise has its own 2 frames). */
export const MONSTER_FRAMES: Record<MonsterKind, number> = {
  dustBunny: 2,
  todoMite: 2,
  echoBat: 2,
  gremlin: 2,
  phantom: 3,
  mimic: 2,
  swallowToad: 4,
  spaghetti: 3,
  keyThief: 4,
  evalSerpent: 4,
  glitchKing: 4,
};

/** A painter: (frame, disguised, look) → the finished picture at the species' size. The look is already wrapped onto its tables. */
type Painter = (frame: number, disguised: boolean, look: MonsterLook) => Pix;

const PAINTERS: Record<MonsterKind, Painter> = {
  dustBunny,
  todoMite,
  echoBat,
  gremlin,
  phantom,
  mimic,
  swallowToad,
  spaghetti,
  keyThief,
  evalSerpent,
  glitchKing,
};

/** How many markings a species can wear (plain only, for the species drawn without a body tone). */
function markingCount(kind: MonsterKind): number {
  return MARKED_KINDS.has(kind) ? LOOK_MARKINGS.length : 1;
}

/** `n` wrapped into [0, count); anything that is not a finite number (NaN, Infinity) becomes 0. */
function wrap(n: number, count: number): number {
  return Number.isFinite(n) ? mod(n, count) : 0;
}

/** The look with every number wrapped onto the species' own tables (sizeStep dropped: it is not painted). */
export function paintedLook(kind: MonsterKind, look: MonsterLook): MonsterLook {
  return {
    family: wrap(look.family, LOOK_FAMILIES[kind].length),
    feature: wrap(look.feature, LOOK_FEATURES[kind].length),
    marking: wrap(look.marking, markingCount(kind)),
    sizeStep: 0,
  };
}

const store = new Map<string, Sprite>();

/** The sprite for one monster frame in one look. Cached, so it is fine to call every frame. */
export function monsterSprite(kind: MonsterKind, frame: number, variant: MonsterVariant = "normal", look: MonsterLook = PLAIN_LOOK): Sprite {
  const f = wrap(frame, MONSTER_FRAMES[kind] ?? 1);
  const disguised = variant === "disguised" && kind === "mimic";
  const painted = paintedLook(kind, look);
  const key = `${kind}:${f}:${disguised ? "d" : "n"}:${painted.family}:${painted.feature}:${painted.marking}`;
  const base = cached(store, key, () => {
    const pix = (PAINTERS[kind] ?? dustBunny)(f, disguised, painted);
    return pix.toSprite(Math.floor(pix.w / 2), pix.h);
  });
  return variant === "flash" ? flashSprite(base) : base;
}
