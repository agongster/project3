/**
 * Ground rendering.
 *
 * Drawing every ground tile every frame would be ~400 drawImage calls per
 * frame for nothing: the ground never changes. Instead the map is cut into
 * CHUNKS of 16×16 tiles, each pre-rendered once into its own off-screen
 * canvas, and a frame only draws the 1–4 chunks that are on screen.
 *
 * Chunks are built lazily (the first time they come into view) and thrown
 * away when the scenery theme changes. Animated tiles (water, bridges, the
 * dungeon exit) are remembered per chunk and redrawn on top every frame with
 * the current animation frame.
 *
 * Each tile's look comes from the art atlas:
 *   - its AUTOTILE MASK (which neighbours are the same kind of ground, so
 *     paths and ponds get rounded grassy edges), see `autotileMask`
 *   - a VARIANT number from a hash of its position, so the grass is varied
 *     but identical every time you visit.
 */
import { autotileMask, getAtlas, groundFrames } from "@/game/art";
import type { GroundId, ThemeId, TileMap } from "@/lib/types";
import { TILE_PX } from "./collision";

const CHUNK_TILES = 16;
const CHUNK_PX = CHUNK_TILES * TILE_PX;
/** Seconds per frame of animated ground (water ripples). */
const GROUND_FRAME_SEC = 0.28;

interface AnimatedTile {
  tx: number;
  ty: number;
  id: GroundId;
  mask: number;
  variant: number;
}

interface Chunk {
  canvas: HTMLCanvasElement;
  animated: AnimatedTile[];
}

/** A stable pseudo-random 0–255 number for a tile position (so variants never flicker). */
export function tileVariant(tx: number, ty: number): number {
  let h = Math.imul(tx, 374761393) ^ Math.imul(ty, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) & 255;
}

export class GroundRenderer {
  private chunks = new Map<number, Chunk>();
  private theme: ThemeId | null = null;
  private readonly at: (x: number, y: number) => number;

  constructor(private readonly map: TileMap) {
    this.at = (x, y) => (x < 0 || y < 0 || x >= map.width || y >= map.height ? -1 : map.ground[y * map.width + x]);
  }

  /** Draws the ground under a view rectangle (world pixels). The context must already be translated by the camera. */
  draw(g: CanvasRenderingContext2D, theme: ThemeId, viewX: number, viewY: number, viewW: number, viewH: number, time: number): void {
    if (theme !== this.theme) {
      this.chunks.clear();
      this.theme = theme;
    }
    const atlas = getAtlas(theme);
    const frame = Math.floor(time / GROUND_FRAME_SEC);
    const cx0 = Math.max(0, Math.floor(viewX / CHUNK_PX));
    const cy0 = Math.max(0, Math.floor(viewY / CHUNK_PX));
    const cx1 = Math.min(Math.ceil(this.map.width / CHUNK_TILES) - 1, Math.floor((viewX + viewW) / CHUNK_PX));
    const cy1 = Math.min(Math.ceil(this.map.height / CHUNK_TILES) - 1, Math.floor((viewY + viewH) / CHUNK_PX));

    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const chunk = this.chunk(cx, cy, theme);
        g.drawImage(chunk.canvas, cx * CHUNK_PX, cy * CHUNK_PX);
        for (const t of chunk.animated) {
          const sprite = atlas.ground(t.id, t.mask, t.variant, frame + (t.variant & 1));
          g.drawImage(sprite.canvas, t.tx * TILE_PX, t.ty * TILE_PX);
        }
      }
    }
  }

  private chunk(cx: number, cy: number, theme: ThemeId): Chunk {
    const key = cy * 4096 + cx;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.buildChunk(cx, cy, theme);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  private buildChunk(cx: number, cy: number, theme: ThemeId): Chunk {
    const atlas = getAtlas(theme);
    const canvas = document.createElement("canvas");
    canvas.width = CHUNK_PX;
    canvas.height = CHUNK_PX;
    const g = canvas.getContext("2d")!;
    const animated: AnimatedTile[] = [];
    for (let j = 0; j < CHUNK_TILES; j++) {
      for (let i = 0; i < CHUNK_TILES; i++) {
        const tx = cx * CHUNK_TILES + i;
        const ty = cy * CHUNK_TILES + j;
        if (tx >= this.map.width || ty >= this.map.height) continue;
        const id = this.at(tx, ty) as GroundId;
        const mask = autotileMask(this.at, tx, ty);
        const variant = tileVariant(tx, ty);
        g.drawImage(atlas.ground(id, mask, variant, 0).canvas, i * TILE_PX, j * TILE_PX);
        if (groundFrames(id) > 1) animated.push({ tx, ty, id, mask, variant });
      }
    }
    return { canvas, animated };
  }
}
