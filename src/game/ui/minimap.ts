/**
 * The minimap (top-right corner) and the big map (M), which has two views
 * (E switches): the VILLAGE map, and a TREEMAP of the repo (one box per
 * file, sized by its lines, grouped by folder: see treemap.ts).
 *
 * The terrain is painted ONCE into a small canvas with one pixel per tile
 * (grass, paths, water... in the theme's colours, regions as soft tints)
 * and cached per theme. Every frame we only copy part of it and add the
 * live dots: buildings (red = cursed, gold = unopened treasure, green =
 * done), landmarks, and the blinking hero.
 */
import { PALETTES } from "@/game/art";
import { drawText, measureText } from "@/game/art/font";
import { Ground, type AnalyzedFile, type Overworld, type PropKind, type ThemeId } from "@/lib/types";
import type { BuildingEntity } from "../entities/buildings";
import type { BuildingStatus } from "../scenes/progressView";
import { fitLabel, layoutRepoTreemap, ROOT_FOLDER_NAME, type Box, type FolderBox } from "./treemap";

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
const INK = "#2b1d34";
/**
 * The treemap fills a band across the screen that the HUD leaves free: the
 * React HUD covers the corners (hearts and level top-left, weapon
 * bottom-left, buttons bottom-right). Title rows go above, the legend below.
 */
const TREEMAP_MARGIN = 8;
const TREEMAP_TOP = 54;
const TREEMAP_BOTTOM = 32;
const TITLE_Y = 28;
const KEYS_Y = 40;
const LEGEND_Y = 198;
/** File names are drawn in boxes at least this big (the font is 7 px tall plus outline). */
const LABEL_MIN_W = 12;
const LABEL_MIN_H = 11;
/** Treemap boxes are slightly see-through so the status colours are not glaring. */
const TREEMAP_BOX_ALPHA = 0.85;
/** A legend entry: an 8 px colour swatch, a little space, then its name; entries LEGEND_GAP apart. */
const LEGEND_SWATCH_W = 11;
const LEGEND_GAP = 8;
const LEGEND: readonly [string, BuildingStatus][] = [
  ["cursed", "cursed"],
  ["treasure", "treasure"],
  ["clear", "done"],
];
/** Legend entry for the white outline around the house nearest the hero. */
const NEAR_LABEL = "near you";
const NEAR_COLOR = "#ffffff";

export type BigMapView = "village" | "treemap";

export class MapView {
  private terrain: HTMLCanvasElement | null = null;
  private theme: ThemeId | null = null;
  /** Which view the big map shows; E switches. */
  private view: BigMapView = "village";
  /** The treemap layout never changes (the repo does not), so it is computed once per screen size. */
  private treemap: { key: string; folders: FolderBox[] } | null = null;

  constructor(
    private readonly world: Overworld,
    private readonly files: readonly AnalyzedFile[],
  ) {}

  /** Switches the big map between the village map and the repo treemap. */
  toggleView(): void {
    this.view = this.view === "village" ? "treemap" : "village";
  }

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

  /** The big map in its current view. */
  drawBig(g: CanvasRenderingContext2D, viewW: number, viewH: number, theme: ThemeId, buildings: readonly BuildingEntity[], hero: { x: number; y: number }, time: number): void {
    if (this.view === "treemap") this.drawTreemap(g, viewW, viewH, buildings, hero, time);
    else this.drawVillage(g, viewW, viewH, theme, buildings, hero, time);
  }

  /** The whole village, centred, with region names. */
  private drawVillage(g: CanvasRenderingContext2D, viewW: number, viewH: number, theme: ThemeId, buildings: readonly BuildingEntity[], hero: { x: number; y: number }, time: number): void {
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
      drawText(g, r.name, Math.round(ox + (r.x + r.w / 2) * scale), ty, { color: "#ffffff", outline: INK, align: "center" });
    }
    this.drawDots(g, ox, oy, scale, buildings);
    if (Math.floor(time * 3) % 2 === 0) dot(g, ox + (hero.x / 16) * scale, oy + (hero.y / 16) * scale, Math.max(3, scale + 1), "#ffffff");
    const hint = "Village map  ·  E: repo treemap  ·  M: close";
    drawText(g, hint, Math.round(viewW / 2), oy - 14, { color: "#fff1b8", outline: INK, align: "center" });
  }

  /**
   * The repo as a treemap: a box per file (area = lines), grouped by
   * folder, coloured like the map's building dots, with the house the hero
   * stands nearest blinking white ("you are here").
   */
  private drawTreemap(g: CanvasRenderingContext2D, viewW: number, viewH: number, buildings: readonly BuildingEntity[], hero: { x: number; y: number }, time: number): void {
    const area = { x: TREEMAP_MARGIN, y: TREEMAP_TOP, w: viewW - 2 * TREEMAP_MARGIN, h: viewH - TREEMAP_TOP - TREEMAP_BOTTOM };
    const folders = this.treemapLayout(area);
    const status = new Map(buildings.map((b) => [b.path, b.status]));
    const here = nearestBuilding(buildings, hero)?.path;
    g.fillStyle = "rgba(10, 8, 24, 0.7)";
    g.fillRect(0, 0, viewW, viewH);
    panel(g, area.x - 3, area.y - 3, area.w + 6, area.h + 6);
    for (const folder of folders) drawFolder(g, folder, status);
    const mine = folders.flatMap((f) => f.files).find((f) => f.id === here);
    if (mine && Math.floor(time * 3) % 2 === 0) outlineBox(g, snap(mine), NEAR_COLOR);

    const center = Math.round(viewW / 2);
    drawText(g, "Repo treemap  ·  box size = lines of code", center, TITLE_Y, { color: "#ffffff", outline: INK, align: "center" });
    drawText(g, "E: village map  ·  M: close", center, KEYS_Y, { color: "#fff1b8", outline: INK, align: "center" });
    drawLegend(g, center, LEGEND_Y);
  }

  private treemapLayout(area: Box): FolderBox[] {
    const key = `${area.x},${area.y},${area.w},${area.h}`;
    if (this.treemap?.key !== key) this.treemap = { key, folders: layoutRepoTreemap(this.files, area) };
    return this.treemap.folders;
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
      g.fillStyle = INK;
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
  g.fillStyle = INK;
  g.fillRect(Math.round(x - size / 2) - 1, Math.round(y - size / 2) - 1, size + 2, size + 2);
  g.fillStyle = color;
  g.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
}

/** One folder of the treemap: a dark box, its name strip, and a coloured, named box per file. */
function drawFolder(g: CanvasRenderingContext2D, folder: FolderBox, status: ReadonlyMap<string, BuildingStatus>): void {
  const box = snap(folder);
  g.fillStyle = INK;
  g.fillRect(box.x, box.y, box.w, box.h);
  const title = folder.name === ROOT_FOLDER_NAME ? folder.name : `${folder.name}/`;
  if (folder.header) drawText(g, fitLabel(title, box.w - 4), box.x + 2, box.y + 2, { color: "#ffffff", outline: INK });
  for (const file of folder.files) {
    const r = snap(file);
    if (r.w < 1 || r.h < 1) continue;
    // Each box leaves its last row and column dark: a 1 px line between neighbouring files.
    g.globalAlpha = TREEMAP_BOX_ALPHA;
    g.fillStyle = STATUS_COLORS[status.get(file.id) ?? "done"];
    g.fillRect(r.x, r.y, Math.max(1, r.w - 1), Math.max(1, r.h - 1));
    g.globalAlpha = 1;
    if (r.w >= LABEL_MIN_W && r.h >= LABEL_MIN_H) drawText(g, fitLabel(fileName(file.id), r.w - 4), r.x + 2, r.y + 2, { color: "#ffffff", outline: INK });
  }
}

/** "■ cursed ■ treasure ■ clear □ near you", centred on `centerX` under the treemap. */
function drawLegend(g: CanvasRenderingContext2D, centerX: number, y: number): void {
  const entries = [...LEGEND.map(([label, key]) => ({ label, color: STATUS_COLORS[key], hollow: false })), { label: NEAR_LABEL, color: NEAR_COLOR, hollow: true }];
  const entryW = (label: string) => LEGEND_SWATCH_W + measureText(label) + LEGEND_GAP;
  let x = Math.round(centerX - (entries.reduce((sum, e) => sum + entryW(e.label), 0) - LEGEND_GAP) / 2);
  for (const e of entries) {
    g.fillStyle = INK;
    g.fillRect(x, y, 8, 8);
    g.fillStyle = e.color;
    g.fillRect(x + 1, y + 1, 6, 6);
    if (e.hollow) {
      g.fillStyle = INK;
      g.fillRect(x + 2, y + 2, 4, 4);
    }
    drawText(g, e.label, x + LEGEND_SWATCH_W, y, { color: "#ffffff", outline: INK });
    x += entryW(e.label);
  }
}

/** A box with every edge rounded to whole pixels, so neighbouring boxes meet exactly. */
function snap(b: Box): Box {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  return { x, y, w: Math.round(b.x + b.w) - x, h: Math.round(b.y + b.h) - y };
}

function outlineBox(g: CanvasRenderingContext2D, b: Box, color: string): void {
  g.fillStyle = color;
  g.fillRect(b.x - 1, b.y - 1, b.w + 1, 1);
  g.fillRect(b.x - 1, b.y + b.h - 1, b.w + 1, 1);
  g.fillRect(b.x - 1, b.y - 1, 1, b.h + 1);
  g.fillRect(b.x + b.w - 1, b.y - 1, 1, b.h + 1);
}

/** "bakery/oven.py" → "oven.py". */
function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function nearestBuilding(buildings: readonly BuildingEntity[], hero: { x: number; y: number }): BuildingEntity | null {
  let best: BuildingEntity | null = null;
  let bestDistance = Infinity;
  for (const b of buildings) {
    const d = Math.hypot(b.doorX - hero.x, b.doorY - hero.y);
    if (d < bestDistance) {
      best = b;
      bestDistance = d;
    }
  }
  return best;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
