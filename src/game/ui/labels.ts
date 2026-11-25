/**
 * File-name labels over buildings. When the hero comes within ~2.5 tiles of
 * a building's door, its file name fades in above the roof. Only the
 * nearest MAX_LABELS are shown so labels never pile on top of each other.
 */
import { drawText } from "@/game/art/font";
import type { ThemeId } from "@/lib/types";
import type { BuildingEntity } from "../entities/buildings";
import { shortPath } from "../scenes/progressView";

/** Labels show within this distance of the door (2.5 tiles)... */
const SHOW_DIST_PX = 40;
const MAX_LABELS = 2;
/** ...and fade in / out at this rate (alpha per second). */
const FADE_PER_SEC = 5;
/** Gap between the roof top and the label (leaves room for the badge). */
const ABOVE_ROOF_PX = 20;

export class BuildingLabels {
  private alpha = new Map<BuildingEntity, number>();

  update(dt: number, buildings: readonly BuildingEntity[], hero: { x: number; y: number }): void {
    const nearest = buildings
      .map((b) => ({ b, d: Math.hypot(b.doorX - hero.x, b.doorY - hero.y) }))
      .filter((e) => e.d < SHOW_DIST_PX)
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_LABELS)
      .map((e) => e.b);
    for (const b of nearest) if (!this.alpha.has(b)) this.alpha.set(b, 0);
    for (const [b, a] of this.alpha) {
      const target = nearest.includes(b) ? 1 : 0;
      const next = target > a ? Math.min(1, a + FADE_PER_SEC * dt) : Math.max(0, a - FADE_PER_SEC * dt);
      if (next <= 0 && target === 0) this.alpha.delete(b);
      else this.alpha.set(b, next);
    }
  }

  /** World-space; call with the camera transform applied, above the lighting. */
  draw(g: CanvasRenderingContext2D, theme: ThemeId): void {
    for (const [b, alpha] of this.alpha) {
      const top = b.y - b.sprite(theme).h;
      const color = b.status === "cursed" ? "#ffc2ea" : b.status === "done" ? "#c8ffd4" : "#fff1b8";
      drawText(g, shortPath(b.path), Math.round(b.x), top - ABOVE_ROOF_PX, { color, outline: "#2b1d34", align: "center", alpha });
    }
  }
}
