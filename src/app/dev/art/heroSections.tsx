"use client";
/**
 * The hero gallery sections of /dev/art: every option of every category on
 * a plain hero in all four directions, every hat on every hair style, every
 * back item on every outfit, walk cycles, and a crowd of random villagers.
 * Meant for judging the whole set at a glance (and spotting clipping).
 */
import { FACINGS, HAT_IDS, randomLook, renderCharacter, SURPRISE_ODDS, type Facing } from "@/game/art";
import { BACK_ITEMS, HAIR_STYLE_ORDER, HAIR_STYLES, OUTFIT_ORDER, OUTFITS } from "@/lib/game/catalog";
import { choicesFor, SECTIONS as LOOK_SECTIONS } from "@/components/character/lookSections";
import { PRESETS, presetLook } from "@/components/character/lookPresets";
import type { CharacterLook } from "@/lib/types";
import { Tile } from "./Px";

interface Props {
  scale: number;
  anim: boolean;
}

/** A plain hero every option is tried on: short brown hair, blue tee, nothing extra. */
const PLAIN: CharacterLook = {
  name: "Hero",
  skin: 1,
  hairStyle: 0,
  hairColor: 1,
  outfit: 0,
  outfitColor: 5,
  outfitColor2: 0,
  eyes: 1,
  eyeColor: 0,
  mouth: 0,
  faceDetail: 0,
  eyewear: 0,
  facialHair: 0,
  backItem: 0,
};

/** Three very different heroes for the walk cycles. */
const WALKERS = ["Knight", "Star mage", "Skater"].map((title) => presetLook(PRESETS.find((p) => p.title === title) ?? PRESETS[0], title));

const sub: React.CSSProperties = { fontSize: 12, opacity: 0.7, margin: "10px 0 4px" };

function frames(look: CharacterLook, hat: string | null, dirs: readonly Facing[] = FACINGS, steps = [0]) {
  const sheet = renderCharacter(look, hat);
  return dirs.flatMap((dir) => steps.map((step) => sheet.frame(dir, step)));
}

/** Every option of every category, four directions each. */
export function HeroOptions({ scale }: Props) {
  const big = Math.max(scale, 3);
  return (
    <>
      <div style={sub}>walk cycles: down · left · up · right × stand / step A / step B</div>
      {WALKERS.map((look) => (
        <Tile key={look.name} label={look.name} scale={big} sprites={() => frames(look, null, FACINGS, [0, 1, 2])} />
      ))}
      {LOOK_SECTIONS.flatMap((section) => section.groups).map((group) => (
        <div key={group.field}>
          <div style={sub}>{group.label}: down · left · up · right</div>
          {choicesFor(group.field, PLAIN).map((choice) => (
            <Tile key={choice.value} label={choice.name} scale={big} sprites={() => frames({ ...PLAIN, [group.field]: choice.value }, null)} />
          ))}
        </div>
      ))}
    </>
  );
}

/** Every hat on every hair style, in one direction per row group. */
export function HeroHats({ scale }: Props) {
  return (
    <>
      {(["down", "left", "up"] as const).map((dir) => (
        <div key={dir}>
          <div style={sub}>{dir}: each row = a hair style; no hat, then every hat</div>
          {HAIR_STYLE_ORDER.map((style, row) => (
            <Tile
              key={style}
              label={HAIR_STYLES[style]}
              scale={scale}
              sprites={() => [null, ...HAT_IDS].flatMap((hat) => frames({ ...PLAIN, hairStyle: style, hairColor: [1, 3, 11, 13][row % 4], skin: [1, 3, 9, 0][row % 4] }, hat, [dir]))}
            />
          ))}
        </div>
      ))}
    </>
  );
}

/** Every back item on every outfit, from behind and from the side, with long hair. */
export function HeroBackItems({ scale }: Props) {
  return (
    <>
      {BACK_ITEMS.slice(1).map((item, index) => (
        <div key={item}>
          <div style={sub}>{item}: every outfit, from behind and from the side (long hair, then short)</div>
          {OUTFIT_ORDER.map((outfit) => (
            <Tile
              key={outfit}
              label={OUTFITS[outfit]}
              scale={scale}
              sprites={() => [
                ...frames({ ...PLAIN, backItem: index + 1, outfit, hairStyle: 2 }, null, ["up", "left"]),
                ...frames({ ...PLAIN, backItem: index + 1, outfit }, null, ["down", "right"]),
              ]}
            />
          ))}
        </div>
      ))}
    </>
  );
}

/** 60 random villagers and 20 "Surprise me" heroes; every third one wears a hat. */
export function HeroCrowd({ scale, anim }: Props) {
  const crowd = [...Array.from({ length: 60 }, (_, i) => randomLook(i + 1)), ...Array.from({ length: 20 }, (_, i) => randomLook(1000 + i, SURPRISE_ODDS))];
  return (
    <div style={{ display: "flex", flexWrap: "wrap" }}>
      {crowd.map((look, i) => {
        const hat = i % 3 === 0 ? HAT_IDS[i % HAT_IDS.length] : null;
        return <Tile key={i} label={`${i < 60 ? `#${i + 1}` : "surprise"} ${look.name}`} scale={Math.max(scale, 3)} animate={anim} sprites={() => frames(look, hat, ["down"], anim ? [1, 0, 2, 0] : [0])} />;
      })}
    </div>
  );
}
