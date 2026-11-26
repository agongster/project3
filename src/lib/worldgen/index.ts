/**
 * Procedural world generation: pure, deterministic functions that turn a
 * repo analysis into playable maps. No DOM, no network, no Math.random().
 *
 *   generateOverworld(analysis)        → the village overworld (one per commit)
 *   generateDungeon(file, repoSeed)    → one dungeon for a file with findings
 *   locationLabel(dungeon, x, y)       → "orders.py · def take_order()" for the HUD
 *   reachableFrom(map, start, extra)   → flood fill used for sanity checks
 *   renderAscii(map, overlays)         → a text picture for debugging
 *
 * Note on collision: `map.solid` covers terrain and building footprints only.
 * Solid props (trees, bushes, pots, landmarks...) and villagers block movement
 * too, but are *not* baked into the mask because some of them can be broken
 * at runtime. Pass them to `reachableFrom` as `extraSolid`.
 */
export { generateOverworld } from "./overworld";
export { generateDungeon } from "./dungeon";
export { locationLabel } from "./roomPlan";
export { reachableFrom, solidPropTiles } from "./reachability";
export { renderAscii, type AsciiMark, type AsciiSource } from "./ascii";
export { overworldProblems, dungeonProblems, overworldTargets } from "./validate";
export { buildingKindFor, isTrivialInit, topLevelDir } from "./regions";
