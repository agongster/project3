/**
 * Floor code: each monster's offending line carved into the dungeon floor.
 * These test the pure layout (floorCodeLayout.ts): which text, how it is
 * cleaned and shortened, and where it goes — inside the monster's room, on
 * floor, never on top of another carving — first on hand-made rooms, then on
 * real dungeons generated from the demo kingdom.
 */
import { describe, expect, it } from "vitest";
import { measureText } from "@/game/art/font";
import { GLYPHS } from "@/game/art/fontGlyphs";
import { TILE_PX } from "@/game/engine/collision";
import {
  boxesTouch,
  CARVING_GAP_PX,
  CARVING_H,
  carvingText,
  cleanCodeLine,
  ELLIPSIS,
  fitText,
  layoutCarvings,
  MAX_CARVING_PX,
  MIN_CARVING_PX,
  placeCarving,
  ROOM_MARGIN_PX,
  UNKNOWN_CHAR,
  type Carving,
} from "@/game/scenes/floorCodeLayout";
import { analyzeDemoSources } from "@/lib/analysis/demo";
import { generateDungeon } from "@/lib/worldgen";
import { Ground, type Dungeon, type Finding, type MonsterKind, type MonsterSpawn, type Rect, type SnippetLine } from "@/lib/types";
import { createNodeLint } from "../analysis/nodeLint";

/** A finding with just the fields the layout reads filled in sensibly. */
function finding(id: string, snippet: SnippetLine[], extra: Partial<Finding> = {}): Finding {
  return {
    id,
    path: "bakery/orders.py",
    code: "S307",
    title: "Use of eval",
    message: "Use of possibly insecure function",
    line: snippet.find((s) => s.hit)?.n ?? 1,
    col: 1,
    endLine: 1,
    endCol: 2,
    severity: "minion",
    category: "security",
    monster: "dustBunny",
    snippet,
    tip: "",
    ...extra,
  };
}

const LONG_LINE = "    result = some_module.compute_everything(first_argument, second_argument, third_argument)";
const spawn = (findingId: string, x: number, y: number, kind: MonsterKind = "dustBunny"): MonsterSpawn => ({ findingId, kind, x, y });

/** The room's floor in px, minus the wall margin: every carving must fit in here. */
function interior(room: Rect) {
  return { left: room.x * TILE_PX + ROOM_MARGIN_PX, top: room.y * TILE_PX + ROOM_MARGIN_PX, right: (room.x + room.w) * TILE_PX - ROOM_MARGIN_PX, bottom: (room.y + room.h) * TILE_PX - ROOM_MARGIN_PX };
}
function expectInside(c: Pick<Carving, "x" | "y" | "w" | "h">, room: Rect) {
  const r = interior(room);
  expect(c.x).toBeGreaterThanOrEqual(r.left);
  expect(c.y).toBeGreaterThanOrEqual(r.top);
  expect(c.x + c.w).toBeLessThanOrEqual(r.right);
  expect(c.y + c.h).toBeLessThanOrEqual(r.bottom);
}
function expectNoOverlaps(carvings: Carving[]) {
  for (let i = 0; i < carvings.length; i++) {
    for (let j = i + 1; j < carvings.length; j++) expect(boxesTouch(carvings[i], carvings[j], CARVING_GAP_PX), `${carvings[i].text} / ${carvings[j].text}`).toBe(false);
  }
}

describe("the pixel font can carve code", () => {
  it("has a glyph for every printable ASCII character, so code never shows placeholder boxes", () => {
    const missing: string[] = [];
    for (let code = 0x20; code <= 0x7e; code++) if (!Object.hasOwn(GLYPHS, String.fromCharCode(code))) missing.push(String.fromCharCode(code));
    expect(missing).toEqual([]);
  });
});

describe("cleanCodeLine", () => {
  it("collapses tabs and runs of spaces and trims the ends", () => {
    expect(cleanCodeLine("\t\tif  x ==\t1:   ")).toBe("if x == 1:");
  });

  it("keeps Python punctuation exactly", () => {
    const code = `d = {"k": [a[0] + b % 2, c | ~e & f ^ g]}  # @decorator \\ \`x\` <= >= != ; !`;
    expect(cleanCodeLine(code)).toBe(code.replace(/ {2,}/g, " "));
  });

  it("turns characters the font cannot draw into '?', one per character (emoji included)", () => {
    expect(cleanCodeLine('print("café 🍰 日本")')).toBe(`print("caf${UNKNOWN_CHAR} ${UNKNOWN_CHAR} ${UNKNOWN_CHAR}${UNKNOWN_CHAR}")`);
  });

  it("keeps the ellipsis the analyser adds to very long snippet lines", () => {
    expect(cleanCodeLine("x = 1…")).toBe("x = 1…");
  });
});

describe("carvingText", () => {
  it("is the hit line with its line number, leading whitespace trimmed", () => {
    const f = finding("a", [
      { n: 21, text: "def run(user_input):", hit: false },
      { n: 22, text: "    x = eval(user_input)", hit: true },
      { n: 23, text: "    return x", hit: false },
    ]);
    expect(carvingText(f)).toBe("L22  x = eval(user_input)");
  });

  it("skips blank hit lines and uses the next non-blank one", () => {
    const f = finding("a", [
      { n: 4, text: "   ", hit: true },
      { n: 5, text: "import os", hit: true },
    ]);
    expect(carvingText(f)).toBe("L5  import os");
  });

  it("falls back to the title as a Python comment when no hit line has code", () => {
    expect(carvingText(finding("a", [{ n: 9, text: "", hit: true }], { line: 9, title: "Blank line at end of file" }))).toBe("L9  # Blank line at end of file");
    expect(carvingText(finding("a", [], { line: 40, title: "Syntax error" }))).toBe("L40  # Syntax error");
  });

  it("is null when there is nothing to carve at all", () => {
    expect(carvingText(finding("a", [], { title: "  " }))).toBeNull();
  });
});

describe("fitText", () => {
  it("leaves text that fits alone", () => {
    expect(fitText("L3  import os", 200)).toBe("L3  import os");
  });

  it("cuts long text with an ellipsis, keeping as much as fits", () => {
    const text = cleanCodeLine(LONG_LINE);
    const cut = fitText(text, 80);
    expect(cut.endsWith(ELLIPSIS)).toBe(true);
    expect(measureText(cut)).toBeLessThanOrEqual(80);
    const kept = cut.slice(0, -ELLIPSIS.length);
    expect(text.startsWith(kept)).toBe(true);
    // One more character would not have fitted.
    expect(measureText(text.slice(0, kept.length + 1).trimEnd() + ELLIPSIS)).toBeGreaterThan(80);
  });

  it("never leaves a space before the ellipsis", () => {
    for (let px = 20; px < 120; px++) expect(fitText("a b c d e f g h i j k l m n o p", px)).not.toMatch(/ …$/);
  });

  it("is empty when not even the ellipsis fits", () => {
    expect(fitText("hello", 2)).toBe("");
  });
});

describe("placeCarving", () => {
  const room: Rect = { x: 2, y: 3, w: 14, h: 8 };

  it("lies centred just below the monster's feet when the floor is free", () => {
    const c = placeCarving("L3  import os", { x: 8, y: 5, kind: "dustBunny" }, room, [])!;
    expect(c.text).toBe("L3  import os");
    expect(c.h).toBe(CARVING_H);
    expect(Math.abs(c.x + c.w / 2 - (8 * TILE_PX + TILE_PX / 2))).toBeLessThanOrEqual(1);
    expect(c.y).toBeGreaterThan(5 * TILE_PX + TILE_PX / 2);
    expect(c.y).toBeLessThan(6 * TILE_PX + TILE_PX / 2);
  });

  it("is never wider than MAX_CARVING_PX", () => {
    const c = placeCarving(cleanCodeLine(LONG_LINE), { x: 8, y: 5, kind: "dustBunny" }, { x: 2, y: 3, w: 40, h: 8 }, [])!;
    expect(c.w).toBeLessThanOrEqual(MAX_CARVING_PX);
    expect(c.text.endsWith(ELLIPSIS)).toBe(true);
  });

  it("slides away from the walls to stay inside a monster's room", () => {
    for (const at of [spawn("a", room.x, room.y), spawn("a", room.x + room.w - 1, room.y + room.h - 1), spawn("a", room.x, room.y + room.h - 1)]) {
      expectInside(placeCarving(cleanCodeLine(LONG_LINE), at, room, [])!, room);
    }
  });

  it("is never wider than a narrow room", () => {
    const narrow: Rect = { x: 2, y: 3, w: 4, h: 6 };
    const c = placeCarving(cleanCodeLine(LONG_LINE), spawn("a", 3, 4), narrow, [])!;
    expectInside(c, narrow);
  });

  it("moves or shortens to keep clear of what is already taken, and gives up below MIN_CARVING_PX", () => {
    const everythingTaken = [{ x: 0, y: 0, w: 1000, h: 1000 }];
    expect(placeCarving("L3  import os", spawn("a", 8, 5), room, everythingTaken)).toBeNull();
    const tiny: Rect = { x: 2, y: 3, w: 2, h: 2 };
    expect(MIN_CARVING_PX).toBeGreaterThan(tiny.w * TILE_PX - 2 * ROOM_MARGIN_PX);
    expect(placeCarving("L3  import os", spawn("a", 2, 3), tiny, [])).toBeNull();
  });
});

/** A 24×14 map of wall with floor inside `rooms`, the shape layoutCarvings reads. */
function handMadeMap(rooms: Rect[]) {
  const width = 24;
  const ground = new Uint8Array(width * 14).fill(Ground.DungeonWall);
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) ground.fill(Ground.DungeonFloor, y * width + r.x, y * width + r.x + r.w);
  return { width, ground, rooms };
}

describe("layoutCarvings on hand-made rooms", () => {
  const room: Rect = { x: 2, y: 3, w: 16, h: 8 };
  // The end door sits in the room's east wall; its landing is the two floor tiles west of it.
  const base = { ...handMadeMap([room]), chest: { x: 15, y: 7 }, endDoor: { x: 18, y: 5 }, props: [] };
  const longFinding = (id: string, n: number) => finding(id, [{ n, text: `${LONG_LINE} # ${id}`, hit: true }]);

  it("never overlaps carvings of monsters that start close together", () => {
    // A tight cluster: neighbours 2 tiles apart, in the same and in adjacent rows.
    const monsters = [spawn("a", 6, 5), spawn("b", 8, 5), spawn("c", 7, 7), spawn("d", 9, 7), spawn("e", 6, 9), spawn("f", 10, 9)];
    const carvings = layoutCarvings({ ...base, monsters }, monsters.map((m, i) => longFinding(m.findingId, 10 + i)));
    expect(carvings.length).toBeGreaterThanOrEqual(4);
    expectNoOverlaps(carvings);
    for (const c of carvings) expectInside(c, room);
  });

  it("keeps off the chest, the tiles above it (its arrow) and below it (where the hero opens it), the end door's landing, and solid props", () => {
    const monsters = [spawn("a", 15, 5)];
    const props = [{ kind: "crate" as const, x: 14, y: 7, variant: 0, solid: true }];
    const [c] = layoutCarvings({ ...base, props, monsters }, [longFinding("a", 3)]);
    const { chest } = base;
    const landing = [{ x: 17, y: 5 }, { x: 16, y: 5 }];
    for (const t of [chest, { x: chest.x, y: chest.y - 1 }, { x: chest.x, y: chest.y + 1 }, ...landing, props[0]]) expect(boxesTouch(c, { x: t.x * TILE_PX, y: t.y * TILE_PX, w: TILE_PX, h: TILE_PX }, 0)).toBe(false);
  });

  it("does not lie under another monster's starting spot", () => {
    const monsters = [spawn("a", 8, 5), spawn("b", 8, 7)];
    const carvings = layoutCarvings({ ...base, monsters }, [longFinding("a", 1), longFinding("b", 2)]);
    const a = carvings.find((c) => c.findingId === "a")!;
    // b's body rises 16 px from its feet, 12 px below the top of its tile.
    expect(boxesTouch(a, { x: 8 * TILE_PX, y: 7 * TILE_PX + 12 - 16, w: 16, h: 16 }, 0)).toBe(false);
  });

  it("skips monsters whose finding is missing or has nothing to carve, and keeps the rest", () => {
    const monsters = [spawn("gone", 5, 5), spawn("empty", 9, 5), spawn("ok", 13, 8)];
    const carvings = layoutCarvings({ ...base, monsters }, [finding("empty", [], { title: "" }), finding("ok", [{ n: 2, text: "import os", hit: true }])]);
    expect(carvings.map((c) => [c.findingId, c.text])).toEqual([["ok", "L2  import os"]]);
  });

  it("never runs through a wall standing inside the room", () => {
    const ground = base.ground.slice();
    // A wall two tiles tall, right where the carving under the monster would go.
    for (const y of [5, 6]) ground[y * base.width + 9] = Ground.DungeonWall;
    const [c] = layoutCarvings({ ...base, ground, monsters: [spawn("a", 8, 5)] }, [longFinding("a", 1)]);
    for (const y of [5, 6]) expect(boxesTouch(c, { x: 9 * TILE_PX, y: y * TILE_PX, w: TILE_PX, h: TILE_PX }, 0)).toBe(false);
    expectInside(c, room);
  });

  it("skips a monster standing outside every room instead of carving into a wall", () => {
    expect(layoutCarvings({ ...base, monsters: [spawn("a", 0, 0)] }, [longFinding("a", 1)])).toEqual([]);
  });
});

describe("layoutCarvings on real dungeons from the demo kingdom", () => {
  const analysis = analyzeDemoSources(createNodeLint());
  const cursed = analysis.files.filter((f) => f.findings.length > 0);
  const SEEDS = [7, 1234, 99991];

  const isFloor = (d: Dungeon, x: number, y: number) => {
    const g = d.ground[y * d.width + x];
    return g === Ground.DungeonFloor || g === Ground.DungeonFloorAlt;
  };

  it("has dungeons to test", () => {
    expect(cursed.length).toBeGreaterThanOrEqual(5);
  });

  for (const seed of SEEDS) {
    it(`carves every monster's line on floor inside its own room, without overlaps (seed ${seed})`, () => {
      for (const file of cursed) {
        const dungeon = generateDungeon(file, seed);
        const carvings = layoutCarvings(dungeon, file.findings);
        expect(carvings.length, file.path).toBe(dungeon.monsters.length);
        expectNoOverlaps(carvings);
        for (const c of carvings) {
          const m = dungeon.monsters.find((s) => s.findingId === c.findingId)!;
          const room = dungeon.rooms.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h)!;
          expectInside(c, room);
          for (let ty = Math.floor(c.y / TILE_PX); ty <= Math.floor((c.y + c.h - 1) / TILE_PX); ty++) {
            for (let tx = Math.floor(c.x / TILE_PX); tx <= Math.floor((c.x + c.w - 1) / TILE_PX); tx++) expect(isFloor(dungeon, tx, ty), `${file.path} ${c.text}`).toBe(true);
          }
          expect(c.w).toBeLessThanOrEqual(MAX_CARVING_PX);
          expect(c.text.startsWith("L")).toBe(true);
        }
      }
    });
  }
});
