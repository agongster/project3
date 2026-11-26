/**
 * ONE FINDING, ONE DEFEAT. A finding can have more than one body (an Echo
 * Bat and its echo), but coins, XP, the `squashed` event, the floor
 * carving's heal and the dungeon's progress must happen exactly once.
 *
 * When a body starts dying the director asks `claim`: only the death of
 * the LAST body of a finding pays. A body that fell in the same step but
 * has not been claimed yet still counts as standing, so when a Staff of
 * Zen nova hits both at once, the second one claimed pays (and the echo
 * counts as broken in time). Every other body just pops.
 */
import type { Monster } from "../monster";

/** What one body's death is worth. */
export interface DeathReward {
  /** True when this death defeats the finding (coins, heart, XP, save). */
  pays: boolean;
  /** Bonus coins multiplier from a trait (an echo broken in time). */
  coinMultiplier: number;
}

export class DefeatLedger {
  private readonly paidFindings = new Set<string>();
  private readonly claimed = new Set<Monster>();
  private readonly rewards = new Map<Monster, DeathReward>();

  /** Call once, when `m` starts dying: is it the body whose death defeats the finding? */
  claim(m: Monster, monsters: readonly Monster[]): boolean {
    const id = m.finding.id;
    this.claimed.add(m);
    const anotherStands = monsters.some((other) => other !== m && other.finding.id === id && (other.alive || !this.claimed.has(other)));
    const lastBody = !anotherStands && !this.paidFindings.has(id);
    if (lastBody) this.paidFindings.add(id);
    return lastBody;
  }

  /** Remembers what `m`'s death pays (decided at `claim` time, paid when the pop happens). */
  setReward(m: Monster, reward: DeathReward): void {
    this.rewards.set(m, reward);
  }

  /** What `m`'s death pays (a body that never claimed — still alive or dazed — pays like any monster). */
  reward(m: Monster): DeathReward {
    return this.rewards.get(m) ?? { pays: true, coinMultiplier: 1 };
  }
}
