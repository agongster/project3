/**
 * BREAKAWAY: an elite that takes BREAKAWAY_HITS hits within
 * BREAKAWAY_WINDOW_SEC springs BREAKAWAY_PX away from the hero. It stops
 * fights from being a stand-still slugfest: the monster gets room to show
 * its attack again, and the hero gets to read the telegraph and dodge.
 * (Tanks shrug it off; see Monster.takeHit.)
 */
const BREAKAWAY_HITS = 3;
const BREAKAWAY_WINDOW_SEC = 1.2;
/** How far the spring carries it (px). */
export const BREAKAWAY_PX = 30;
/** How much it stretches as it springs. */
export const BREAKAWAY_STRETCH = 0.35;

/** Counts one monster's recent hits. */
export class Breakaway {
  /** Animation-clock times of recent hits. */
  private recentHits: number[] = [];

  /** A hit landed at time `now` (seconds): true when that makes it spring away. */
  onHit(now: number): boolean {
    this.recentHits = this.recentHits.filter((t) => now - t < BREAKAWAY_WINDOW_SEC);
    this.recentHits.push(now);
    if (this.recentHits.length < BREAKAWAY_HITS) return false;
    this.recentHits = [];
    return true;
  }
}
