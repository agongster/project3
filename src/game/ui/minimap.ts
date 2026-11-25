/**
 * The minimap (top-right corner) and the big map (M).
 *
 * The terrain is painted ONCE into a small canvas with one pixel per tile
 * (grass, paths, water... in the theme's colours, regions as soft tints)
 * and cached per theme. Every frame we only copy part of it and add the
 * live dots: buildings (red = cursed, gold = unopened treasure, green =
 * done), landmarks, and the blinking hero.
 */
import { PALETTES } from "@/game/art";
import { drawText } from "@/game/art/font";
import { Ground, type Overworld, type PropKind, type ThemeId } from "@/lib/types";
import type { BuildingEntity } from "../entities/buildings";
import type { BuildingStatus } from "../scenes/progressView";

const MINI_W = 70;
const MINI_H = 52;
const MINI_MARGIN = 4;
/** Region tints, cycled (soft, so the terrain still shows through). */
const REGION_TINTS = ["#ffd36b", "#8fd3ff", "#ff9ebb", "#b9f18c", "#c9a2ff", "#ffb07a"];
const STATUS_COLORS: Record<BuildingStatus, string> = { cursed: "#ff4d6d", treasure: "#ffd23f", claimable: "#ffd23f", done: "#5ee38a" };
const LANDMARKS: ReadonlySet<PropKind> = new Set<PropKind>(["well", "wardrobe", "board", "fountain"]);
/** Region names on the big map float this many px above the region. */
const REGION_LABEL_RAISE = 10;
const PANEL_FILL = "rgba(22, 16, 44, 0.62)";
const PANEL_EDGE = "rgba(255, 255, 255, 0.35)";

export class MapView {
  private terrain: HTMLCanvasElement | null = null;
  private theme: ThemeId | null = null;

  constructor(private readonly world: Overworld) {}

  /** Small map around the hero in the top-right corner. */
  drawMini(g: CanvasRenderingContext2D, viewW: number, theme: ThemeId, buildings: readonly BuildingEntity[], hero: { x: number; y: number }, time: number): void {
    const terrain = this.terrainFor(theme);
    const px = viewW - MINI_W - MINI_MARGIN;
    const py = MINI_MARGIN;
    const htx = hero.x / 16;
    const hty = hero.y / 16;
    // Source window (one px per tile), centred on the hero but kept inside the map.
    const sx = clamp(Math.round(htx - MINI_W / 2), 0, Math.max(0, this.world.width - MINI_W));
    const sy = clamp(Math.round(hty - MINI_H / 2), 0, Math.max(0, this.world.height - MINI_H));
    panel(g, px - 2, py - 2, MINI_W + 4, MINI_H + 4);
    g.save();
    g.beginPath();
    g.rect(px, py, MINI_W, MINI_H);
    g.clip();
    g.globalAlpha = 0.9;
    g.drawImage(terrain, sx, sy, MINI_W, MINI_H, px, py, MINI_W, MINI_H);
    g.globalAlpha = 1;
    this.drawDots(g, px - sx, py - sy, 1, buildings);
    if (Math.floor(time * 3) % 2 === 0) dot(g, px + htx - sx, py + hty - sy, 2, "#ffffff");
    g.restore();
  }

  /** The whole village, centred, with region names. */
  drawBig(g: CanvasRenderingContext2D, viewW: number, viewH: number, theme: ThemeId, buildings: readonly BuildingEntity[], hero: { x: number; y: number }, time: number): void {
    const terrain = this.terrainFor(theme);
    const scale = Math.max(1, Math.floor(Math.min((viewW - 24) / this.world.width, (viewH - 30) / this.world.height)));
    const w = this.world.width * scale;
    const h = this.world.height * scale;
    const ox = Math.round((viewW - w) / 2);
    const oy = Math.round((viewH - h) / 2) + 4;
    g.fillStyle = "rgba(10, 8, 24, 0.55)";
    g.fillRect(0, 0, viewW, viewH);
    panel(g, ox - 3, oy - 3, w + 6, h + 6);
    g.imageSmoothingEnabled = false;
    g.drawImage(terrain, ox, oy, w, h);
    // Region names sit just above each region so they never cover its houses.
    for (const r of this.world.regions) {
      const ty = Math.max(oy + 1, Math.round(oy + r.y * scale - REGION_LABEL_RAISE));
      drawText(g, r.name, Math.round(ox + (r.x + r.w / 2) * scale), ty, { color: "#ffffff", outline: "#2b1d34", align: "center" });
    }
    this.drawDots(g, ox, oy, scale, buildings);
    if (Math.floor(time * 3) % 2 === 0) dot(g, ox + (hero.x / 16) * scale, oy + (hero.y / 16) * scale, Math.max(3, scale + 1), "#ffffff");
    const hint = "Map  (M to close)";
    drawText(g, hint, Math.round(viewW / 2), oy - 14, { color: "#fff1b8", outline: "#2b1d34", align: "center" });
  }

  private drawDots(g: CanvasRenderingContext2D, ox: number, oy: number, scale: number, buildings: readonly BuildingEntity[]): void {
    const size = Math.max(2, scale);
    for (const p of this.world.props) {
      if (LANDMARKS.has(p.kind)) dot(g, ox + (p.x + 0.5) * scale, oy + (p.y + 0.5) * scale, size, "#9ff3ff");
    }
    // Buildings are drawn as their footprint, coloured by status, with a dark rim.
    for (const b of buildings) {
      const bd = b.building;
      const x = Math.round(ox + bd.x * scale);
      const y = Math.round(oy + bd.y * scale);
      g.fillStyle = "#2b1d34";
      g.fillRect(x - 1, y - 1, bd.w * scale + 2, bd.h * scale + 2);
      g.fillStyle = STATUS_COLORS[b.status];
      g.fillRect(x, y, bd.w * scale, bd.h * scale);
    }
  }

  private terrainFor(theme: ThemeId): HTMLCanvasElement {
    if (this.terrain && this.theme === theme) return this.terrain;
    const { width, height, ground, solid } = this.world;
    const pal = PALETTES[theme];
    const colors: Record<number, string> = {
      [Ground.Grass]: pal.grass.base,
      [Ground.Meadow]: pal.grass.light,
      [Ground.Path]: pal.path.base,
      [Ground.Plaza]: pal.plaza.base,
      [Ground.Water]: pal.water.base,
      [Ground.Sand]: pal.sand.base,
      [Ground.Bridge]: pal.wood,
    };
    const c = this.terrain ?? document.createElement("canvas");
    c.width = width;
    c.height = height;
    const g = c.getContext("2d")!;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const id = ground[i];
        // Solid grass is the forest ring around the village.
        g.fillStyle = solid[i] && (id === Ground.Grass || id === Ground.Meadow) ? pal.grass.deep : colors[id] ?? pal.grass.base;
        g.fillRect(x, y, 1, 1);
      }
    }
    g.globalAlpha = 0.18;
    this.world.regions.forEach((r, i) => {
      g.fillStyle = REGION_TINTS[i % REGION_TINTS.length];
      g.fillRect(r.x, r.y, r.w, r.h);
    });
    g.globalAlpha = 1;
    this.terrain = c;
    this.theme = theme;
    return c;
  }
}

/** A translucent panel with a light 1-px border and clipped corners. */
function panel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.fillStyle = PANEL_FILL;
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
  g.fillStyle = PANEL_EDGE;
  g.fillRect(x + 2, y, w - 4, 1);
  g.fillRect(x + 2, y + h - 1, w - 4, 1);
  g.fillRect(x, y + 2, 1, h - 4);
  g.fillRect(x + w - 1, y + 2, 1, h - 4);
}

function dot(g: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  g.fillStyle = "#2b1d34";
  g.fillRect(Math.round(x - size / 2) - 1, Math.round(y - size / 2) - 1, size + 2, size + 2);
  g.fillStyle = color;
  g.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
