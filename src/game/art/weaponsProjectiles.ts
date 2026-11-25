/**
 * Projectiles and attack bolts: thrown ducks, arrows, wand sparks, the
 * boomerang, sword waves, and the monsters' spit / orbs / keys / glitch
 * blocks / noodles.
 *
 *   drawSprite(ctx, projectileSprite("arrow"), p.x, p.y, { rotation: p.angle });
 *
 * All are drawn flying RIGHT and anchored at their CENTRE, so the engine can
 * rotate them to any direction. Spinning things (boomerang, key) get their
 * frames by turning the grid in exact 90° steps, which keeps pixels crisp.
 */
import { INK, withAlpha } from "./color";
import { cached, mod, Pix, type Palette, type Sprite } from "./engine";
import { BASE_PAL } from "./uiKit";
import { DUCK, GOLDEN_DUCK } from "./weaponsPalettes";

export type ProjectileName = "duck" | "goldenDuck" | "arrow" | "spark" | "boomerang" | "wave" | "spit" | "orb" | "key" | "glitchBlock" | "noodle";

export const PROJECTILE_FRAMES: Record<ProjectileName, number> = {
  duck: 1,
  goldenDuck: 2,
  arrow: 1,
  spark: 2,
  boomerang: 4,
  wave: 2,
  spit: 2,
  orb: 2,
  key: 4,
  glitchBlock: 2,
  noodle: 2,
};

/** Turns a grid a quarter turn clockwise `times` times. */
export function rotateGrid(rows: readonly string[], times: number): string[] {
  let out = [...rows];
  for (let t = 0; t < mod(times, 4); t++) {
    const h = out.length;
    const w = Math.max(...out.map((r) => r.length));
    const src = out.map((r) => r.padEnd(w, "."));
    out = Array.from({ length: w }, (_, y) => Array.from({ length: h }, (_, x) => src[h - 1 - x][y]).join(""));
  }
  return out;
}

/** Grid → outlined picture (outline colour optional; null = none). */
function art(rows: readonly string[], pal: Palette, line: string | null = INK): Pix {
  const w = Math.max(...rows.map((r) => r.length));
  const p = new Pix(w + 2, rows.length + 2);
  p.stamp(rows, { ...BASE_PAL, ...pal }, 1, 1);
  if (line) p.outline(line);
  return p;
}

// ───────────────────────────── player shots ─────────────────────────────

/** Duck colours are shared with the in-hand weapon and the item icon. */
const DUCK_PAL = DUCK;
const GOLD_DUCK_PAL = GOLDEN_DUCK;

/** A duck in flight: leaning forward, wing tucked. */
const DUCK_FLY = [
  "....wyy...",
  "...wyyyy..",
  "...yykyyoo",
  "yy.yyyyyOo",
  ".yyyyyyyy.",
  ".YyyYyyYy.",
  "..YYYYYY..",
];

/** "->": a type-hint arrow. f = fletching. */
const ARROW = ["ff........h.", ".fbbbbbbbbhh", "ff........h."];

/** The wand's breakpoint bolt, two twinkle frames. */
const SPARK = [
  ["...x...", "...r...", "..rRr..", "xrRwRrx", "..rRr..", "...r...", "...x..."],
  ["x.....x", ".r...r.", "..rRr..", "..RwR..", "..rRr..", ".r...r.", "x.....x"],
];

/** The boomerang: a chunky chevron (the 4 spin frames are this grid turned). */
const BOOMERANG = [".bbbbbb", "bccbbbs", "bb.....", "bb.....", "bc.....", "bb.....", ".s....."];

/** A crescent slash wave bulging forward. a = teal, v = violet, w = white core. */
const WAVE = [
  ["aa....", ".aaa..", "..wwa.", "...wwa", "...wwa", "...wwv", "...wwv", "..wwv.", ".vvv..", "vv...."],
  ["a.....", ".aa...", "..waa.", "..wwa.", "...wwa", "...wwv", "..wwv.", "..wvv.", ".vv...", "v....."],
];

// ───────────────────────────── monster shots ─────────────────────────────

/** Toad spit: a wobbly slimy glob with a shine. */
const SPIT = [
  [".ggg..", "gwhgg.", "ghgggs", "gggggs", ".gsss."],
  ["..gg..", ".whggg", "ghgggs", "gggggs", ".ssgs."],
];

/** The boss orb: a glowing magenta ball, its halo pulsing. */
const ORB_CORE = ["..mmm..", ".mwwmm.", "mwwmmmM", "mmmmmmM", "mmmmmMM", ".mmmMM.", "..MMM.."];

/** A thrown key (turned for the spin frames). */
const KEY = [".yy.......", "y..yyyyyyy", "y..y...y.y", ".yy......."];

/** A falling glitch block: a "missing texture" checker cube. */
const GLITCH = ["mmkkmmkk", "mmkkmmkk", "kkmmkkmm", "kkmmkkmm", "mmkkmmkk", "mmkkmmkk", "kkmmkkmm", "kkmmkkmm"];

/** A bit of noodle wriggling through the air. */
const NOODLE = [
  ["..hh....h", ".n..n..nh", "n....nn..", "........."],
  ["h........", "nh..hh...", "..nn..n.n", "........n"],
];

// ───────────────────────────── painting ─────────────────────────────

/**
 * A soft halo around a picture: every empty pixel within `radius` of it gets
 * `color` at an opacity that fades with distance (0.5 next to it, less
 * further out). Banded, not smooth — pixel-art light.
 */
function withGlow(src: Pix, color: string, radius: number): Pix {
  const pad = radius;
  const p = new Pix(src.w + pad * 2, src.h + pad * 2);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      let best = Infinity;
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) if (src.has(x - pad + dx, y - pad + dy)) best = Math.min(best, Math.hypot(dx, dy));
      if (best <= radius + 0.3) p.set(x, y, withAlpha(color, best <= 1 ? 0.5 : best <= 2 ? 0.28 : 0.14));
    }
  }
  p.paste(src, pad, pad);
  return p;
}

function paint(name: ProjectileName, f: number): Pix {
  switch (name) {
    case "duck":
      return art(DUCK_FLY, DUCK_PAL);
    case "goldenDuck": {
      const p = withGlow(art(DUCK_FLY, GOLD_DUCK_PAL), "#ffe680", 1);
      // a twinkle that hops between two spots
      const [x, y] = f ? [2, 2] : [11, 8];
      p.set(x, y, "#ffffff");
      p.set(x - 1, y, "#fff1a0");
      p.set(x + 1, y, "#fff1a0");
      p.set(x, y - 1, "#fff1a0");
      p.set(x, y + 1, "#fff1a0");
      return p;
    }
    case "arrow":
      return art(ARROW, { f: "#ff8fb1", b: "#e8b274", h: "#e6ebf7" });
    case "spark":
      return withGlow(art(SPARK[f], { r: "#ff7a8a", R: "#e83a50", x: "#fff1a0" }, null), "#ff5a6e", 1);
    case "boomerang":
      return art(rotateGrid(BOOMERANG, f), { b: "#f08c3a", s: "#c0602a", c: "#ffffff" });
    case "wave":
      return withGlow(art(WAVE[f], { a: "#5cf2e0", v: "#c77dff" }, null), "#9ff6ff", 1);
    case "spit":
      return art(SPIT[f], { g: "#a6e86a", h: "#e4ffc8", s: "#5fae4a" }, "#2f5a34");
    case "orb": {
      const p = withGlow(art(ORB_CORE, { m: "#ff5ad8", M: "#b02a9a" }), "#ff8af0", f ? 2 : 1);
      return p;
    }
    case "key":
      return art(rotateGrid(KEY, f), { y: "#ffd34d", Y: "#fff4b0" }, "#8a5a1e");
    case "glitchBlock": {
      const block = art(GLITCH, { m: "#ff3ad8", k: "#1c1838" });
      const p = new Pix(block.w + 2, block.h);
      const s = f ? 1 : 2;
      block.forEach((x, y) => {
        p.blend(x + 1 - s + 1, y, "#ff3a6a", 0.6);
        p.blend(x + 1 + s - 1, y, "#3ae8ff", 0.6);
      });
      p.paste(block, 1, 0);
      return p;
    }
    case "noodle":
      return art(NOODLE[f], { n: "#ffdf8a", h: "#fff6d2" }, "#8a5a2e");
  }
}

const store = new Map<string, Sprite>();

/** A projectile frame, anchored at its centre and flying right. Cached. */
export function projectileSprite(name: ProjectileName, frame = 0): Sprite {
  const f = mod(frame, PROJECTILE_FRAMES[name] ?? 1);
  return cached(store, `${name}:${f}`, () => {
    const p = paint(name, f) ?? new Pix(1, 1);
    return p.toSprite(Math.floor(p.w / 2), Math.floor(p.h / 2));
  });
}
