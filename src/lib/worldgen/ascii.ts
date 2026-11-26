/**
 * renderAscii: a text picture of a generated map, one character per tile.
 * Handy for debugging and for eyeballing layouts in tests / the console.
 *
 * Legend
 *   ground    .  grass        ,  meadow      =  path        :  plaza
 *             ~  water        -  sand        H  bridge
 *             .  dungeon floor ,  alt floor   #  wall top    =  wall face
 *             (space) void    <  dungeon exit  >  end door (last room)
 *   buildings #  clean footprint   X  corrupted footprint   D  door
 *   props     T Y trees  b bush  o rock  * flower  m mushroom  u stump
 *             i lamp  f fence  n bench  ! lantern  S sign  W well
 *             R wardrobe  B board  F fountain  p pot  x crate  ^ torch
 *             % bones  $ crystal  w web  P plaque
 *   actors    &  villager   @  spawn / entrance   C  chest
 *             1 2 3  monster (minion / elite / boss)
 */
import { Ground, type Dungeon, type Overworld, type PropKind, type TileMap } from "@/lib/types";
import { MONSTERS } from "@/lib/game/catalog";

/** Anything with a tile map; overworld/dungeon extras are drawn when present. */
export type AsciiSource = TileMap & Partial<Omit<Overworld, keyof TileMap>> & Partial<Omit<Dungeon, keyof TileMap>>;

/** An extra character to stamp on top of everything else. */
export interface AsciiMark {
  x: number;
  y: number;
  ch: string;
}

const GROUND_CHARS: Record<number, string> = {
  [Ground.Grass]: ".",
  [Ground.Meadow]: ",",
  [Ground.Path]: "=",
  [Ground.Plaza]: ":",
  [Ground.Water]: "~",
  [Ground.Sand]: "-",
  [Ground.Bridge]: "H",
  [Ground.DungeonFloor]: ".",
  [Ground.DungeonFloorAlt]: ",",
  [Ground.DungeonWall]: "#",
  [Ground.DungeonWallFace]: "=",
  [Ground.DungeonVoid]: " ",
  [Ground.DungeonExit]: "<",
};

const PROP_CHARS: Record<PropKind, string> = {
  tree: "T",
  treeAlt: "Y",
  bush: "b",
  rock: "o",
  flower: "*",
  mushroom: "m",
  stump: "u",
  lamp: "i",
  fence: "f",
  bench: "n",
  lantern: "!",
  sign: "S",
  well: "W",
  wardrobe: "R",
  board: "B",
  fountain: "F",
  pot: "p",
  crate: "x",
  torch: "^",
  bones: "%",
  crystal: "$",
  web: "w",
  plaque: "P",
};

const SEVERITY_CHARS = { minion: "1", elite: "2", boss: "3" } as const;

export function renderAscii(map: AsciiSource, overlays: readonly AsciiMark[] = []): string {
  const { width, height } = map;
  const rows: string[][] = [];
  for (let y = 0; y < height; y++) {
    const row: string[] = [];
    for (let x = 0; x < width; x++) row.push(GROUND_CHARS[map.ground[y * width + x]] ?? "?");
    rows.push(row);
  }
  const put = (x: number, y: number, ch: string) => {
    if (x >= 0 && y >= 0 && x < width && y < height) rows[y][x] = ch;
  };

  for (const b of map.buildings ?? []) {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) put(x, y, b.corrupted ? "X" : "#");
    put(b.door.x, b.door.y, "D");
  }
  for (const p of map.props ?? []) put(p.x, p.y, PROP_CHARS[p.kind]);
  for (const n of map.npcs ?? []) put(n.x, n.y, "&");
  for (const m of map.monsters ?? []) put(m.x, m.y, SEVERITY_CHARS[MONSTERS[m.kind].severity]);
  if (map.chest) put(map.chest.x, map.chest.y, "C");
  if (map.spawn) put(map.spawn.x, map.spawn.y, "@");
  if (map.entrance) put(map.entrance.x, map.entrance.y, "@");
  if (map.endDoor) put(map.endDoor.x, map.endDoor.y, ">");
  for (const mark of overlays) put(mark.x, mark.y, mark.ch);

  return rows.map((row) => row.join("")).join("\n");
}
