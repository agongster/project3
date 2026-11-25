"use client";

/**
 * The chunky "LINTLANDS" logo: each letter bobs a beat after the previous
 * one (a little wave), the hero walks up on the left, and on the right a few
 * of the bugs you will meet hop about next to a treasure chest.
 */
import type { CSSProperties } from "react";
import { monsterSprite } from "@/game/art/monsters";
import { uiSprite } from "@/game/art/ui";
import { CharacterPreview } from "@/components/character/CharacterPreview";
import { useTicker } from "@/components/character/useTicker";
import { SpriteView } from "@/components/ui/kit";
import type { CharacterLook, MonsterKind } from "@/lib/types";

const WORD_GREEN = "LINT";
const WORD_GOLD = "LANDS";
/** Delay between neighbouring letters' bobs, which makes the wave. */
const LETTER_DELAY_S = 0.12;
/** Monsters advance a frame this often (the art module suggests ~180 ms). */
const MONSTER_FRAME_MS = 180;
const PARADE: readonly MonsterKind[] = ["dustBunny", "gremlin", "echoBat"];

/** A thick ink outline + drop shadow made of hard (unblurred) text shadows. */
const OUTLINE = [
  "4px 0 0 #2b1b3d",
  "-4px 0 0 #2b1b3d",
  "0 4px 0 #2b1b3d",
  "0 -4px 0 #2b1b3d",
  "4px 4px 0 #2b1b3d",
  "-4px 4px 0 #2b1b3d",
  "4px -4px 0 #2b1b3d",
  "-4px -4px 0 #2b1b3d",
  "0 10px 0 rgb(0 0 0 / 0.35)",
].join(", ");

/** Scales with the window, using whichever of width or height is tighter. */
const LETTERS_STYLE: CSSProperties = { fontSize: "clamp(30px, min(6.2vw, 8.5vh), 76px)", textShadow: OUTLINE };

function Letters({ text, color, firstIndex }: { text: string; color: string; firstIndex: number }) {
  return (
    <>
      {[...text].map((letter, i) => (
        <span key={i} className="anim-bob inline-block" style={{ color, animationDelay: `${(firstIndex + i) * LETTER_DELAY_S}s` }}>
          {letter}
        </span>
      ))}
    </>
  );
}

function MonsterParade() {
  const frame = useTicker(MONSTER_FRAME_MS);
  return (
    <div className="flex items-end gap-2" aria-hidden>
      {PARADE.map((kind, i) => (
        <div key={kind} className="anim-bob" style={{ animationDelay: `${i * 0.3}s` }}>
          <SpriteView sprite={monsterSprite(kind, frame + i)} scale={3} flipX />
        </div>
      ))}
      <SpriteView sprite={uiSprite("chestClosed")} scale={3} />
    </div>
  );
}

interface Props {
  look: CharacterLook;
  hatId: string | null;
}

export function Logo({ look, hatId }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-end gap-4 md:gap-8">
        <div className="hidden md:block" aria-hidden>
          <CharacterPreview look={look} hatId={hatId} scale={3} facing="right" />
        </div>
        <h1 className="whitespace-nowrap font-title leading-none tracking-normal" style={LETTERS_STYLE} aria-label="Lintlands">
          <Letters text={WORD_GREEN} color="var(--color-leaf)" firstIndex={0} />
          <Letters text={WORD_GOLD} color="var(--color-gold)" firstIndex={WORD_GREEN.length} />
        </h1>
        <div className="hidden lg:block">
          <MonsterParade />
        </div>
      </div>
      <p className="bg-night/80 px-4 py-1 text-center text-[16px] font-semibold text-cream" style={{ boxShadow: TAGLINE_SHADOW }}>
        Turn a Python repo into a pixel world. Squash its bugs. Loot its clean code.
      </p>
    </div>
  );
}

const TAGLINE_SHADOW = "0 -3px 0 0 #0f0b1f, 0 3px 0 0 #0f0b1f, -3px 0 0 0 #0f0b1f, 3px 0 0 0 #0f0b1f";
