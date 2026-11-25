/**
 * Tips shown one at a time under the loading bar. Each one teaches a piece of
 * the game (which bug becomes which monster, where treasure hides, controls),
 * so the wait doubles as a tutorial. Monster names come from the catalog so a
 * rename there shows up here automatically.
 */
import { MONSTERS } from "@/lib/game/catalog";

export const LOADING_TIPS: readonly string[] = [
  `Unused imports gather into ${MONSTERS.dustBunny.name}s. One good bonk and they poof into coins!`,
  `TODO comments hatch ${MONSTERS.todoMite.name}s. They run away, so corner them!`,
  `Redefined and redundant code attracts ${MONSTERS.echoBat.name}s. Repeats itself. Repeats itself.`,
  `Names that were never defined haunt dungeons as ${MONSTERS.phantom.name}s.`,
  `Swallowed exceptions grow into ${MONSTERS.swallowToad.name}s. Dodge their spit!`,
  `Tangled functions become the ${MONSTERS.spaghetti.name}. Slow, chunky, very bonkable.`,
  `A hardcoded password summons the ${MONSTERS.keyThief.name}, a real boss fight!`,
  "Clean, well-documented files hide treasure chests. Better code, better loot!",
  "Toss your coins into the Wishing Well for hats, pets and legendary weapons.",
  "Whack bushes, pots and crates: there are coins inside more often than not.",
  "Press Shift (or K) to dash. You can't be hurt while dashing!",
  "Chain hits quickly to build a combo. Bigger combos drop more coins.",
  "Lost? Press M for the big map. Red dots are cursed buildings.",
  "Every bug you squash lands in the Codex (C), a real to-do list for the repo.",
];

/** How long each tip stays on screen. */
export const TIP_INTERVAL_MS = 4500;
