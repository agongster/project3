"use client";

/**
 * Undo for the hero creator: before every change the editor remembers how
 * the hero looked (look + hat); "Undo" brings the last one back.
 */
import { useState } from "react";
import type { CharacterLook } from "@/lib/types";

/** Undo remembers this many steps; older ones are forgotten first. */
export const MAX_UNDO_STEPS = 30;

export interface LookSnapshot {
  look: CharacterLook;
  hatId: string | null;
}

/** `list` plus `item` at the end, keeping only the newest `max` entries. */
export function pushBounded<T>(list: readonly T[], item: T, max: number): T[] {
  return [...list, item].slice(-max);
}

/** True when two snapshots show the same hero (so remembering one would be a useless undo step). */
export function sameSnapshot(a: LookSnapshot, b: LookSnapshot): boolean {
  if (a.hatId !== b.hatId) return false;
  return (Object.keys(a.look) as (keyof CharacterLook)[]).every((key) => a.look[key] === b.look[key]);
}

export function useLookHistory() {
  const [past, setPast] = useState<readonly LookSnapshot[]>([]);
  return {
    canUndo: past.length > 0,
    /** Call with how the hero looks right BEFORE a change. */
    remember(before: LookSnapshot) {
      setPast((list) => pushBounded(list, before, MAX_UNDO_STEPS));
    },
    /** The snapshot to restore, removed from the history; undefined when there is nothing to undo. */
    takeBack(): LookSnapshot | undefined {
      const last = past.at(-1);
      if (last) setPast(past.slice(0, -1));
      return last;
    },
  };
}
