/**
 * Writes the HUD store (hearts, prompt, location...) that React displays.
 *
 * Every `set` on the store re-renders the React HUD, so the engine must not
 * write 60 times a second. `patch` compares each field with what is already
 * stored and only writes when something actually changed.
 */
import type { HudState } from "./bridge";
import type { Store } from "@/lib/types";

/** Equal for HUD purposes: same primitive, or plain objects with equal fields. */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** Rounds dash readiness to 5% steps: enough for a smooth bar, far fewer React renders. */
export function quantizeDash(ready: number): number {
  return Math.round(Math.max(0, Math.min(1, ready)) * 20) / 20;
}

export class HudWriter {
  constructor(private readonly store: Store<HudState>) {}

  patch(changes: Partial<HudState>): void {
    const current = this.store.get();
    const changed = (Object.keys(changes) as (keyof HudState)[]).some((key) => !sameValue(current[key], changes[key]));
    if (changed) this.store.set({ ...current, ...changes });
  }
}
