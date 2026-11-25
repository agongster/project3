"use client";

/**
 * Every way to customise the hero: name, the seven look options from the
 * catalog, and a hat. It is "controlled": it shows the `look`/`hatId` it is
 * given and reports changes, so the creator can edit a draft while the
 * wardrobe edits the save directly.
 */
import { useState, type ReactNode } from "react";
import { randomLook } from "@/game/art";
import type { AudioApi } from "@/game/bridge";
import { PixelButton } from "@/components/ui/kit";
import { sanitizeName } from "@/lib/game";
import { ACCESSORIES, EYE_STYLES, HAIR_COLORS, HAIR_STYLES, HATS, OUTFIT_COLORS, OUTFITS, SKIN_TONES, getItem } from "@/lib/game/catalog";
import type { CharacterLook } from "@/lib/types";
import { OptionName, OptionRow, Swatches } from "./OptionRow";

/** Names are drawn above the hero's head and in the HUD, so keep them short. */
export const NAME_MAX_CHARS = 12;

type IndexField = Exclude<keyof CharacterLook, "name">;

interface FieldSpec {
  field: IndexField;
  label: string;
  options: readonly string[];
  /** "color" options are hex colours shown as swatches; "named" ones show their name. */
  kind: "named" | "color";
}

/** The rows, top to bottom. Option lists (and so their lengths) come straight from catalog.ts. */
const FIELDS: readonly FieldSpec[] = [
  { field: "skin", label: "Skin", options: SKIN_TONES, kind: "color" },
  { field: "hairStyle", label: "Hair", options: HAIR_STYLES, kind: "named" },
  { field: "hairColor", label: "Hair colour", options: HAIR_COLORS, kind: "color" },
  { field: "outfit", label: "Outfit", options: OUTFITS, kind: "named" },
  { field: "outfitColor", label: "Outfit colour", options: OUTFIT_COLORS, kind: "color" },
  { field: "eyes", label: "Eyes", options: EYE_STYLES, kind: "named" },
  { field: "accessory", label: "Extra", options: ACCESSORIES, kind: "named" },
];

function wrapIndex(index: number, length: number): number {
  return (index + length) % length;
}

interface Props {
  look: CharacterLook;
  hatId: string | null;
  /** Hats the player may wear (catalog ids). */
  ownedHatIds: readonly string[];
  onLookChange: (patch: Partial<CharacterLook>) => void;
  onHatChange: (hatId: string | null) => void;
  audio: AudioApi;
  /** Shown at the right end of the last row, next to "Surprise me" (e.g. a Done button). */
  footer?: ReactNode;
}

export function LookEditor({ look, hatId, ownedHatIds, onLookChange, onHatChange, audio, footer }: Props) {
  // "No hat" first, then owned hats in catalog order.
  const hatOptions: (string | null)[] = [null, ...HATS.filter((hat) => ownedHatIds.includes(hat.id)).map((hat) => hat.id)];
  const hatIndex = Math.max(0, hatOptions.indexOf(hatId));

  const step = (field: IndexField, length: number, delta: -1 | 1) => {
    audio.sfx("uiMove");
    onLookChange({ [field]: wrapIndex(look[field] + delta, length) });
  };

  const pick = (field: IndexField, index: number) => {
    audio.sfx("uiMove");
    onLookChange({ [field]: index });
  };

  const stepHat = (delta: -1 | 1) => {
    audio.sfx("uiMove");
    onHatChange(hatOptions[wrapIndex(hatIndex + delta, hatOptions.length)]);
  };

  const surprise = () => {
    audio.sfx("uiSelect");
    // A random seed each click; keep the player's own name.
    const random = randomLook(Math.floor(Math.random() * 1_000_000));
    onLookChange({ ...random, name: look.name });
    onHatChange(hatOptions[Math.floor(Math.random() * hatOptions.length)]);
  };

  return (
    // 16 px text keeps every row compact enough for the in-game wardrobe on a small laptop.
    <div className="flex flex-col gap-1 text-[16px]">
      {/* `key` restarts the field's draft whenever the saved name changes elsewhere. */}
      <NameField key={look.name} name={look.name} onCommit={(name) => onLookChange({ name })} />
      {FIELDS.map((spec) => (
        <OptionRow key={spec.field} label={spec.label} onStep={(delta) => step(spec.field, spec.options.length, delta)}>
          {spec.kind === "color" ? (
            <Swatches label={spec.label} colors={spec.options} value={look[spec.field]} onPick={(index) => pick(spec.field, index)} />
          ) : (
            <OptionName name={spec.options[look[spec.field]]} index={look[spec.field]} count={spec.options.length} />
          )}
        </OptionRow>
      ))}
      <OptionRow label="Hat" onStep={stepHat}>
        <OptionName name={hatId ? (getItem(hatId)?.name ?? hatId) : "No hat"} index={hatIndex} count={hatOptions.length} />
      </OptionRow>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t-4 border-cream-deep pt-2">
        <PixelButton tone="grape" onClick={surprise}>
          🎲 Surprise me
        </PixelButton>
        {footer}
      </div>
    </div>
  );
}

/**
 * The name box keeps what the player is typing locally and only commits it
 * on blur or Enter, because the save tidies names (an empty name becomes
 * "Hero"), which would fight the player mid-word if done on every keystroke.
 */
function NameField({ name, onCommit }: { name: string; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(name);

  const commit = () => {
    const clean = sanitizeName(draft);
    setDraft(clean);
    if (clean !== name) onCommit(clean);
  };

  return (
    <label className="grid grid-cols-[6rem_1fr] items-center gap-x-1">
      <span className="text-[15px] font-bold text-ink-soft">Name</span>
      <input
        className="px-input min-w-0"
        value={draft}
        maxLength={NAME_MAX_CHARS}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
    </label>
  );
}
