/**
 * Boss lairs in the village. A building whose dungeon still holds a boss or
 * a champion to fight is unmistakable:
 *
 *   - its roof badge is a red horned skull (boss) or a gold crown (champion)
 *     instead of the plain skull, and a battle pennant is planted by its wall
 *   - its name label says who lives there ("config.py · Key Thief")
 *   - its door prompt says so, and the maps mark it (minimap.ts)
 *   - the town guide tells you how many are left and where the nearest one is
 *
 * Which file is a lair, and in what state, is decided in
 * src/lib/game/champions.ts; this file only words and draws it.
 */
import { drawSprite, LAIR_BANNER_FRAMES, lairBannerSprite, mapMarkSprite } from "@/game/art";
import { drawText, measureText } from "@/game/art/font";
import { MONSTERS } from "@/lib/game/catalog";
import { aliveLair, compassName, fileLairs, type Lair, type LairKind } from "@/lib/game/champions";
import { getProgress } from "@/lib/game/progress";
import { guideLairLine } from "@/lib/worldgen/villagers";
import type { AnalyzedFile, SaveData } from "@/lib/types";
import { fitLabel, type FolderBox } from "./treemap";

/** Text colour of a lair's label and legend entry: boss red, champion gold (the badges' colours). */
export const LAIR_COLORS: Readonly<Record<LairKind, string>> = { boss: "#ff9a9a", champion: "#ffd36b" };
/** The longest building label, in pixels of the bitmap font. */
const MAX_LABEL_PX = 170;
/** The pennant flutters to its next frame this often. */
const BANNER_FRAME_SEC = 0.35;
/** The pennant is planted this far out from the building's right wall (px). */
const BANNER_GAP_PX = 1;
/** Closer than this (px) to the guide, the guide says "right next to me" instead of a direction. */
const RIGHT_HERE_PX = 40;

/** What lives in a lair: "Key Thief", or "Champion Gremlin". */
export function lairWho(lair: Pick<Lair, "kind" | "finding">): string {
  const species = MONSTERS[lair.finding.monster].name;
  return lair.kind === "boss" ? species : `Champion ${species}`;
}

/** The lair a file's building shows right now (a boss or champion still to fight), or null. */
export function standingLair(save: SaveData, repoKey: string, file: AnalyzedFile | undefined): Lair | null {
  return aliveLair(file, getProgress(save, repoKey));
}

/** A building's name label: its short path, plus who lives there when it is a lair. Never wider than MAX_LABEL_PX. */
export function lairLabelText(shortName: string, lair: Pick<Lair, "kind" | "finding"> | null): string {
  return fitLabel(lair ? `${shortName} · ${lairWho(lair)}` : shortName, MAX_LABEL_PX);
}

/** The door prompt of a lair: "Enter config.py — the Key Thief lurks inside!" */
export function lairDoorPrompt(shortName: string, lair: Pick<Lair, "kind" | "finding">): string {
  return `Enter ${shortName} — the ${lairWho(lair)} lurks inside!`;
}

/**
 * The pennant planted in the ground by a lair's right wall (`wallX`, world
 * px), at the building's base line `groundY`. Beside the house, it never
 * hides the roof badge, whatever the roof's shape.
 */
export function drawLairBanner(g: CanvasRenderingContext2D, wallX: number, groundY: number, kind: LairKind, time: number): void {
  const frame = Math.floor(time / BANNER_FRAME_SEC) % LAIR_BANNER_FRAMES;
  drawSprite(g, lairBannerSprite(kind, frame), Math.round(wallX + BANNER_GAP_PX), Math.round(groundY));
}

/** A lair building as the guide sees it: its file and where its door is (world px). */
export interface LairPlace {
  file: AnalyzedFile | undefined;
  doorX: number;
  doorY: number;
}

/**
 * The town guide's live line (see guideLairLine in villagers.ts): counts the
 * lairs of every building and points from `from` (the guide) to the nearest
 * one still to fight.
 */
export function guideLineFor(places: readonly LairPlace[], from: { x: number; y: number }, save: SaveData, repoKey: string): string {
  const progress = getProgress(save, repoKey);
  const alive: Record<LairKind, number> = { boss: 0, champion: 0 };
  const total: Record<LairKind, number> = { boss: 0, champion: 0 };
  let nearest: { lair: Lair; place: LairPlace; d: number } | null = null;
  for (const place of places) {
    if (!place.file) continue;
    for (const lair of fileLairs(place.file, progress)) {
      total[lair.kind]++;
      if (lair.state !== "alive") continue;
      alive[lair.kind]++;
      const d = Math.hypot(place.doorX - from.x, place.doorY - from.y);
      if (!nearest || d < nearest.d) nearest = { lair, place, d };
    }
  }
  if (!nearest) return guideLairLine(alive, total, null);
  const { lair, place, d } = nearest;
  const direction = d < RIGHT_HERE_PX ? null : compassName(place.doorX - from.x, place.doorY - from.y);
  return guideLairLine(alive, total, { name: lairWho(lair), path: lair.path, direction });
}

/** The guide is the villager placed nearest the spawn point (see placeVillagers in src/lib/worldgen/placement.ts). */
export function guideOf<T extends { x: number; y: number }>(villagers: readonly T[], spawn: { x: number; y: number }): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const v of villagers) {
    const d = Math.hypot(v.x - spawn.x, v.y - spawn.y);
    if (d < bestD) {
      best = v;
      bestD = d;
    }
  }
  return best;
}

/** The guide's lines with the live lair line as the second one. */
export function withLairLine(lines: readonly string[], lairLine: string): string[] {
  return [...lines.slice(0, 1), lairLine, ...lines.slice(1)];
}

// ───────────────────────────── Maps ─────────────────────────────

/** Lair legend entries: the map mark, a little space, the word. */
const LEGEND_LABELS: readonly { kind: LairKind; label: string }[] = [
  { kind: "boss", label: "boss lair" },
  { kind: "champion", label: "champion" },
];
const LEGEND_MARK_W = 9;
const LEGEND_GAP_PX = 8;
const LEGEND_INK = "#2b1d34";
/** A treemap box gets its mark only when it is at least this big (px). */
const TREEMAP_MARK_MIN_PX = 9;

/** The map mark over every lair building's footprint (minimap and big village map; `scale` px per tile). */
export function drawMapMarks(g: CanvasRenderingContext2D, buildings: readonly { lair: Lair | null; building: { x: number; y: number; w: number } }[], ox: number, oy: number, scale: number): void {
  for (const b of buildings) {
    if (!b.lair) continue;
    const { x, y, w } = b.building;
    drawSprite(g, mapMarkSprite(b.lair.kind), Math.round(ox + (x + w / 2) * scale), Math.round(oy + y * scale));
  }
}

/** The map mark in the bottom-right corner of each lair file's treemap box (clear of the file name at the top). */
export function drawTreemapMarks(g: CanvasRenderingContext2D, folders: readonly FolderBox[], buildings: readonly { path: string; lair: Lair | null }[]): void {
  const kinds = new Map(buildings.filter((b) => b.lair).map((b) => [b.path, b.lair!.kind]));
  for (const file of folders.flatMap((f) => f.files)) {
    const kind = kinds.get(file.id);
    if (!kind || file.w < TREEMAP_MARK_MIN_PX || file.h < TREEMAP_MARK_MIN_PX) continue;
    drawSprite(g, mapMarkSprite(kind), Math.round(file.x + file.w - 6), Math.round(file.y + file.h - 6));
  }
}

/** "☠ boss lair  ♛ champion", right-aligned so it ends at `rightX` (only when the repo has lairs). */
export function drawLairLegend(g: CanvasRenderingContext2D, rightX: number, y: number, buildings: readonly { lair: Lair | null }[]): void {
  const shown = LEGEND_LABELS.filter((e) => buildings.some((b) => b.lair?.kind === e.kind));
  const entryW = (label: string) => LEGEND_MARK_W + measureText(label) + LEGEND_GAP_PX;
  let x = Math.round(rightX - shown.reduce((sum, e) => sum + entryW(e.label), 0) + LEGEND_GAP_PX);
  for (const e of shown) {
    drawSprite(g, mapMarkSprite(e.kind), x + 3, y + 4);
    drawText(g, e.label, x + LEGEND_MARK_W, y, { color: LAIR_COLORS[e.kind], outline: LEGEND_INK });
    x += entryW(e.label);
  }
}
