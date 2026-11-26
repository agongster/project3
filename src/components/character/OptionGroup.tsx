"use client";

/**
 * One option group of the creator ("Hair style", "Eye colour"...): a
 * heading with the chosen option's name and its place in the list, then
 * the swatches — colour chips, or previews of the hero wearing each option.
 */
import type { ReactNode } from "react";
import type { CharacterLook } from "@/lib/types";
import { HeroSwatch } from "./HeroSwatch";
import { choicesFor, groupLabel, type GroupSpec } from "./lookSections";
import { SwatchGrid } from "./SwatchGrid";

/** Zoom of the hero previews per crop: faces are small, so they get the biggest zoom. */
export const SWATCH_SCALE = { face: 3, head: 2, body: 2 } as const;

interface HeadingProps {
  label: string;
  choiceName: string;
  /** 0-based place of the chosen option in the list. */
  position: number;
  count: number;
  children: ReactNode;
}

/** A labelled group of swatches. */
export function GroupFrame({ label, choiceName, position, count, children }: HeadingProps) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="flex items-baseline gap-2 leading-tight">
        <span className="font-label text-xs text-ink-soft">{label}</span>
        <span className="text-sm font-extrabold">{choiceName}</span>
        <span className="text-sm font-bold text-ink-soft">
          {position + 1} / {count}
        </span>
      </h3>
      {children}
    </section>
  );
}

interface Props {
  group: GroupSpec;
  look: CharacterLook;
  onPick: (patch: Partial<CharacterLook>) => void;
}

export function OptionGroup({ group, look, onPick }: Props) {
  const choices = choicesFor(group.field, look);
  const selected = choices.findIndex((choice) => choice.value === look[group.field]);
  const label = groupLabel(group, look);
  const swatch = group.swatch;

  return (
    <GroupFrame label={label} choiceName={choices[selected]?.name ?? "?"} position={selected} count={choices.length}>
      <SwatchGrid
        label={label}
        names={choices.map((choice) => choice.name)}
        selected={selected}
        onPick={(position) => onPick({ [group.field]: choices[position].value })}
        variant={swatch === "chip" ? "chip" : "tile"}
        colors={choices.map((choice) => choice.color ?? "")}
        renderSwatch={(position) =>
          swatch === "chip" ? null : (
            // Previews show the look without the hat, except the hat itself: a hat would hide the hair.
            <HeroSwatch look={{ ...look, [group.field]: choices[position].value }} hatId={null} crop={swatch} facing={group.facing} scale={SWATCH_SCALE[swatch]} />
          )
        }
      />
    </GroupFrame>
  );
}
