/**
 * A small hand-laid-out village used by the art gallery to judge tiles,
 * autotile edges, props and buildings in context. It doubles as a worked
 * example of how the engine is expected to use the art API.
 */
import { Ground, type BuildingKind, type GroundId, type PropKind, type ThemeId } from "@/lib/types";
import { autotileMask, buildingLights, drawSprite, getAtlas, glowSprite, PROP_LIGHTS, randomLook, renderCharacter, THEME_COLORS, WALK_CYCLE, type BuildingState, type Facing } from "@/game/art";

// g grass · m meadow · p path · z plaza · w water · s sand · b bridge
const MAP = [
  "gggggggggggggggggggggggggggggggg",
  "gggggggggggggggggggggggggggggggg",
  "gggggggggggggggggggggggggggggggg",
  "gggggggggggggggggggggggggggggggg",
  "gggggggggggggggggggggggggggggggg",
  "gggggggggggggggggggggggggggggggg",
  "ggpggggpgggggpgggggggpgggggpgggg",
  "pppppppppppppppppppppppppppppppp",
  "ggggggggggzzzzzzzzgggggggpgggggg",
  "gmmmggggggzzzzzzzzgggggggpgggggg",
  "gmmmmgggggzzzzzzzzggggggsbsggggg",
  "ggmmggggggzzzzzzzzgggggswbwsgggg",
  "ggggggggggzzzzzzzzggggswwbwwsggg",
  "gggggggggggggppgggggggswwbwwwsgg",
  "gggggggggggggppggggggggswbwwsggg",
  "gggggggggggggppgggggggggspssgggg",
  "gggggggggggggppggggggggggpgggggg",
  "gggggggggggggggggggggggggggggggg",
];

const CODE: Record<string, GroundId> = { g: Ground.Grass, m: Ground.Meadow, p: Ground.Path, z: Ground.Plaza, w: Ground.Water, s: Ground.Sand, b: Ground.Bridge };

export const DEMO_W = MAP[0].length * 16;
export const DEMO_H = MAP.length * 16;

const BUILDINGS: { kind: BuildingKind; x: number; y: number; w: number; h: number; state: BuildingState; variant: number }[] = [
  { kind: "cottage", x: 2, y: 4, w: 2, h: 2, state: "clean", variant: 0 },
  { kind: "house", x: 6, y: 4, w: 3, h: 2, state: "corrupted", variant: 1 },
  { kind: "manor", x: 11, y: 3, w: 4, h: 3, state: "restored", variant: 2 },
  { kind: "tower", x: 18, y: 3, w: 2, h: 3, state: "clean", variant: 3 },
  { kind: "house", x: 23, y: 4, w: 3, h: 2, state: "restored", variant: 5 },
  { kind: "cottage", x: 27, y: 4, w: 2, h: 2, state: "corrupted", variant: 6 },
];

const PROPS: { kind: PropKind; x: number; y: number; v?: number }[] = [
  { kind: "tree", x: 0, y: 1 },
  { kind: "treeAlt", x: 5, y: 1, v: 1 },
  { kind: "tree", x: 9, y: 1, v: 2 },
  { kind: "treeAlt", x: 16, y: 1 },
  { kind: "tree", x: 21, y: 1, v: 1 },
  { kind: "treeAlt", x: 30, y: 2, v: 2 },
  { kind: "tree", x: 1, y: 13, v: 1 },
  { kind: "tree", x: 7, y: 15 },
  { kind: "treeAlt", x: 4, y: 16, v: 2 },
  { kind: "tree", x: 30, y: 15, v: 2 },
  { kind: "treeAlt", x: 20, y: 9, v: 0 },
  { kind: "bush", x: 5, y: 10 },
  { kind: "bush", x: 8, y: 12, v: 1 },
  { kind: "bush", x: 19, y: 13, v: 2 },
  { kind: "rock", x: 22, y: 16 },
  { kind: "rock", x: 9, y: 9, v: 1 },
  { kind: "flower", x: 4, y: 12, v: 0 },
  { kind: "flower", x: 17, y: 16, v: 1 },
  { kind: "mushroom", x: 3, y: 15 },
  { kind: "stump", x: 27, y: 17 },
  { kind: "fountain", x: 14, y: 11 },
  { kind: "well", x: 11, y: 10 },
  { kind: "board", x: 16, y: 9 },
  { kind: "wardrobe", x: 17, y: 12 },
  { kind: "sign", x: 12, y: 14 },
  { kind: "lamp", x: 10, y: 8 },
  { kind: "lamp", x: 17, y: 8 },
  { kind: "lamp", x: 24, y: 8 },
  { kind: "bench", x: 15, y: 14 },
  { kind: "lantern", x: 9, y: 13 },
  { kind: "fence", x: 22, y: 6, v: 2 },
  { kind: "fence", x: 23, y: 6, v: 0 },
  { kind: "fence", x: 24, y: 6, v: 0 },
];

/** A few villagers (x, y in pixels) walking in place, plus the hero with a hat. */
const PEOPLE: { seed: number; x: number; y: number; dir: Facing; hat: string | null; walk: boolean }[] = [
  { seed: 0, x: 13 * 16, y: 14 * 16 + 8, dir: "down", hat: "wizardHat", walk: true },
  { seed: 3, x: 7 * 16, y: 8 * 16, dir: "right", hat: null, walk: true },
  { seed: 8, x: 20 * 16, y: 8 * 16 + 4, dir: "left", hat: "strawHat", walk: false },
  { seed: 12, x: 18 * 16, y: 11 * 16, dir: "up", hat: null, walk: false },
  { seed: 5, x: 4 * 16, y: 11 * 16, dir: "down", hat: "flowerCrown", walk: false },
];

export function drawDemoScene(ctx: CanvasRenderingContext2D, theme: ThemeId, tick: number): void {
  const atlas = getAtlas(theme);
  const at = (x: number, y: number) => (y < 0 || x < 0 || y >= MAP.length || x >= MAP[0].length ? -1 : CODE[MAP[y][x]]);
  for (let y = 0; y < MAP.length; y++) {
    for (let x = 0; x < MAP[0].length; x++) {
      const id = at(x, y) as GroundId;
      const variant = (x * 7 + y * 13 + ((x * y) % 5)) & 255;
      drawSprite(ctx, atlas.ground(id, autotileMask(at, x, y), variant, Math.floor(tick / 3)), x * 16, y * 16);
    }
  }
  // y-sort buildings and props by their base so things overlap correctly
  const items: { y: number; draw: () => void }[] = [];
  for (const b of BUILDINGS) {
    items.push({ y: (b.y + b.h) * 16, draw: () => drawSprite(ctx, atlas.building(b.kind, b.state, b.variant), (b.x + b.w / 2) * 16, (b.y + b.h) * 16) });
  }
  for (const p of PROPS) {
    items.push({ y: p.y * 16 + 16, draw: () => drawSprite(ctx, atlas.prop(p.kind, p.v ?? 0, tick), p.x * 16 + 8, p.y * 16 + 16) });
  }
  for (const person of PEOPLE) {
    const look = randomLook(person.seed);
    const step = person.walk ? WALK_CYCLE[tick % 4] : 0;
    items.push({ y: person.y, draw: () => drawSprite(ctx, renderCharacter(look, person.hat).frame(person.dir, step), person.x, person.y) });
  }
  items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());

  const colors = THEME_COLORS[theme];
  if (colors.overlayAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = colors.overlayAlpha;
    ctx.fillStyle = colors.overlay;
    ctx.fillRect(0, 0, DEMO_W, DEMO_H);
    ctx.restore();
  }
  // light: additive glows (lamps and windows at night; cursed doorways always)
  const dark = theme === "night";
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of PROPS) {
    const l = PROP_LIGHTS[p.kind];
    if (!l || (l.night && !dark)) continue;
    drawSprite(ctx, glowSprite(l.radius, l.color), p.x * 16 + 8 + l.dx, p.y * 16 + 16 + l.dy);
  }
  for (const b of BUILDINGS) {
    for (const l of buildingLights(b.kind, b.state)) {
      if (!l.always && !dark) continue;
      drawSprite(ctx, glowSprite(l.radius, l.color), (b.x + b.w / 2) * 16 + l.dx, (b.y + b.h) * 16 + l.dy);
    }
  }
  ctx.restore();
}
