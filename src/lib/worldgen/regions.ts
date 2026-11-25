/**
 * Step 1 of the overworld: decide which file lives in which region, and what
 * each file turns into (a building, a lantern or a tree stump).
 *
 * This step is pure bookkeeping: no coordinates yet.
 */
import type { AnalyzedFile, BuildingKind } from "@/lib/types";

/** With more top-level directories than this, the smallest ones share the "Outskirts". */
export const MAX_DIR_REGIONS = 10;

export const TOWN_REGION_ID = "town";
export const OUTSKIRTS_REGION_ID = "outskirts";

/** Footprint (in tiles) of every building kind. */
export const BUILDING_SIZE: Record<BuildingKind, { w: number; h: number }> = {
  cottage: { w: 2, h: 2 },
  house: { w: 3, h: 2 },
  manor: { w: 4, h: 3 },
  tower: { w: 2, h: 3 },
};

/**
 * What a file becomes, with its footprint already decided. Every file gets a
 * "lot" beside a street: most become buildings, but an empty `__init__.py`
 * is just a little lantern and a file that failed to download is a tree
 * stump (both 1 × 1).
 */
export type LotSpec = BuildingLot | MarkerLot;

export interface BuildingLot {
  file: AnalyzedFile;
  kind: BuildingKind;
  w: number;
  h: number;
}

/** Lanterns and stumps are props, not buildings. */
export interface MarkerLot {
  file: AnalyzedFile;
  kind: "lantern" | "stump";
  w: 1;
  h: 1;
}

export function isMarker(lot: LotSpec): lot is MarkerLot {
  return lot.kind === "lantern" || lot.kind === "stump";
}

export interface RegionPlan {
  id: string;
  /** Display name: "Town Square", "src/" or "Outskirts". */
  name: string;
  /** Top-level directory ("" for Town Square, "*" for the Outskirts which mixes several). */
  dir: string;
  isTown: boolean;
  /** Every file of the region, sorted by path (so sibling files end up side by side). */
  files: AnalyzedFile[];
  /** One lot per file, in the same order. */
  lots: LotSpec[];
  /** Only for the Outskirts: which directories were merged into it. */
  mergedDirs: string[];
}

/** "src/game/x.py" → "src", "setup.py" → "" (a root-level file). */
export function topLevelDir(path: string): string {
  const slash = path.indexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
}

/** An `__init__.py` that only exists to mark a package: not worth a whole house. */
export function isTrivialInit(file: AnalyzedFile): boolean {
  return file.kind === "init" && file.findings.length === 0 && file.lineCount <= 5;
}

/** Test files are watchtowers; everything else grows with its line count. */
export function buildingKindFor(file: AnalyzedFile): BuildingKind {
  if (file.kind === "test") return "tower";
  if (file.lineCount < 80) return "cottage";
  if (file.lineCount < 300) return "house";
  return "manor";
}

/**
 * Groups files into regions: Town Square (root files) first, then one region
 * per top-level directory, biggest first. If there are too many directories
 * the smallest are merged into a single "Outskirts" region so the map stays
 * walkable.
 */
export function planRegions(files: readonly AnalyzedFile[]): RegionPlan[] {
  const byDir = new Map<string, AnalyzedFile[]>();
  for (const file of files) {
    const dir = topLevelDir(file.path);
    const list = byDir.get(dir) ?? [];
    list.push(file);
    byDir.set(dir, list);
  }

  const dirs = [...byDir.keys()]
    .filter((dir) => dir !== "")
    .sort((a, b) => byDir.get(b)!.length - byDir.get(a)!.length || compareText(a, b));

  const tooMany = dirs.length > MAX_DIR_REGIONS;
  const kept = tooMany ? dirs.slice(0, MAX_DIR_REGIONS - 1) : dirs;
  const merged = tooMany ? dirs.slice(MAX_DIR_REGIONS - 1) : [];

  const plans: RegionPlan[] = [
    makePlan(TOWN_REGION_ID, "Town Square", "", byDir.get("") ?? [], true, []),
    ...kept.map((dir) => makePlan(`dir:${dir}`, `${dir}/`, dir, byDir.get(dir)!, false, [])),
  ];
  if (merged.length > 0) {
    const mergedFiles = merged.flatMap((dir) => byDir.get(dir)!);
    plans.push(makePlan(OUTSKIRTS_REGION_ID, "Outskirts", "*", mergedFiles, false, merged));
  }
  return plans;
}

function makePlan(
  id: string,
  name: string,
  dir: string,
  files: AnalyzedFile[],
  isTown: boolean,
  mergedDirs: string[],
): RegionPlan {
  const sorted = [...files].sort((a, b) => compareText(a.path, b.path));
  return { id, name, dir, isTown, files: sorted, lots: sorted.map(lotFor), mergedDirs };
}

function lotFor(file: AnalyzedFile): LotSpec {
  if (file.status === "failed") return { file, kind: "stump", w: 1, h: 1 };
  if (isTrivialInit(file)) return { file, kind: "lantern", w: 1, h: 1 };
  const kind = buildingKindFor(file);
  return { file, kind, ...BUILDING_SIZE[kind] };
}

/** Text on the signpost at a region's entrance, e.g. "bakery/ — 6 files, 2 cursed". */
export function signText(plan: RegionPlan): string {
  const fileCount = plan.files.length;
  const cursed = plan.files.filter((f) => f.findings.length > 0).length;
  const files = `${fileCount} ${fileCount === 1 ? "file" : "files"}`;
  const curse = cursed === 0 ? "all clean" : `${cursed} cursed`;
  return `${regionLabel(plan)} — ${files}, ${curse}`;
}

function regionLabel(plan: RegionPlan): string {
  if (plan.mergedDirs.length === 0) return plan.name;
  const shown = plan.mergedDirs.slice(0, 2).map((d) => `${d}/`);
  const more = plan.mergedDirs.length - shown.length;
  return `Outskirts (${shown.join(", ")}${more > 0 ? ` +${more} more` : ""})`;
}

/** Locale-independent string comparison, so sorting is identical in every browser. */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
