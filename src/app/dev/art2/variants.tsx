"use client";
/**
 * Gallery sections for monster LOOKS (src/lib/game/monsterLooks.ts) and the
 * lair marks: every colour family × feature of every species, its markings
 * and size steps, then the boss / champion badges, banners, map marks and
 * the champion's crown.
 */
import type { CSSProperties } from "react";
import { MONSTER_KINDS } from "@/lib/types";
import { MONSTERS } from "@/lib/game/catalog";
import { familyName, LOOK_FAMILIES, LOOK_FEATURES, LOOK_MARKINGS, lookScale, MARKED_KINDS, PLAIN_LOOK, SIZE_STEP_SCALE } from "@/lib/game/monsterLooks";
import { drawSprite } from "@/game/art/engine";
import { MONSTER_FRAMES, monsterSprite } from "@/game/art/monsters";
import { championCrownSprite, CROWN_FRAMES, LAIR_BANNER_FRAMES, lairBadgeSprite, lairBannerSprite, mapMarkSprite, type LairMarkKind } from "@/game/art/monstersMarks";
import { Px, Row } from "./Px";
import type { SectionProps } from "./sections";

/** Backgrounds the variants are judged on (the dungeon floor is where they live). */
const FLOOR = "#5b5070";
const GRASS = "#86c95a";
/** Minimap building colours the map marks must read on: cursed, quiet-ish grey, clear. */
const MAP_BGS = ["#ff4d6d", "#9a8fb0", "#5ee38a", "#2d2640"];
const SIZE_STEPS = [-1, 0, 1];
const LAIR_KINDS: LairMarkKind[] = ["boss", "champion"];

const sub: CSSProperties = { fontSize: 12, opacity: 0.7, margin: "10px 0 4px" };
const species: CSSProperties = { fontSize: 13, fontWeight: 700, margin: "14px 0 2px" };

/** Each species: a row per colour family (one sprite per feature), its markings and its size steps (bosses keep their size). */
export function Variants({ scale, anim, only }: SectionProps) {
  return (
    <>
      {MONSTER_KINDS.filter((kind) => !only || only.includes(kind)).map((kind) => {
        const frames = (look: typeof PLAIN_LOOK) => Array.from({ length: MONSTER_FRAMES[kind] }, (_, f) => monsterSprite(kind, f, "normal", look));
        return (
          <div key={kind}>
            <div style={species}>{MONSTERS[kind].name}</div>
            <div style={sub}>columns: {LOOK_FEATURES[kind].join(" · ")}</div>
            {LOOK_FAMILIES[kind].map((family, i) => (
              <Row
                key={family.name}
                label={`${familyName(kind, i)} · ${[...(family.codes ?? []), ...(family.prefixes ?? []).map((p) => `${p}…`)].join(" ")}`}
                scale={scale}
                animate={anim}
                bg={FLOOR}
                sprites={() => (anim ? frames({ ...PLAIN_LOOK, family: i }) : LOOK_FEATURES[kind].map((_, feature) => monsterSprite(kind, 0, "normal", { ...PLAIN_LOOK, family: i, feature })))}
              />
            ))}
            {MARKED_KINDS.has(kind) && (
              <Row label={`markings: ${LOOK_MARKINGS.join(" · ")}`} scale={scale} bg={FLOOR} sprites={() => LOOK_MARKINGS.map((_, marking) => monsterSprite(kind, 0, "normal", { ...PLAIN_LOOK, marking }))} />
            )}
            {MONSTERS[kind].severity !== "boss" && <SizeSteps kind={kind} scale={scale} />}
          </div>
        );
      })}
    </>
  );
}

/** The classic look at the three size steps, drawn scaled like the engine does. */
function SizeSteps({ kind, scale }: { kind: (typeof MONSTER_KINDS)[number]; scale: number }) {
  const size = MONSTERS[kind].size;
  const cell = Math.ceil(size * (1 + SIZE_STEP_SCALE)) + 4;
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", margin: 4, verticalAlign: "top" }}>
      <Px
        w={cell * SIZE_STEPS.length}
        h={cell}
        scale={scale}
        bg={FLOOR}
        draw={(ctx) => {
          const sprite = monsterSprite(kind, 0);
          SIZE_STEPS.forEach((sizeStep, i) => drawSprite(ctx, sprite, i * cell + cell / 2, cell - 2, { scale: lookScale({ ...PLAIN_LOOK, sizeStep }) }));
        }}
      />
      <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>size steps −1 · 0 · +1</div>
    </div>
  );
}

/** How much bigger a champion is drawn (CHAMPION_STATS.sizeScale in src/lib/game/champions.ts). */
const CHAMPION_PREVIEW_SCALE = 1.4;
const PREVIEW_PX = 40;

/** A champion-sized gremlin with the crown on its head, as the dungeon will show it. */
function CrownedChampion({ scale, bg }: { scale: number; bg: string }) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", margin: 4, verticalAlign: "top" }}>
      <Px
        w={PREVIEW_PX}
        h={PREVIEW_PX}
        scale={scale}
        bg={bg}
        draw={(ctx) => {
          const feetY = PREVIEW_PX - 2;
          const body = monsterSprite("gremlin", 0);
          drawSprite(ctx, body, PREVIEW_PX / 2, feetY, { scale: CHAMPION_PREVIEW_SCALE });
          drawSprite(ctx, championCrownSprite(0), PREVIEW_PX / 2, Math.round(feetY - body.h * CHAMPION_PREVIEW_SCALE + 3));
        }}
      />
      <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>a crowned champion (×{CHAMPION_PREVIEW_SCALE})</div>
    </div>
  );
}

/** Badges, banners, map marks and the champion crown, on the backgrounds they are drawn over. */
export function LairMarks({ scale, anim }: SectionProps) {
  return (
    <>
      {[GRASS, FLOOR].map((bg) => (
        <div key={bg}>
          <div style={sub}>on {bg === GRASS ? "grass" : "dungeon floor"} — magenta dot = anchor</div>
          {LAIR_KINDS.map((kind) => (
            <Row key={`badge-${kind}`} label={`${kind} badge`} scale={scale} bg={bg} marks sprites={() => [lairBadgeSprite(kind)]} />
          ))}
          {LAIR_KINDS.map((kind) => (
            <Row
              key={`banner-${kind}`}
              label={`${kind} banner · ${LAIR_BANNER_FRAMES}f`}
              scale={scale}
              animate={anim}
              bg={bg}
              marks={!anim}
              sprites={() => Array.from({ length: LAIR_BANNER_FRAMES }, (_, f) => lairBannerSprite(kind, f))}
            />
          ))}
          <Row label={`crown · ${CROWN_FRAMES}f`} scale={scale} animate={anim} bg={bg} marks={!anim} sprites={() => Array.from({ length: CROWN_FRAMES }, (_, f) => championCrownSprite(f))} />
          <CrownedChampion scale={scale} bg={bg} />
        </div>
      ))}
      <div style={sub}>map marks on minimap building colours</div>
      {MAP_BGS.map((bg) => (
        <Row key={bg} label={bg} scale={scale} bg={bg} marks sprites={() => LAIR_KINDS.map((kind) => mapMarkSprite(kind))} />
      ))}
    </>
  );
}
