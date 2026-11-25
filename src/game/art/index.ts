/**
 * Lintlands art module — every sprite in the game is drawn in code.
 * (Start with engine.ts: it explains the sprite format.)
 *
 * ───────────────────────────── conventions ─────────────────────────────
 * • A `Sprite` is a small <canvas> plus an ANCHOR (ax, ay).
 *   `drawSprite(ctx, sprite, x, y)` puts the anchor on (x, y).
 * • Everything is cached: calling these getters every frame is cheap, and
 *   nothing touches `document` until a sprite is first requested.
 * • `variant` and `frame` arguments accept any integer; they are reduced
 *   modulo the number of looks / frames that exist.
 *
 * ──────────────────────────────── world ────────────────────────────────
 *   const atlas = getAtlas(theme)                       // one per ThemeId
 *   atlas.ground(id, mask, variant, frame)  16×16, anchor top-left → draw at (tx*16, ty*16)
 *       mask    = autotileMask(groundAt, tx, ty)   where groundAt(x, y) returns -1 off the map
 *       variant = any per-tile hash, e.g. (tx*7 + ty*13) & 255
 *       frame   = Math.floor(timeMs / 250)   (water, bridge and dungeon exit animate)
 *   atlas.prop(kind, variant, frame)        anchor = bottom-centre of the base tile → (tx*16 + 8, ty*16 + 16)
 *       frame   = Math.floor(timeMs / 160)   (lamp, lantern, well, fountain, torch, crystal animate)
 *   atlas.building(kind, state, variant)    anchor = bottom-centre of the footprint
 *       → draw at ((b.x + b.w/2)*16, (b.y + b.h)*16); the door is in tile column floor((w-1)/2)
 *   Draw props, buildings and characters sorted by their anchor y.
 *   THEME_COLORS[theme]: backdrop fill, ambient particle colours, night overlay (+ alpha), glow colour.
 *   PROP_LIGHTS + glowSprite(radius, colour): additive light at night / in dungeons.
 *
 * ────────────────────────────── characters ─────────────────────────────
 *   renderCharacter(look, hatId).frame(dir, step)   20×32, anchor (10, 32) = between the feet
 *       dir: "down" | "up" | "left" | "right";  step 0 = stand, 1 / 2 = walking steps
 *       walk by cycling WALK_CYCLE = [1, 0, 2, 0], one entry every ~130 ms
 *   randomLook(seed) → a CharacterLook for villagers (same seed = same person)
 */

// sprite engine
export { canvasSprite, drawSprite, flashSprite, spriteToDataUrl, type DrawOpts, type Sprite } from "./engine";

// world: ground, props, buildings, themes, light
export { getAtlas, type Atlas } from "./atlas";
export { autotileMask, groundFrames, groundVariants, N, E, S, W } from "./ground";
export { PROP_FRAMES, PROP_LIGHTS, PROP_VARIANTS } from "./props";
export { BUILDING_SIZE, BUILDING_STATES, BUILDING_VARIANTS, buildingLights, type BuildingState } from "./buildings";
export { DUNGEON, PALETTES, THEME_COLORS, type ThemeColors, type ThemePalette } from "./themes";
export { glowSprite } from "./light";

// characters
export { CHAR_H, CHAR_W, FACINGS, HAT_IDS, randomLook, renderCharacter, WALK_CYCLE, type CharacterSheet, type Facing } from "./character";
