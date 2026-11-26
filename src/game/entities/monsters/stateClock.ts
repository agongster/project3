/**
 * A tiny STATE MACHINE clock shared by every monster brain.
 *
 * Each brain is a handful of named states ("idle" → "windup" → "lunge" →
 * "recover" …). The clock remembers which state the monster is in and for
 * how long, so a brain reads like a little script:
 *
 *   if (clock.is("windup") && clock.done) clock.go("lunge", LUNGE_SEC);
 *
 * Pure (no drawing, no game state), unit-tested in tests/engine/monsters.test.ts.
 */
export class StateClock<S extends string> {
  state: S;
  /** Seconds spent in the current state. */
  elapsed = 0;
  /** How long the current state should last (Infinity = until a brain says otherwise). */
  duration: number;

  constructor(initial: S, duration = Infinity) {
    this.state = initial;
    this.duration = duration;
  }

  /** Switches to `state` and restarts the clock. */
  go(state: S, duration = Infinity): void {
    this.state = state;
    this.elapsed = 0;
    this.duration = duration;
  }

  tick(dt: number): void {
    this.elapsed += dt;
  }

  is(...states: S[]): boolean {
    return states.includes(this.state);
  }

  /** True once the current state has lasted its full duration. */
  get done(): boolean {
    return this.elapsed >= this.duration;
  }

  /** 0 → 1 through the current state (always 0 for endless states). */
  get progress(): number {
    if (!Number.isFinite(this.duration) || this.duration <= 0) return 0;
    return Math.min(1, this.elapsed / this.duration);
  }

  /** Seconds left in the current state (Infinity for endless states). */
  get left(): number {
    return Math.max(0, this.duration - this.elapsed);
  }
}

/** A random duration in [min, max], so monsters never act in a perfect rhythm. */
export function jitter(min: number, max: number, random: () => number): number {
  return min + (max - min) * random();
}
