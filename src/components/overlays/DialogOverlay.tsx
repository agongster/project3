"use client";

/**
 * A classic RPG dialogue box along the bottom of the game: speaker name tab,
 * portrait, and text that types itself out with little "talk" blips.
 *
 * Space / Enter / E or a click: the first press finishes the line, the next
 * one moves on; after the last line the box closes (which resumes the game).
 */
import { useEffect, useEffectEvent, useState } from "react";
import { getAtlas, randomLook, renderCharacter } from "@/game/art";
import { ArtSprite } from "@/components/hud/ArtSprite";
import { ap, HUD_FONT_SIZE } from "@/components/hud/units";
import { useStore } from "@/lib/game/useStore";
import { hashString } from "@/lib/rng";
import type { PropKind, ThemeId } from "@/lib/types";
import type { OverlayProps } from "./types";

/** Typing speed: one character every this many ms. */
const CHAR_MS = 28;
/** A "talk" blip every this many characters (every character would be a buzz). */
const BLIP_EVERY = 3;
/** Keys that complete / advance the dialogue. */
const ADVANCE_KEYS = new Set([" ", "Enter", "e", "E"]);
/** Portraits are this many art pixels square. */
const PORTRAIT_ART_PX = 36;

/** Speakers that are objects rather than people get the object's sprite as their portrait. */
const OBJECT_SPEAKERS: ReadonlyMap<string, PropKind> = new Map([
  ["sign", "sign"],
  ["signpost", "sign"],
  ["plaque", "plaque"],
  ["board", "board"],
  ["notice board", "board"],
]);

function objectKind(speaker: string): PropKind | undefined {
  return OBJECT_SPEAKERS.get(speaker.trim().toLowerCase());
}

/** Each person gets their own (repeatable) look and voice pitch from their name. */
function portraitSprite(speaker: string, theme: ThemeId) {
  const prop = objectKind(speaker);
  if (prop) return getAtlas(theme).prop(prop, 0, 0);
  return renderCharacter(randomLook(hashString(speaker)), null).frame("down", 0);
}

function voicePitch(speaker: string): number {
  return 0.85 + (hashString(speaker) % 40) / 100;
}

export default function DialogOverlay({ request, ctx }: OverlayProps<"dialog">) {
  const { speaker, lines } = request;
  const theme = useStore(ctx.save, (s) => s.theme);
  const [lineIndex, setLineIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const text = lines[lineIndex] ?? "";
  const lineDone = typed >= text.length;
  const isLast = lineIndex >= lines.length - 1;

  // Type the current line one character at a time.
  useEffect(() => {
    if (typed >= text.length) return;
    if (typed > 0 && typed % BLIP_EVERY === 0 && text[typed] !== " ") ctx.audio.sfx("talk", { pitch: voicePitch(speaker) });
    const timer = setTimeout(() => setTyped((t) => t + 1), CHAR_MS);
    return () => clearTimeout(timer);
  }, [typed, text, speaker, ctx.audio]);

  /** Finish the line if it is still typing; otherwise go to the next line or close. */
  const advance = () => {
    if (!lineDone) {
      setTyped(text.length);
    } else if (isLast) {
      ctx.audio.sfx("uiBack");
      ctx.close();
    } else {
      ctx.audio.sfx("uiMove");
      setLineIndex((i) => i + 1);
      setTyped(0);
    }
  };

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    const skip = event.key === "Escape";
    if (!ADVANCE_KEYS.has(event.key) && !skip) return;
    // Capture phase + stopPropagation: the paused engine never sees these keys.
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    if (skip) ctx.close();
    else advance();
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, []);

  return (
    // The whole game area is clickable, so a click anywhere advances.
    <div className="absolute inset-0 z-40 cursor-pointer bg-gradient-to-t from-[#120d24]/60 to-transparent to-50%" onClick={advance} role="dialog" aria-label={`${speaker} says`}>
      <div className="anim-slide-up absolute text-ink" style={{ left: ap(10), right: ap(10), bottom: ap(8), fontSize: HUD_FONT_SIZE }}>
        <span className="font-title absolute bg-wood text-cream" style={{ left: ap(6), top: ap(-9), padding: `${ap(2)} ${ap(4)}`, fontSize: ap(4.5), boxShadow: TAB_SHADOW }}>
          {speaker}
        </span>
        <div className="flex bg-cream" style={{ padding: ap(5), paddingTop: ap(7), gap: ap(5), minHeight: ap(46), boxShadow: BOX_SHADOW }}>
          <div className="flex shrink-0 items-end justify-center overflow-hidden bg-cream-deep" style={{ width: ap(PORTRAIT_ART_PX), height: ap(PORTRAIT_ART_PX), paddingBottom: ap(2) }}>
            <PortraitSprite speaker={speaker} theme={theme} />
          </div>
          <p className="min-w-0 flex-1 font-semibold leading-snug" style={{ fontSize: "1.25em" }} aria-live="polite">
            {text.slice(0, typed)}
            {/* The rest of the line, invisible, so the box doesn't grow while typing. */}
            <span className="invisible">{text.slice(typed)}</span>
          </p>
        </div>
        <span className="absolute font-bold text-ink-soft" style={{ right: ap(6), bottom: ap(3), fontSize: "0.8em" }}>
          {lines.length > 1 && `${lineIndex + 1}/${lines.length} `}
          {lineDone && <span className="anim-bob inline-block text-grape">{isLast ? "■" : "▼"}</span>}
        </span>
      </div>
    </div>
  );
}

/** People are shown head to toe; objects (signs) are small, so they get twice the zoom. */
function PortraitSprite({ speaker, theme }: { speaker: string; theme: ThemeId }) {
  return <ArtSprite sprite={portraitSprite(speaker, theme)} zoom={objectKind(speaker) ? 2 : 1} />;
}

const TAB_SHADOW = "0 calc(var(--s) * -1px) 0 0 #2b1b3d, calc(var(--s) * -1px) 0 0 0 #2b1b3d, calc(var(--s) * 1px) 0 0 0 #2b1b3d";
const BOX_SHADOW =
  "0 calc(var(--s) * -1px) 0 0 #2b1b3d, 0 calc(var(--s) * 1px) 0 0 #2b1b3d, calc(var(--s) * -1px) 0 0 0 #2b1b3d, calc(var(--s) * 1px) 0 0 0 #2b1b3d, inset 0 calc(var(--s) * -2px) 0 0 #f0dcae, 0 calc(var(--s) * 3px) 0 0 rgb(0 0 0 / 0.3)";
