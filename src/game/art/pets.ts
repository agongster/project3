/**
 * Pets: tiny companions that follow the hero.
 *
 *   drawSprite(ctx, petSprite("pixelCat", frame), pet.x, pet.y, { flipX: pet.facingLeft });
 *
 * Each pet is about 10–12 px, drawn facing RIGHT on a 14×14 canvas,
 * anchored at the bottom-centre (7, 14). Flyers (bat, cloud, star) float a
 * few px above the anchor so a shadow can go underneath. 2 frames each
 * (a hop / flap / twinkle); advance every ~200 ms.
 */
import { cached, mod, type Palette, type Sprite } from "./engine";
import { outlined, placeBottom } from "./uiKit";

export const PET_FRAMES = 2;
const SIZE = 14;

/** Pet colours, shared with their item icons. h highlight · b body · s shade · plus accents. */
export const PET_PAL: Record<string, Palette> = {
  duckling: { h: "#fff6b8", b: "#ffe46b", s: "#f3b93a", o: "#ff8a3a", O: "#d96a2a", p: "#ffb0a0" },
  snek: { h: "#9fc0ff", b: "#5a8ae8", s: "#3a5ab8", y: "#ffe27a", Y: "#e0b040", r: "#ff5a8a", p: "#ffb3cd" },
  byteBat: { h: "#8fa0f0", b: "#5a68c0", s: "#3e4890", m: "#7a8ae0", M: "#2e3870", e: "#7dff8a", p: "#ff9ec4" },
  pixelCat: { h: "#ffd6a0", b: "#ffb36b", s: "#e8803a", c: "#fff4e6", p: "#ff8fab", e: "#2b1d34" },
  cloudPuff: { h: "#ffffff", b: "#eef2fb", s: "#c6d0ea", d: "#a4b0d6", p: "#ffb3cd", r: "#ff6b81" },
  starSprite: { h: "#fffbe0", b: "#ffe066", s: "#f3b93a", d: "#d9902a", p: "#ffb0a0", x: "#ffffff" },
};

/** Two frames per pet. Each frame: [grid, lift above the ground in px]. */
const PET_FRAMES_ART: Record<string, [string[], number][]> = {
  duckling: [
    [["...hhb....", "..hbbbb...", "..bbkbboo.", "..bbbbbO..", "b.bbbbbb..", "bbbbbbbbb.", "bpbbsbbs..", ".ssssss...", "..o...o..."], 0],
    [["...hhb....", "..hbbbb...", "..bbkbboo.", "..bbbbbO..", "b.bbbbbb..", "bbbbbbbbb.", "bsbbbbbs..", ".ssssss...", "...o.o...."], 1],
  ],
  snek: [
    [["......hhbb..", ".....hbbbbb.", ".....bwkbbbr", ".....bbbbbs.", "..hbbbbyys..", ".hbyyyyyysb.", "hbybbbbbbybs", ".sbbbbbbbbs."], 0],
    [[".....hhbb...", "....hbbbbb..", "....bwkbbbrr", "....bbbbbs..", "..hbbbbyys..", ".hbyyyyyysb.", "hbybbbbbbybs", ".sbbbbbbbbs."], 0],
  ],
  byteBat: [
    [["M..h...h..M", "mM.hb.hb.Mm", "mmMhbbbbMmm", ".mmbebbebm.", "..mbbbbbbs.", "...sbpbbs..", "....sss...."], 3],
    [["...h...h...", "...hb.hb...", "..hbbbbbb..", "M.hbebbebsM", "mMmbbbbbbmm", "mm.sbpbbsmm", "m...sss...m"], 2],
  ],
  pixelCat: [
    [["......b..b.", ".....bbbbbb", ".....bebbeb", "..b..bbpbbc", ".b...cbbbc.", ".b.sbbbbbb.", "..bsbbbbbb.", "..bsbbsbbs.", "..s.s..s.s."], 0],
    [["......b..b.", ".....bbbbbb", ".....bebbeb", ".b...bbpbbc", "b....cbbbc.", "b..sbbbbbb.", ".bbsbbbbbb.", "..bsbbsbbs.", "...s.s.s.s."], 0],
  ],
  cloudPuff: [
    [["...hhh.....", ".hhhbbhh...", "hhbbbbbbbh.", "hbbbkbbkbbh", "hbbpbbbbpbs", ".sbbbsbbbs.", "..ssdsssd..", "....r......"], 3],
    [["...hhh.....", ".hhhbbhh...", "hhbbbbbbbh.", "hbbbkbbkbbh", "hbbpbbbbpbs", ".sbbbsbbbs.", "..ssdsssd..", ".......r..."], 2],
  ],
  starSprite: [
    [[".....h.....", "....hb.....", "....hbs....", "hhhhbbbbbss", ".hbbkbkbbs.", "..bbpbpbs..", "..hbbbbbs..", ".hbbs.sbbs.", ".bs.....ss."], 3],
    [["x....h.....", "....hb.....", "....hbs...x", "hhhhbbbbbss", ".hbbkbkbbs.", "..bbbbbbs..", "..hbbbbbs..", ".hbbs.sbbs.", ".bs.....ss."], 2],
  ],
};

const store = new Map<string, Sprite>();

/** One pet frame (unknown ids get the duckling). Cached. */
export function petSprite(id: string, frame: number): Sprite {
  const known = id in PET_FRAMES_ART ? id : "duckling";
  const f = mod(frame, PET_FRAMES);
  return cached(store, `${known}:${f}`, () => {
    const [rows, lift] = PET_FRAMES_ART[known][f];
    const p = placeBottom(outlined(rows, PET_PAL[known], { after: "x" }), SIZE, SIZE, lift);
    return p.toSprite(SIZE / 2, SIZE);
  });
}
