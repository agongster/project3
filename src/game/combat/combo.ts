/**
 * The hit combo: land hits less than COMBO_WINDOW_SEC apart and the counter
 * climbs; wait too long and it resets. A higher combo makes coin drops
 * bigger (+10% per step, at most double), which rewards keeping up the pace.
 */

/** Seconds you may wait between hits before the combo resets. */
export const COMBO_WINDOW_SEC = 2.5;
/** Extra coins per combo step (0.1 = +10%). */
export const COMBO_COIN_BONUS = 0.1;
/** Coin multiplier never goes above this. */
export const COMBO_COIN_CAP = 2;

/**
 * Coin-drop multiplier for a combo count. A lone hit (combo 0 or 1) gives
 * ×1; every further chained hit adds 10%: combo 2 → ×1.1, 3 → ×1.2 …
 * capped at ×2 (combo 11 and above).
 */
export function comboCoinMultiplier(combo: number): number {
  const steps = Math.max(0, combo - 1);
  return Math.min(COMBO_COIN_CAP, 1 + steps * COMBO_COIN_BONUS);
}

export class Combo {
  count = 0;
  private sinceLastHit = Infinity;

  /** Registers a landed hit. */
  hit(): void {
    this.count = this.sinceLastHit <= COMBO_WINDOW_SEC ? this.count + 1 : 1;
    this.sinceLastHit = 0;
  }

  update(dt: number): void {
    this.sinceLastHit += dt;
    if (this.sinceLastHit > COMBO_WINDOW_SEC) this.count = 0;
  }

  coinMultiplier(): number {
    return comboCoinMultiplier(this.count);
  }

  reset(): void {
    this.count = 0;
    this.sinceLastHit = Infinity;
  }
}
