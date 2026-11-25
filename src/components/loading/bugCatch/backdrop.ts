/**
 * The scenery behind the game: sky, distant hills (or sea), a row of trees on
 * the horizon, the ground strip the hero runs on, and drifting clouds.
 *
 * Everything that never moves is painted ONCE per theme into an offscreen
 * canvas (`backdropFor`) and then copied to the screen with a single
 * drawImage per frame. Clouds and night stars move/twinkle, so they are
 * drawn every frame by `drawSkyLife`.
 *
 * Trees, bushes, flowers and ground tiles all come from the theme's art
 * atlas, so the mini-game matches the village the player is about to enter.
 * Browser only (creates canvases) — call from drawing code, never at import.
 */
import { drawSprite, E, getAtlas, W, type Sprite } from "@/game/art";
import { mix } from "@/game/art/color";
import { Pix } from "@/game/art/engine";
import { mulberry32, randInt, randRange } from "@/lib/rng";
import { Ground, type PropKind, type ThemeId } from "@/lib/types";
import { GAME_H, GAME_W, GROUND_Y } from "./tuning";

/** Colours the atlas does not provide: the sky and the far-away layer. */
interface SkyLook {
  skyTop: string;
  skyBottom: string;
  /** Far hills, or the sea for the beach. */
  far: string;
  /** Nearer hills, drawn in front of the far ones. */
  near: string;
  farShape: "hills" | "sea";
  cloud: string;
  stars: boolean;
}

const SKY: Record<ThemeId, SkyLook> = {
  meadow: { skyTop: "#79c5f2", skyBottom: "#d6f2ff", far: "#a9d6a0", near: "#71b565", farShape: "hills", cloud: "#ffffff", stars: false },
  sakura: { skyTop: "#9fd1fa", skyBottom: "#ffe2ee", far: "#f4c2d6", near: "#9fcf96", farShape: "hills", cloud: "#fff6fa", stars: false },
  autumn: { skyTop: "#f0a56c", skyBottom: "#ffe6b8", far: "#e0a46a", near: "#b87b45", farShape: "hills", cloud: "#fff2de", stars: false },
  snow: { skyTop: "#97b6e2", skyBottom: "#eef4fc", far: "#dbe6f4", near: "#bccfe8", farShape: "hills", cloud: "#ffffff", stars: false },
  beach: { skyTop: "#45bde6", skyBottom: "#cbf4ff", far: "#2fb7c4", near: "#6fd8d0", farShape: "sea", cloud: "#ffffff", stars: false },
  night: { skyTop: "#0b1030", skyBottom: "#2b2e6c", far: "#232858", near: "#1b2049", farShape: "hills", cloud: "#3a3f7c", stars: true },
};

/** Ground strip: three 16-px tile rows; the middle one is a path centred on the hero's feet. */
const TILE = 16;
const PATH_ROW_Y = GROUND_Y - TILE / 2;
const BACK_ROW_Y = PATH_ROW_Y - TILE;
const FRONT_ROW_Y = PATH_ROW_Y + TILE;
/** Where the sky/hills end and the grass begins. */
export const HORIZON_Y = BACK_ROW_Y;
/** Number of colour bands in the sky gradient (pixel art uses bands, not smooth gradients). */
const SKY_BANDS = 9;

// ───────────────────────────── static backdrop ─────────────────────────────

const backdrops = new Map<ThemeId, HTMLCanvasElement>();

/** The pre-painted static scenery for a theme (cached). */
export function backdropFor(theme: ThemeId): HTMLCanvasElement {
  let canvas = backdrops.get(theme);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = GAME_W;
    canvas.height = GAME_H;
    paintBackdrop(canvas.getContext("2d")!, theme);
    backdrops.set(theme, canvas);
  }
  return canvas;
}

function paintBackdrop(ctx: CanvasRenderingContext2D, theme: ThemeId): void {
  const sky = SKY[theme];
  paintSky(ctx, sky);
  if (sky.farShape === "sea") paintSea(ctx, sky.far);
  else paintHills(ctx, sky.far, HORIZON_Y - 30, 7, 0.031, 1.3);
  paintHills(ctx, sky.near, HORIZON_Y - 14, 6, 0.047, 4.1);
  paintGround(ctx, theme);
  paintHorizonProps(ctx, theme);
  paintFrontProps(ctx, theme);
}

function paintSky(ctx: CanvasRenderingContext2D, sky: SkyLook): void {
  const bandH = Math.ceil(HORIZON_Y / SKY_BANDS);
  for (let i = 0; i < SKY_BANDS; i++) {
    ctx.fillStyle = mix(sky.skyTop, sky.skyBottom, i / (SKY_BANDS - 1));
    ctx.fillRect(0, i * bandH, GAME_W, bandH);
  }
}

/** A rolling hill silhouette: one 1-px column per x, height from two sine waves. */
function paintHills(ctx: CanvasRenderingContext2D, color: string, baseY: number, amp: number, freq: number, seed: number): void {
  ctx.fillStyle = color;
  for (let x = 0; x < GAME_W; x++) {
    const h = amp * Math.sin(x * freq + seed) + amp * 0.5 * Math.sin(x * freq * 2.3 + seed * 2);
    const top = Math.round(baseY + h);
    ctx.fillRect(x, top, 1, HORIZON_Y - top);
  }
}

/** The beach's far layer: a flat sea band with a few shine streaks. */
function paintSea(ctx: CanvasRenderingContext2D, color: string): void {
  const top = HORIZON_Y - 26;
  ctx.fillStyle = color;
  ctx.fillRect(0, top, GAME_W, HORIZON_Y - top);
  ctx.fillStyle = mix(color, "#ffffff", 0.55);
  const rng = mulberry32(11);
  for (let i = 0; i < 14; i++) {
    ctx.fillRect(randInt(rng, 0, GAME_W), randInt(rng, top + 2, HORIZON_Y - 4), randInt(rng, 3, 9), 1);
  }
}

function placeProp(ctx: CanvasRenderingContext2D, theme: ThemeId, kind: PropKind, variant: number, x: number, y: number): void {
  drawSprite(ctx, getAtlas(theme).prop(kind, variant, 0), x, y);
}

/** Trees and bushes standing on the back grass row, in front of the hills (painted after the ground). */
function paintHorizonProps(ctx: CanvasRenderingContext2D, theme: ThemeId): void {
  const rng = mulberry32(7);
  const treeXs = [14, 58, 250, 300];
  for (const [i, x] of treeXs.entries()) {
    const kind: PropKind = i % 2 === 0 ? "tree" : "treeAlt";
    placeProp(ctx, theme, kind, i, x + randInt(rng, -4, 4), BACK_ROW_Y + 8);
  }
  for (const x of [100, 214]) placeProp(ctx, theme, "bush", randInt(rng, 0, 2), x, BACK_ROW_Y + 11);
}

function paintGround(ctx: CanvasRenderingContext2D, theme: ThemeId): void {
  const atlas = getAtlas(theme);
  const pathMask = E | W; // the path continues left and right, with grass above and below
  for (let tx = 0; tx * TILE < GAME_W; tx++) {
    const variant = (tx * 7) & 255;
    drawSprite(ctx, atlas.ground(Ground.Grass, 15, variant, 0), tx * TILE, BACK_ROW_Y);
    drawSprite(ctx, atlas.ground(Ground.Path, pathMask, variant, 0), tx * TILE, PATH_ROW_Y);
    drawSprite(ctx, atlas.ground(Ground.Grass, 15, variant + 3, 0), tx * TILE, FRONT_ROW_Y);
  }
}

/** Flowers and mushrooms dotted along the front grass row. */
function paintFrontProps(ctx: CanvasRenderingContext2D, theme: ThemeId): void {
  const rng = mulberry32(23);
  for (let x = 10; x < GAME_W; x += randInt(rng, 26, 44)) {
    const kind: PropKind = randRange(rng, 0, 1) < 0.25 ? "mushroom" : "flower";
    placeProp(ctx, theme, kind, randInt(rng, 0, 3), x, GAME_H);
  }
}

// ───────────────────────────── moving sky life ─────────────────────────────

interface CloudSpot {
  /** Position at time 0; clouds drift right and wrap around. */
  x: number;
  y: number;
  speed: number;
  big: boolean;
}

const CLOUDS: CloudSpot[] = [
  { x: 20, y: 18, speed: 3, big: true },
  { x: 130, y: 40, speed: 2, big: false },
  { x: 210, y: 12, speed: 4, big: true },
  { x: 285, y: 52, speed: 2.5, big: false },
];
const CLOUD_WRAP = 60;

const cloudSprites = new Map<string, Sprite>();

/** A soft cloud made of overlapping ellipses: lighter on top, a touch darker underneath. */
function cloudSprite(color: string, big: boolean): Sprite {
  const key = `${color}:${big}`;
  let s = cloudSprites.get(key);
  if (!s) {
    const w = big ? 40 : 26;
    const h = big ? 14 : 10;
    const p = new Pix(w, h);
    const under = mix(color, "#7f8fb8", 0.18);
    p.ellipse(w / 2 - 0.5, h - 4, w / 2 - 1, 3, under);
    p.ellipse(w * 0.32, h - 6, w * 0.2, h * 0.32, color);
    p.ellipse(w * 0.6, h * 0.45, w * 0.24, h * 0.42, color);
    p.ellipse(w / 2 - 0.5, h - 5, w / 2 - 2, 2, color);
    s = p.toSprite(Math.floor(w / 2), h);
    cloudSprites.set(key, s);
  }
  return s;
}

/** Star positions for night skies (fixed, so they twinkle in place). */
const STARS = (() => {
  const rng = mulberry32(31);
  return Array.from({ length: 34 }, () => ({ x: randInt(rng, 0, GAME_W - 1), y: randInt(rng, 0, HORIZON_Y - 40), phase: rng() }));
})();

/** Clouds (and twinkling stars at night), drawn every frame on top of the static backdrop. */
export function drawSkyLife(ctx: CanvasRenderingContext2D, theme: ThemeId, time: number): void {
  const sky = SKY[theme];
  if (sky.stars) {
    for (const star of STARS) {
      const twinkle = Math.sin((time * 0.8 + star.phase) * Math.PI * 2);
      ctx.fillStyle = twinkle > 0.6 ? "#ffffff" : "#b9b6ff";
      ctx.fillRect(star.x, star.y, 1, 1);
    }
  }
  const span = GAME_W + CLOUD_WRAP * 2;
  for (const c of CLOUDS) {
    const x = ((c.x + time * c.speed) % span) - CLOUD_WRAP;
    drawSprite(ctx, cloudSprite(sky.cloud, c.big), x, c.y + 10);
  }
}

/** True for themes whose sky is dark (the drawing code adds glows there). */
export function isNightSky(theme: ThemeId): boolean {
  return SKY[theme].stars;
}
