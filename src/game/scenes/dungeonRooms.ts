/**
 * The rooms of a dungeon as the code they stand for (see
 * src/lib/worldgen/roomPlan.ts): each room's name written on the wall above
 * its door, its plaque (which quotes the docstring and offers to edit that
 * code in the Workshop), and which room — so which line of code — the hero
 * stands in.
 */
import { drawText } from "@/game/art/font";
import { plaqueSpot } from "@/lib/worldgen/dungeonDecor";
import type { Dungeon, Prop } from "@/lib/types";
import type { GameServices } from "../services";
import { fitLabel } from "../ui/treemap";
import type { SceneContext } from "./context";
import { propInteractable, type Interactable } from "./interactions";

/** Each room's name is written on the wall above its door: this far into the wall-top tile, warm when documented. */
const ROOM_NAME_DY = 3;
const ROOM_NAME_LIT = "#ffe3a3";
const ROOM_NAME_DIM = "#a89cc0";

/** Every room's name ("def take_order()") on the wall above its plaque, like a sign over a door. */
export function drawRoomNames(g: CanvasRenderingContext2D, ctx: SceneContext, dungeon: Dungeon): void {
  dungeon.rooms.forEach((room, i) => {
    const info = dungeon.roomInfo[i];
    const x = (room.x + 1) * 16;
    const y = (room.y - 2) * 16 + ROOM_NAME_DY;
    if (!info || !ctx.camera.sees(x, y, room.w * 16, 16)) return;
    drawText(g, fitLabel(info.label, (room.w - 1) * 16), x, y, { color: info.lit ? ROOM_NAME_LIT : ROOM_NAME_DIM });
  });
}

/** A room's plaque: reading it quotes the docstring, and the dialog offers "Edit this function" (the Workshop, at that code). */
export function plaqueInteractable(ctx: SceneContext, game: GameServices, dungeon: Dungeon, prop: Prop): Interactable | null {
  const base = propInteractable(ctx, prop);
  const index = dungeon.rooms.findIndex((room) => plaqueSpot(room).x === prop.x && plaqueSpot(room).y === prop.y);
  const info = dungeon.roomInfo[index];
  if (!base || !info || !prop.text) return base;
  const text = prop.text;
  const label = info.kind === "module" ? "Edit this file" : "Edit this function";
  const target = { path: dungeon.path, line: info.line };
  return { ...base, activate: () => game.emitPausing({ type: "dialog", speaker: "Plaque", lines: [text], edit: { label, target } }) };
}

/** First line of the code of the room at tile (tx, ty), or null outside every room (a corridor). */
export function roomLineAt(dungeon: Dungeon, tx: number, ty: number): number | null {
  const index = dungeon.rooms.findIndex((r) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h);
  return dungeon.roomInfo[index]?.line ?? null;
}
