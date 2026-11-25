/**
 * Town Square's furniture: the fountain in the middle of the plaza, the three
 * interactive landmarks, benches, lamps and the player's spawn point.
 *
 * The plaza is always PLAZA_W × PLAZA_H (17 × 9) tiles, so the furniture has
 * fixed spots relative to the plaza's centre column `cx`:
 *
 *     row 0   ring walkway (kept clear: doors and roads meet the plaza here)
 *     row 1   lamp ............ board (cx) ............ lamp
 *     row 2   ...... well (cx-5) ............. wardrobe (cx+5) ......
 *     row 3          (front tiles where the player stands to interact)
 *     row 4                     fountain (cx)
 *     row 6   promenade: spawn (cx); east/west roads enter on this row
 *     row 7   lamp ... bench (cx-3) ......... bench (cx+3) ... lamp
 *     row 8   ring walkway
 */
import type { Point, PropKind, Rect } from "@/lib/types";
import { Tag, type WorldCanvas } from "./canvas";
import { PLAZA_PROMENADE_ROW } from "./layout";

export interface TownSquare {
  spawn: Point;
  /** Tiles directly south of the well, wardrobe, board and fountain. */
  landmarkFronts: Point[];
}

export function furnishTownSquare(canvas: WorldCanvas, plaza: Rect): TownSquare {
  const cx = plaza.x + Math.floor(plaza.w / 2);
  const top = plaza.y;
  const keepClear = (x: number, y: number) => canvas.tag(x, y, Tag.KeepClear);

  // Walkways: the plaza's outer ring and the promenade stay free of everything.
  for (let x = plaza.x; x < plaza.x + plaza.w; x++) {
    keepClear(x, top);
    keepClear(x, top + plaza.h - 1);
    keepClear(x, top + PLAZA_PROMENADE_ROW);
  }
  for (let y = top; y < top + plaza.h; y++) {
    keepClear(plaza.x, y);
    keepClear(plaza.x + plaza.w - 1, y);
  }

  const landmarkFronts: Point[] = [];
  const landmark = (kind: PropKind, x: number, y: number) => {
    canvas.addProp(kind, x, y, true);
    keepClear(x, y + 1);
    landmarkFronts.push({ x, y: y + 1 });
  };

  // The fountain gets a clear ring all around (its sprite is bigger than one tile).
  landmark("fountain", cx, top + 4);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) keepClear(cx + dx, top + 4 + dy);
  landmark("board", cx, top + 1);
  landmark("well", cx - 5, top + 2);
  landmark("wardrobe", cx + 5, top + 2);

  const spawn = { x: cx, y: top + PLAZA_PROMENADE_ROW };

  canvas.addProp("bench", cx - 3, top + 7, true);
  canvas.addProp("bench", cx + 3, top + 7, true);
  for (const x of [plaza.x + 1, plaza.x + plaza.w - 2]) {
    canvas.addProp("lamp", x, top + 1, true);
    canvas.addProp("lamp", x, top + 7, true);
  }
  return { spawn, landmarkFronts };
}
