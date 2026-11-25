/**
 * Monster sprites: one cute-menacing bug-creature per `MonsterKind`.
 *
 *   drawSprite(ctx, monsterSprite("echoBat", frame), m.x, m.y, { flipX: m.vx < 0 });
 *
 * Conventions
 *  - Canvas: a square of `MONSTERS[kind].size` px (16, 24 or 32).
 *  - Anchor: bottom-centre (size/2, size) — the monster's feet. Flyers
 *    (bat, phantom) hover a few px above that point, so draw a shadow at it.
 *  - Every monster faces RIGHT; mirror with `flipX` to face left.
 *  - `frame` is any integer (wraps modulo MONSTER_FRAMES[kind]); advance it
 *    every ~180 ms for idle animation.
 *  - variant "flash" is a solid-white silhouette for hit feedback;
 *    "disguised" only changes the mimic (an innocent-looking chest).
 *
 * The drawings themselves live in monstersMinions.ts, monstersElites.ts and
 * monstersBoss.ts; this file only wires them up and caches the results.
 */
import type { MonsterKind } from "@/lib/types";
import { cached, flashSprite, mod, type Pix, type Sprite } from "./engine";
import { mimic, gremlin, phantom, spaghetti, swallowToad } from "./monstersElites";
import { glitchKing, evalSerpent, keyThief } from "./monstersBoss";
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

/** The painter for each kind: (frame, disguised) → finished picture of the right size. */
const PAINTERS: Record<MonsterKind, (frame: number, disguised: boolean) => Pix> = {
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

const store = new Map<string, Sprite>();

/** The sprite for one monster frame. Cached, so it is fine to call every frame. */
export function monsterSprite(kind: MonsterKind, frame: number, variant: MonsterVariant = "normal"): Sprite {
  const f = mod(frame, MONSTER_FRAMES[kind] ?? 1);
  const disguised = variant === "disguised" && kind === "mimic";
  const base = cached(store, `${kind}:${f}:${disguised ? "d" : "n"}`, () => {
    const pix = (PAINTERS[kind] ?? dustBunny)(f, disguised);
    return pix.toSprite(Math.floor(pix.w / 2), pix.h);
  });
  return variant === "flash" ? flashSprite(base) : base;
}
