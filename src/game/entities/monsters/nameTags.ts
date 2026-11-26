/**
 * Name tags: every monster wears its finding like a name tag. When the
 * hero comes within ~3 tiles, a small label fades in above the monster's
 * head ("Unused import · L12"). Only the MAX_TAGS nearest show at once,
 * and a label that would cover another one moves up a line, so labels never
 * pile up.
 */
import { drawText, FONT_CAP_HEIGHT, FONT_LINE_HEIGHT, measureText } from "@/game/art/font";
import type { Finding, Severity } from "@/lib/types";
import type { Monster } from "./monster";
import { headY } from "./monsterDraw";

const SHOW_DIST_PX = 48;
const MAX_TAGS = 2;
/** Fade speed (alpha per second). */
const FADE_PER_SEC = 5;
/** Gap between the top of the head and the label… */
const ABOVE_HEAD_PX = 13;
/** …plus room for a "!", dizzy stars or "zzz" badge when one is showing. */
const BADGE_ROOM_PX = 10;
const TAG_COLORS: Record<Severity, string> = { minion: "#efe6ff", elite: "#ffd9a8", boss: "#ffb3c7" };
const OUTLINE = "#2b1d34";

/** "Unused import · L12" */
export function tagText(finding: Pick<Finding, "title" | "line">): string {
  return `${finding.title} · L${finding.line}`;
}

export class NameTags {
  private readonly alpha = new Map<Monster, number>();

  update(dt: number, monsters: readonly Monster[], hero: { x: number; y: number }): void {
    const nearest = monsters
      .filter((m) => m.alive && m.alpha > 0.5 && !m.trait?.hidesNameTag?.(m))
      .map((m) => ({ m, d: Math.hypot(m.x - hero.x, m.y - hero.y) }))
      .filter((e) => e.d < SHOW_DIST_PX)
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_TAGS)
      .map((e) => e.m);
    for (const m of nearest) if (!this.alpha.has(m)) this.alpha.set(m, 0);
    for (const [m, a] of this.alpha) {
      const target = nearest.includes(m) ? 1 : 0;
      const next = target > a ? Math.min(1, a + FADE_PER_SEC * dt) : Math.max(0, a - FADE_PER_SEC * dt);
      if (next <= 0 && target === 0) this.alpha.delete(m);
      else this.alpha.set(m, next);
    }
  }

  /** World-space; call with the camera transform applied, above the lighting. */
  draw(g: CanvasRenderingContext2D): void {
    const placed: { left: number; right: number; top: number }[] = [];
    for (const [m, alpha] of this.alpha) {
      const text = tagText(m.finding);
      const half = measureText(text) / 2 + 1;
      const badge = m.alert > 0 || m.dizzy || m.sleepy ? BADGE_ROOM_PX : 0;
      let top = Math.round(headY(m) - ABOVE_HEAD_PX - badge);
      const overlaps = (t: number) => placed.some((p) => m.x - half < p.right && m.x + half > p.left && Math.abs(p.top - t) < FONT_CAP_HEIGHT + 2);
      while (overlaps(top)) top -= FONT_LINE_HEIGHT;
      placed.push({ left: m.x - half, right: m.x + half, top });
      const color = TAG_COLORS[m.finding.severity];
      drawText(g, text, Math.round(m.x), top, { color, outline: OUTLINE, align: "center", alpha: alpha * m.alpha });
    }
  }

  clear(): void {
    this.alpha.clear();
  }
}
