/**
 * The per-theme ATLAS: the object the engine asks for world sprites.
 *
 *   const atlas = getAtlas("sakura");
 *   drawSprite(ctx, atlas.ground(Ground.Path, mask, variant, frame), x, y);
 *
 * Sprites are painted the first time they are asked for and cached forever
 * (keyed by the arguments, after reducing `variant`/`frame` modulo how many
 * looks/frames exist), so calling the atlas every frame is cheap.
 */
import type { BuildingKind, GroundId, PropKind, ThemeId } from "@/lib/types";
import { BUILDING_VARIANTS, paintBuilding, type BuildingState } from "./buildings";
import { cached, mod, type Sprite } from "./engine";
import { groundFrames, groundVariants, paintGround, usesMask } from "./ground";
import { paintProp, PROP_FRAMES, PROP_VARIANTS } from "./props";
import { PALETTES } from "./themes";

export interface Atlas {
  theme: ThemeId;
  /** A 16×16 ground tile; anchor is its top-left corner (draw at tx*16, ty*16). */
  ground(id: GroundId, mask: number, variant: number, frame: number): Sprite;
  /** A prop; anchor is the bottom-centre of its base tile (draw at tx*16 + 8, ty*16 + 16). */
  prop(kind: PropKind, variant: number, frame: number): Sprite;
  /** A building; anchor is the bottom-centre of its footprint (draw at (b.x + b.w/2)*16, (b.y + b.h)*16). */
  building(kind: BuildingKind, state: BuildingState, variant: number): Sprite;
}

const atlases = new Map<ThemeId, Atlas>();

function makeAtlas(theme: ThemeId): Atlas {
  const pal = PALETTES[theme] ?? PALETTES.meadow;
  const store = new Map<string, Sprite>();
  return {
    theme,
    ground(id, mask, variant, frame) {
      const v = mod(variant, groundVariants(id));
      const f = mod(frame, groundFrames(id));
      const m = usesMask(id) ? mask & 255 : 15;
      return cached(store, `g${id}:${m}:${v}:${f}`, () => paintGround(pal, id, m, v, f).toSprite(0, 0));
    },
    prop(kind, variant, frame) {
      const v = mod(variant, PROP_VARIANTS[kind] ?? 1);
      const f = mod(frame, PROP_FRAMES[kind] ?? 1);
      return cached(store, `p${kind}:${v}:${f}`, () => {
        const art = paintProp(pal, kind, v, f);
        return art.pix.toSprite(art.ax, art.ay);
      });
    },
    building(kind, state, variant) {
      const v = mod(variant, BUILDING_VARIANTS);
      return cached(store, `b${kind}:${state}:${v}`, () => {
        const art = paintBuilding(pal, kind, state, v);
        return art.pix.toSprite(art.ax, art.ay);
      });
    },
  };
}

/** The atlas for a theme (cached; cheap to call every frame). */
export function getAtlas(theme: ThemeId): Atlas {
  let a = atlases.get(theme);
  if (!a) {
    a = makeAtlas(theme);
    atlases.set(theme, a);
  }
  return a;
}
