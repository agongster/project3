"use client";
/**
 * The gallery sections, one per sprite family.
 */
import type { ComponentType, CSSProperties } from "react";
import { MONSTER_KINDS } from "@/lib/types";
import { MONSTERS } from "@/lib/game/catalog";
import { MONSTER_FRAMES, monsterSprite } from "@/game/art/monsters";
import { drawText, FONT_LINE_HEIGHT, measureText } from "@/game/art/font";
import { drawSprite } from "@/game/art/engine";
import { PROJECTILE_FRAMES, projectileSprite, weaponSprite, type ProjectileName } from "@/game/art/weapons";
import { ALL_ITEMS, WEAPONS } from "@/lib/game/catalog";
import { itemIcon } from "@/game/art/items";
import { PET_FRAMES, petSprite } from "@/game/art/pets";
import { rarityGlow, UI_FRAMES, UI_SPRITE_NAMES, uiSprite } from "@/game/art/ui";
import { RARITIES } from "@/lib/game/catalog";
import { Px, Row } from "./Px";

export interface SectionProps {
  scale: number;
  anim: boolean;
  /** Optional id filter from ?only= */
  only?: string[];
}

/** True when `id` passes the ?only= filter. */
export const pick = (only: string[] | undefined, id: string) => !only || only.includes(id);

/** Backgrounds the sprites are judged on. */
export const BG = { grass: "#86c95a", dungeon: "#5b5070", deep: "#2d2640", cream: "#fff4dc", panel: "#3b3253" };

const sub: CSSProperties = { fontSize: 12, opacity: 0.7, margin: "10px 0 4px" };

function Monsters({ scale, anim, only }: SectionProps) {
  return (
    <>
      {[BG.grass, BG.dungeon].map((bg) => (
        <div key={bg}>
          <div style={sub}>on {bg === BG.grass ? "grass" : "dungeon floor"}</div>
          {MONSTER_KINDS.filter((k) => pick(only, k)).map((kind) => (
            <Row
              key={kind}
              label={`${MONSTERS[kind].name} · ${MONSTERS[kind].size}px · ${MONSTER_FRAMES[kind]}f`}
              scale={scale}
              animate={anim}
              bg={bg}
              sprites={() => {
                const n = MONSTER_FRAMES[kind];
                const frames = Array.from({ length: n }, (_, f) => monsterSprite(kind, f));
                if (anim) return frames;
                const extra = [monsterSprite(kind, 0, "flash")];
                if (kind === "mimic") extra.push(monsterSprite(kind, 0, "disguised"), monsterSprite(kind, 1, "disguised"));
                return [...frames, ...extra];
              }}
            />
          ))}
        </div>
      ))}
    </>
  );
}

const SLOTS = ["weapon", "charm", "hat", "pet", "trail"] as const;

function Items({ scale, only }: SectionProps) {
  return (
    <>
      {SLOTS.map((slot) => (
        <div key={slot}>
          <div style={sub}>{slot}s</div>
          {[BG.cream, BG.panel].map((bg) => (
            <div key={bg} style={{ display: "flex", flexWrap: "wrap", background: bg, padding: 4, marginBottom: 4, color: bg === BG.cream ? "#3b3253" : "#efe6ff" }}>
              {ALL_ITEMS.filter((it) => it.slot === slot && pick(only, it.id)).map((it) => (
                <Row key={it.id} label={it.name} scale={scale} bg={bg} sprites={() => [itemIcon(it.id)]} />
              ))}
              {slot === "trail" && <Row label="(unknown id)" scale={scale} bg={bg} sprites={() => [itemIcon("no-such-item")]} />}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function Pets({ scale, anim, only }: SectionProps) {
  return (
    <>
      {[BG.grass, BG.dungeon].map((bg) => (
        <div key={bg}>
          {ALL_ITEMS.filter((it) => it.slot === "pet" && pick(only, it.id)).map((it) => (
            <Row key={it.id} label={`${it.name} · ${PET_FRAMES}f`} scale={scale} animate={anim} bg={bg} marks={!anim} sprites={() => Array.from({ length: PET_FRAMES }, (_, f) => petSprite(it.id, f))} />
          ))}
        </div>
      ))}
    </>
  );
}

function Ui({ scale, anim, only }: SectionProps) {
  return (
    <>
      {[BG.grass, BG.deep, BG.cream].map((bg) => (
        <div key={bg}>
          <div style={sub}>on {bg} — magenta dot = anchor</div>
          {UI_SPRITE_NAMES.filter((n) => pick(only, n)).map((n) => (
            <Row key={n} label={`${n} · ${UI_FRAMES[n]}f`} scale={scale} animate={anim} bg={bg} marks={!anim} sprites={() => Array.from({ length: UI_FRAMES[n] }, (_, f) => uiSprite(n, f))} />
          ))}
          {RARITIES.map((r) => (
            <Row key={r} label={`rarityGlow(${r})`} scale={scale} bg={bg} marks sprites={() => [rarityGlow(r)]} />
          ))}
        </div>
      ))}
      <div style={sub}>in context: HUD hearts + coins, a chest on its glow, a slash around a hero position</div>
      <Px
        w={120}
        h={48}
        scale={scale}
        bg={BG.dungeon}
        animate={anim}
        draw={(ctx, tick) => {
          ["heartFull", "heartFull", "heartHalf", "heartEmpty"].forEach((h, i) => drawSprite(ctx, uiSprite(h as "heartFull"), 8 + i * 10, 12));
          drawSprite(ctx, uiSprite("coin", tick), 52, 12);
          drawSprite(ctx, uiSprite("chestGlow"), 24, 34);
          drawSprite(ctx, uiSprite("chestClosed"), 24, 40);
          drawSprite(ctx, uiSprite("shadowMedium"), 70, 40);
          drawSprite(ctx, uiSprite("slash", tick), 70, 34);
          drawSprite(ctx, uiSprite("keyE"), 100, 40);
          drawSprite(ctx, uiSprite("alert"), 100, 22);
        }}
      />
    </>
  );
}

function Weapons({ scale, only }: SectionProps) {
  const angles = [0, Math.PI / 4, Math.PI / 2];
  return (
    <>
      <div style={sub}>in hand at 0° / 45° / 90°; the magenta dot is the grip pivot (anchor)</div>
      {WEAPONS.filter((w) => pick(only, w.id)).map((w) => (
        <div key={w.id} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", margin: 4 }}>
          <Px
            w={3 * 40}
            h={40}
            scale={scale}
            bg={BG.grass}
            draw={(ctx) => {
              const s = weaponSprite(w.id);
              angles.forEach((a, i) => {
                const cx = i * 40 + 12;
                const cy = 20;
                drawSprite(ctx, s, cx, cy, { rotation: a });
                ctx.fillStyle = "#ff00ff";
                ctx.fillRect(cx, cy, 1, 1);
              });
            }}
          />
          <div style={{ fontSize: 11, opacity: 0.8 }}>{w.name} · {w.style}</div>
        </div>
      ))}
    </>
  );
}

const PROJECTILES: ProjectileName[] = ["duck", "goldenDuck", "arrow", "spark", "boomerang", "wave", "spit", "orb", "key", "glitchBlock", "noodle"];

function Projectiles({ scale, anim, only }: SectionProps) {
  return (
    <>
      {[BG.grass, BG.deep].map((bg) => (
        <div key={bg}>
          {PROJECTILES.filter((n) => pick(only, n)).map((n) => (
            <Row key={n} label={`${n} · ${PROJECTILE_FRAMES[n]}f`} scale={scale} animate={anim} bg={bg} marks={!anim} sprites={() => Array.from({ length: PROJECTILE_FRAMES[n] }, (_, f) => projectileSprite(n, f))} />
          ))}
        </div>
      ))}
    </>
  );
}

const FONT_SAMPLES = [
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "abcdefghijklmnopqrstuvwxyz",
  "0123456789",
  "_ . / : ( ) [ ] ' \" ! ? + - = # % & , ; < > @ * ~ $ ^ ` { } | \\",
  "The quick brown fox jumps over the lazy dog.",
  "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG!",
  "utils/parse_config.py  src/__init__.py  tests/test_api.py",
  "Lv 3 · 120 coins · 5/12 bugs left · E: open (chest)",
  "unknown: é ✓ €",
];

const DAMAGE = [
  { t: "-1", c: "#ffffff" },
  { t: "-3", c: "#ffd34d" },
  { t: "CRIT! -8", c: "#ff5a6e" },
  { t: "+12", c: "#ffe066" },
  { t: "+1 HP", c: "#7dff8a" },
  { t: "MISS", c: "#b9a8d8" },
];

function Font({ scale }: SectionProps) {
  const lineGap = FONT_LINE_HEIGHT + 3;
  return (
    <>
      {[1, 2, 3].map((s) => (
        <div key={s}>
          <div style={sub}>font at {s}× (shown at {Math.max(1, Math.floor(scale / s))}× zoom)</div>
          <Px
            w={Math.max(...FONT_SAMPLES.map((t) => measureText(t, s))) + 8}
            h={(FONT_SAMPLES.length * lineGap + 4) * s}
            scale={Math.max(1, Math.floor(scale / s))}
            bg={BG.panel}
            draw={(ctx) => FONT_SAMPLES.forEach((t, i) => drawText(ctx, t, 4, (2 + i * lineGap) * s, { color: i % 2 ? "#fff4dc" : "#ffffff", outline: i === FONT_SAMPLES.length - 1 ? "#2b1d34" : null, scale: s }))}
          />
        </div>
      ))}
      <div style={sub}>outlined labels &amp; damage numbers on grass / dungeon / cream</div>
      {[BG.grass, BG.dungeon, BG.cream].map((bg) => (
        <Px
          key={bg}
          w={260}
          h={44}
          scale={Math.max(1, Math.floor(scale / 1.5))}
          bg={bg}
          draw={(ctx) => {
            drawText(ctx, "utils/parse_config.py", 4, 4, { color: "#fff4dc" });
            drawText(ctx, "models/user_profile.py", 130, 4, { color: "#ffd6f5" });
            let x = 6;
            for (const d of DAMAGE) {
              drawText(ctx, d.t, x, 20, { color: d.c });
              x += measureText(d.t) + 8;
            }
            drawText(ctx, "-5", 200, 26, { color: "#ffd34d", scale: 2 });
            drawText(ctx, "centred", 130, 34, { color: "#ffffff", align: "center", alpha: 0.6 });
          }}
        />
      ))}
    </>
  );
}

export const SECTIONS: { id: string; title: string; Component: ComponentType<SectionProps> }[] = [
  { id: "monsters", title: "Monsters (frames · flash · mimic disguise)", Component: Monsters },
  { id: "items", title: "Item icons (16×16, on cream UI and dark panels)", Component: Items },
  { id: "weapons", title: "In-hand weapons", Component: Weapons },
  { id: "projectiles", title: "Projectiles (centre anchor marked)", Component: Projectiles },
  { id: "pets", title: "Pets (bottom-centre anchor marked)", Component: Pets },
  { id: "ui", title: "UI & effect sprites", Component: Ui },
  { id: "font", title: "Bitmap font", Component: Font },
];
