"use client";
/**
 * The gallery sections. Each one lays out a family of sprites.
 */
import type { ComponentType } from "react";
import { Ground, type GroundId, type PropKind, type ThemeId } from "@/lib/types";
import { autotileMask, BUILDING_STATES, drawSprite, getAtlas, PROP_FRAMES, PROP_VARIANTS } from "@/game/art";
import { DEMO_H, DEMO_W, drawDemoScene } from "./demoScene";
import { HeroBackItems, HeroCrowd, HeroHats, HeroOptions } from "./heroSections";
import { Px, Tile } from "./Px";

export interface SectionProps {
  themes: ThemeId[];
  scale: number;
  anim: boolean;
}

const sub: React.CSSProperties = { fontSize: 12, opacity: 0.7, margin: "10px 0 4px" };

function GroundRow({ theme, id, label, scale, masks, variants = 1, frames = 1 }: { theme: ThemeId; id: GroundId; label: string; scale: number; masks?: boolean; variants?: number; frames?: number }) {
  const count = masks ? 16 : Math.max(variants, frames);
  return (
    <div>
      <div style={sub}>{label}</div>
      <Px
        w={count * 18}
        h={18}
        scale={scale}
        animate={frames > 1}
        draw={(ctx, tick) => {
          const a = getAtlas(theme);
          for (let i = 0; i < count; i++) {
            const mask = masks ? i : 15;
            const v = masks ? 0 : i;
            const f = masks ? tick : frames > 1 && variants === 1 ? i : tick;
            drawSprite(ctx, a.ground(id, mask, v, f), i * 18 + 1, 1);
          }
        }}
      />
    </div>
  );
}

function World({ themes, scale }: SectionProps) {
  return (
    <>
      {themes.map((theme) => (
        <div key={theme} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, margin: "8px 0" }}>{theme}</h3>
          <Px w={DEMO_W} h={DEMO_H} scale={scale} animate draw={(ctx, tick) => drawDemoScene(ctx, theme, tick)} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <GroundRow theme={theme} id={Ground.Grass} label="grass ×16" scale={scale} variants={16} />
            <GroundRow theme={theme} id={Ground.Meadow} label="meadow ×16" scale={scale} variants={16} />
            <GroundRow theme={theme} id={Ground.Path} label="path, masks 0–15" scale={scale} masks />
            <GroundRow theme={theme} id={Ground.Plaza} label="plaza, masks 0–15" scale={scale} masks />
            <GroundRow theme={theme} id={Ground.Water} label="water, masks 0–15" scale={scale} masks />
            <GroundRow theme={theme} id={Ground.Sand} label="sand, masks 0–15" scale={scale} masks />
            <GroundRow theme={theme} id={Ground.Water} label="water frames" scale={scale} frames={4} />
          </div>
        </div>
      ))}
      <div style={sub}>bridges over water (east–west and north–south), every theme</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {themes.map((t) => (
          <Px key={t} w={7 * 16} h={5 * 16} scale={scale} animate draw={(ctx, tick) => drawBridgeSample(ctx, t, tick)} />
        ))}
      </div>
      <h3 style={{ fontSize: 14, margin: "8px 0" }}>dungeon (shared by all themes)</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <GroundRow theme="meadow" id={Ground.DungeonFloor} label="floor ×12" scale={scale} variants={12} />
        <GroundRow theme="meadow" id={Ground.DungeonFloorAlt} label="floor alt ×12" scale={scale} variants={12} />
        <GroundRow theme="meadow" id={Ground.DungeonWall} label="wall top, masks 0–15" scale={scale} masks />
        <GroundRow theme="meadow" id={Ground.DungeonWallFace} label="wall face ×4" scale={scale} variants={4} />
        <GroundRow theme="meadow" id={Ground.DungeonExit} label="exit frames" scale={scale} frames={4} />
      </div>
      <div style={sub}>dungeon sample</div>
      <Px w={12 * 16} h={8 * 16} scale={Math.max(1, Math.min(scale, 4))} animate draw={(ctx, tick) => drawDungeonSample(ctx, tick)} />
    </>
  );
}

const BRIDGE_MAP = ["ggwwwgg", "pbbbbbp", "ggwbwgg", "gwwbwwg", "gggpggg"];
const BCODE: Record<string, GroundId> = { g: Ground.Grass, p: Ground.Path, w: Ground.Water, b: Ground.Bridge };

function drawBridgeSample(ctx: CanvasRenderingContext2D, theme: ThemeId, tick: number) {
  const a = getAtlas(theme);
  const at = (x: number, y: number) => (y < 0 || x < 0 || y >= BRIDGE_MAP.length || x >= 7 ? -1 : BCODE[BRIDGE_MAP[y][x]]);
  for (let y = 0; y < BRIDGE_MAP.length; y++) for (let x = 0; x < 7; x++) drawSprite(ctx, a.ground(at(x, y) as GroundId, autotileMask(at, x, y), x * 5 + y * 3, tick), x * 16, y * 16);
}

// W wall top · F face · . floor · , alt floor · V void · X exit
const DUNGEON_MAP = ["VVWWWWWWWWVV", "VVFFFFFFFFVV", "WW........WW", "WF..,,,,..FW", "W...,,,,...W", "W..........W", "WWWWW..WWWWW", "FFFFFXXFFFFF"];
const DCODE: Record<string, GroundId> = { W: Ground.DungeonWall, F: Ground.DungeonWallFace, ".": Ground.DungeonFloor, ",": Ground.DungeonFloorAlt, V: Ground.DungeonVoid, X: Ground.DungeonExit };

function drawDungeonSample(ctx: CanvasRenderingContext2D, tick: number) {
  const a = getAtlas("meadow");
  const at = (x: number, y: number) => (y < 0 || x < 0 || y >= DUNGEON_MAP.length || x >= 12 ? -1 : DCODE[DUNGEON_MAP[y][x]]);
  for (let y = 0; y < DUNGEON_MAP.length; y++)
    for (let x = 0; x < 12; x++) {
      const id = at(x, y) as GroundId;
      // mask helper lives in the art module; inline here to keep the sample tiny
      let m = 0;
      const solid = (g: number) => g < 0 || g === Ground.DungeonWall || g === Ground.DungeonWallFace || g === Ground.DungeonVoid;
      if (solid(at(x, y - 1))) m |= 1;
      if (solid(at(x + 1, y))) m |= 2;
      if (solid(at(x, y + 1))) m |= 4;
      if (solid(at(x - 1, y))) m |= 8;
      drawSprite(ctx, a.ground(id, m, x * 3 + y * 7, tick), x * 16, y * 16);
    }
  const props: [PropKind, number, number, number][] = [
    ["torch", 3, 2, 0],
    ["torch", 8, 1, 1],
    ["pot", 2, 3, 0],
    ["pot", 3, 3, 1],
    ["crate", 9, 3, 0],
    ["bones", 5, 5, 0],
    ["crystal", 9, 5, 1],
    ["web", 2, 2, 0],
    ["plaque", 6, 2, 0],
  ];
  for (const [k, x, y, v] of props) drawSprite(ctx, a.prop(k, v, tick), x * 16 + 8, y * 16 + 16);
}

const PROP_KINDS: PropKind[] = ["tree", "treeAlt", "bush", "rock", "flower", "mushroom", "stump", "lamp", "fence", "bench", "lantern", "sign", "well", "wardrobe", "board", "fountain", "pot", "crate", "torch", "bones", "crystal", "web", "plaque"];

function Props({ themes, scale, anim }: SectionProps) {
  return (
    <>
      {themes.map((theme) => (
        <div key={theme}>
          <h3 style={{ fontSize: 14, margin: "8px 0" }}>{theme}</h3>
          {PROP_KINDS.map((kind) => (
            <Tile
              key={kind}
              label={`${kind} (${PROP_VARIANTS[kind]}v × ${PROP_FRAMES[kind]}f)`}
              scale={scale}
              animate={anim}
              bg={THEME_BG[theme]}
              sprites={() => {
                const a = getAtlas(theme);
                const out = [];
                for (let v = 0; v < PROP_VARIANTS[kind]; v++) for (let f = 0; f < (anim ? PROP_FRAMES[kind] : 1); f++) out.push(a.prop(kind, v, f));
                if (!anim && PROP_FRAMES[kind] > 1) for (let f = 1; f < PROP_FRAMES[kind]; f++) out.push(a.prop(kind, 0, f));
                return out;
              }}
            />
          ))}
        </div>
      ))}
    </>
  );
}

/** Ground-ish backgrounds so props are judged on the colour they will stand on. */
const THEME_BG: Record<ThemeId, string> = { meadow: "#86c95a", sakura: "#a9d892", autumn: "#d0b45c", snow: "#eaf1fa", beach: "#f1dda8", night: "#3a4679" };

function Buildings({ themes, scale }: SectionProps) {
  const kinds = ["cottage", "house", "manor", "tower"] as const;
  return (
    <>
      {themes.map((theme) => (
        <div key={theme}>
          <h3 style={{ fontSize: 14, margin: "8px 0" }}>{theme}</h3>
          {kinds.map((kind) => (
            <div key={kind}>
              {BUILDING_STATES.map((state) => (
                <Tile key={state} label={`${kind} · ${state}`} scale={scale} bg={THEME_BG[theme]} sprites={() => [0, 1, 2, 3].map((v) => getAtlas(theme).building(kind, state, v))} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

export const SECTIONS: { id: string; title: string; Component: ComponentType<SectionProps> }[] = [
  { id: "world", title: "World: demo scene, ground tiles & autotiling", Component: World },
  { id: "props", title: "Props", Component: Props },
  { id: "buildings", title: "Buildings × states × variants", Component: Buildings },
  { id: "characters", title: "Hero options: every option of every category, four directions", Component: HeroOptions },
  { id: "hero-hats", title: "Every hat on every hair style", Component: HeroHats },
  { id: "hero-back", title: "Every back item on every outfit", Component: HeroBackItems },
  { id: "hero-crowd", title: "Random villagers and Surprise-me heroes", Component: HeroCrowd },
];
