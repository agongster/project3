/**
 * Fake files with a hand-written outline, for testing how a file's code
 * shapes its dungeon (rooms per function, mazes, docstring lighting).
 *
 *   fileWithCode("shop.py", [fn("take_order", 10, 30, { branches: 6 })], [[12, "gremlin"], [2, "dustBunny"]])
 */
import { emptyOutline } from "@/lib/analysis/outline";
import { MONSTERS } from "@/lib/game/catalog";
import { mulberry32, hashString } from "@/lib/rng";
import type { AnalyzedFile, Definition, MonsterKind } from "@/lib/types";
import { makeFakeFile, makeFakeFinding } from "./helpers";

/** A function (or method / class) definition; documented unless `docstring: null`. */
export function fn(name: string, line: number, endLine: number, opts: Partial<Pick<Definition, "branches" | "docstring" | "kind">> = {}): Definition {
  return {
    name,
    kind: opts.kind ?? (name.includes(".") ? "method" : "function"),
    line,
    endLine,
    branches: opts.branches ?? 0,
    docstring: opts.docstring === undefined ? `Docs for ${name}.` : opts.docstring,
  };
}

/** A file with exactly these definitions and one finding per [line, monster] pair. */
export function fileWithCode(
  path: string,
  definitions: Definition[],
  monsters: readonly (readonly [number, MonsterKind])[],
  opts: { moduleDocstring?: string | null; lineCount?: number } = {},
): AnalyzedFile {
  const rng = mulberry32(hashString(`code:${path}`));
  const lineCount = opts.lineCount ?? Math.max(20, ...definitions.map((d) => d.endLine + 3), ...monsters.map(([line]) => line + 1));
  const file = makeFakeFile(rng, path, "module", lineCount, { cursedRate: 0, failedRate: 0 });
  file.findings = monsters
    .map(([line, kind]) => makeFakeFinding(rng, path, line, MONSTERS[kind].severity, kind))
    .sort((a, b) => a.line - b.line || a.col - b.col);
  file.outline = { ...emptyOutline(), definitions, moduleDocstring: opts.moduleDocstring === undefined ? "A module." : opts.moduleDocstring };
  return file;
}
