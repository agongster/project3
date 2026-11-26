/**
 * Development only: where each line of code is carved in a file's dungeon,
 * for play-test bots (`window.__app.lines(path)`, see GameScreen.tsx). The
 * engine builds a file's dungeon with `generateDungeon(file, world.seed)`
 * and carves its lines with `layoutCarvings`, both pure, so asking them
 * again gives exactly what is on the floor.
 */
import { layoutCarvings } from "@/game/scenes/floorCodeLayout";
import { generateDungeon } from "@/lib/worldgen";
import type { RepoAnalysis } from "@/lib/types";

/** One carved line: its finding, the line of code, and its box in world px. */
export interface CarvedLine {
  findingId: string;
  line: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function carvedLines(analysis: RepoAnalysis, seed: number, path: string): CarvedLine[] {
  const file = analysis.files.find((candidate) => candidate.path === path);
  if (!file || file.findings.length === 0) return [];
  const lineOf = new Map(file.findings.map((finding) => [finding.id, finding.line]));
  return layoutCarvings(generateDungeon(file, seed), file.findings).map((c) => ({ findingId: c.findingId, line: lineOf.get(c.findingId) ?? 0, x: c.x, y: c.y, w: c.w, h: c.h }));
}
