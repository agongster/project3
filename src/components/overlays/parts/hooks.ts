/**
 * Small React hooks shared by the overlays: keyboard shortcuts, a looping
 * frame counter for sprite animations, a number that counts up, and a
 * one-shot timer.
 */
import { useEffect, useEffectEvent, useState } from "react";

// ───────────────────────────── Keyboard ─────────────────────────────

/** Elements that already react to Enter/Space on their own (a focused button, a text field, a link). */
function handlesKeysNatively(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest("button, a, input, textarea, select, summary") !== null;
}

/** True for the "confirm" keys: Space and Enter. */
export function isConfirmKey(event: KeyboardEvent): boolean {
  return event.key === " " || event.key === "Enter";
}

/**
 * Calls `onKey` for every key press while `enabled`. Held-down repeats are
 * ignored, and so are Enter/Space aimed at a focused button or field: the
 * browser already "clicks" those, and handling them twice would skip a step.
 */
export function useKeyDown(onKey: (event: KeyboardEvent) => void, enabled = true): void {
  const handle = useEffectEvent(onKey);
  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (isConfirmKey(event) && handlesKeysNatively(event.target)) return;
      handle(event);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [enabled]);
}

// ───────────────────────────── Timing ─────────────────────────────

/** A counter that goes up by one every `intervalMs` (for sprite frames and twinkles). */
export function useTicker(intervalMs: number, enabled = true): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
  return tick;
}

/**
 * Calls `onDone` once, `delayMs` after `when` becomes active. `when` is off
 * while it is `false` or `null`; any other value switches the timer on, and
 * a *different* value restarts it. That makes chains easy: pass the step
 * number and each step schedules the next one.
 */
export function useTimeout(onDone: () => void, delayMs: number, when: boolean | number | string | null): void {
  const done = useEffectEvent(onDone);
  useEffect(() => {
    if (when === false || when === null) return;
    const id = window.setTimeout(() => done(), delayMs);
    return () => window.clearTimeout(id);
  }, [when, delayMs]);
}

/**
 * False for the first `delayMs`, then true. Overlays use it to ignore
 * Space/Enter for a moment after opening, so a key the player was already
 * mashing (attacking, talking) doesn't skip straight past a reward.
 */
export function useReady(delayMs: number): boolean {
  const [ready, setReady] = useState(false);
  useTimeout(() => setReady(true), delayMs, !ready);
  return ready;
}

// ───────────────────────────── Count-up ─────────────────────────────

/** How often the count-up may call `onTick` (for coin sounds), so a big number doesn't machine-gun. */
const COUNT_TICK_MS = 70;

interface CountUpOptions {
  durationMs: number;
  /** The animation starts when this becomes true. */
  running: boolean;
  /** Called every so often while counting; `progress` is 0–1 (use it to raise the pitch). */
  onTick?: (progress: number) => void;
}

/**
 * Animates a number from 0 to `target` ("+52 coins" ticking up). Returns the
 * current value and `finish()`, which jumps straight to the end. Starts at 0
 * until `running` is true.
 */
export function useCountUp(target: number, { durationMs, running, onTick }: CountUpOptions) {
  const [value, setValue] = useState(0);
  const [finished, setFinished] = useState(false);
  const tick = useEffectEvent((progress: number) => onTick?.(progress));

  useEffect(() => {
    if (!running || finished) return;
    const startedAt = performance.now();
    let lastTickAt = -Infinity;
    let frame = 0;
    const step = (now: number) => {
      // (The first frame's timestamp can be a hair before `startedAt`, hence the clamp at 0.)
      const progress = Math.min(1, Math.max(0, (now - startedAt) / durationMs));
      // Ease out: fast at first, settling gently on the final number.
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(Math.round(target * eased));
      if (now - lastTickAt >= COUNT_TICK_MS) {
        lastTickAt = now;
        tick(progress);
      }
      if (progress < 1) frame = requestAnimationFrame(step);
      else setFinished(true);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [running, finished, target, durationMs]);

  return {
    value: finished ? target : value,
    done: finished || target === 0,
    finish: () => setFinished(true),
  };
}
