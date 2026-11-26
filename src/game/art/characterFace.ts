/**
 * Everything drawn on the face, per view ("up" shows the back of the head,
 * so it has no face). The head is 12 px wide (x 2..13, rows 1..11); seen
 * from the front the eyes sit around x 4 and x 11 on rows 5–7, the mouth on
 * row 9. Side views face left, so the face is at the left edge (x 2..5).
 *
 * The first option of every list reproduces the art heroes had before the
 * option existed (Dot/Sparkle/Sleepy eyes in the dark eye colour, the small
 * smile, the old Glasses/Blush/Freckles), so old saves look the same.
 */
import type { Part } from "./characterParts";

type FaceView = "down" | "side";
type FaceSet = Record<FaceView, Record<string, Part>>;

/** Eyes: `e` is the dark lash line, `i` the iris (the eye colour), `E` a shine. */
export const EYE_ART: FaceSet = {
  down: {
    Dot: { y: 6, rows: ["....e......e....", "....i......i...."] },
    Sparkle: { y: 5, rows: ["....ee....ee....", "....Ei....Ei....", "....ii....ii...."] },
    Sleepy: { y: 6, rows: ["...S........S...", "....ei....ie...."] },
    Happy: { y: 6, rows: ["....e......e....", "...e.e....e.e..."] },
    Wide: { y: 5, rows: ["....ee....ee....", "....Ei....Ei....", "....ii....ii....", "....iE....iE...."] },
    Wink: { y: 5, rows: ["....ee..........", "....Ei.....e....", "....ii....e.e..."] },
    Lashes: { y: 5, rows: ["....ee....ee....", "...eEi....Eie...", "....ii....ii...."] },
    Fierce: { y: 6, rows: ["...ee......ee...", "....ei....ie...."] },
  },
  side: {
    Dot: { y: 6, rows: ["...e............", "...i............"] },
    Sparkle: { y: 5, rows: ["..ee............", "..Ei............", "..ii............"] },
    Sleepy: { y: 6, rows: ["..S.............", "..ei............"] },
    Happy: { y: 6, rows: ["...e............", "..e.e..........."] },
    Wide: { y: 5, rows: ["..ee............", "..Ei............", "..ii............", "..iE............"] },
    Wink: { y: 5, rows: ["..ee............", "..Ei............", "..ii............"] },
    Lashes: { y: 5, rows: ["..ee............", "..Eie...........", "..ii............"] },
    Fierce: { y: 6, rows: ["..ee............", "...i............"] },
  },
};

/** Mouths: `m` lips, `M` the inside of an open mouth, `T` a tongue. */
export const MOUTH_ART: FaceSet = {
  down: {
    Smile: { y: 9, rows: [".......mm......."] },
    Grin: { y: 9, rows: ["......m..m......", ".......mm......."] },
    Open: { y: 9, rows: [".......MM.......", ".......MM......."] },
    Smirk: { y: 8, rows: [".........m......", ".......mm......."] },
    Tongue: { y: 9, rows: [".......mm.......", "........T......."] },
    Flat: { y: 9, rows: ["......MMMM......"] },
  },
  side: {
    Smile: { y: 9, rows: ["...m............"] },
    Grin: { y: 9, rows: ["..m.m...........", "...m............"] },
    Open: { y: 9, rows: ["..MM............", "..MM............"] },
    Smirk: { y: 8, rows: ["...m............", "..mm............"] },
    Tongue: { y: 9, rows: ["...m............", "..T............."] },
    Flat: { y: 9, rows: ["..MMM..........."] },
  },
};

/** Marks on the skin: blush, freckles, beauty mark, scar, face paint, bandage. */
export const FACE_DETAIL_ART: FaceSet = {
  down: {
    Blush: { y: 8, rows: ["..nn........nn.."] },
    Freckles: { y: 8, rows: ["...f.f....f.f...", "....f......f...."] },
    "Beauty mark": { y: 9, rows: ["..........d....."] },
    Scar: { y: 7, rows: ["............j...", "...........j....", "..........j....."] },
    "Face paint": { y: 8, rows: ["...qqqqqqqqqq..."] },
    Bandage: { y: 8, rows: ["..........LlL...", "..........LlL..."] },
  },
  side: {
    Blush: { y: 8, rows: ["...nn..........."] },
    Freckles: { y: 8, rows: ["...f.f..........", "....f..........."] },
    "Beauty mark": { y: 9, rows: [".....d.........."] },
    Scar: { y: 7, rows: [".....j..........", "....j...........", "...j............"] },
    "Face paint": { y: 8, rows: ["..qqqq.........."] },
    Bandage: { y: 8, rows: ["...LlL..........", "...LlL.........."] },
  },
};

/** Facial hair, in the hair colour. */
export const FACIAL_HAIR_ART: FaceSet = {
  down: {
    Mustache: { y: 8, rows: [".....rrrrrr.....", ".....R....R....."] },
    Goatee: { y: 10, rows: [".......rr.......", ".......rR.......", ".......RR......."] },
    "Short beard": { y: 8, rows: ["..r.........r...", "..r.........r...", "..rrr.....rrr...", "...rrrRRrrrr....", ".....RRRR......."] },
    Beard: { y: 8, rows: ["..r..rrrrrr..r..", "..rr.R....R.rr..", "..rrrr....rrrr..", "...rrrrrrrrrr...", ".....RrrrrR....."] },
  },
  side: {
    Mustache: { y: 8, rows: ["..rrr...........", "..R............."] },
    Goatee: { y: 10, rows: ["..rr............", "..rR............", "...R............"] },
    "Short beard": { y: 8, rows: ["........r.......", "........r.......", "..r....rr.......", "..rrrrrrR.......", "...RRRR........."] },
    Beard: { y: 8, rows: ["..rr....r.......", "..R.....rr......", "..rrrrrrrr......", "...rrrrrrR......", "....RrrR........"] },
  },
};

/** Glasses and friends sit over everything else on the face, with their own colours. */
export interface EyewearArt {
  down: Part;
  side: Part;
  pal: Record<string, string>;
}

export const EYEWEAR_ART: Record<string, EyewearArt> = {
  Glasses: {
    pal: { k: "#3a3048" },
    down: { y: 5, rows: ["...kkkk..kkkk...", "...k..kkkk..k...", "...k..k..k..k...", "...kkkk..kkkk..."] },
    side: { y: 5, rows: ["..kkkk..........", "kkk..kkkkk......", "..k..k..........", "..kkkk.........."] },
  },
  "Round specs": {
    pal: { g: "#e2b04a" },
    down: { y: 5, rows: ["....gg....gg....", "...g..gggg..g...", "...g..g..g..g...", "....gg....gg...."] },
    side: { y: 5, rows: ["...gg...........", "gg...gggggg.....", "..g..g..........", "...gg..........."] },
  },
  Shades: {
    pal: { k: "#2a2438", K: "#3b3458", Q: "#9a94d8" },
    down: { y: 5, rows: ["...kkkk..kkkk...", "...KQKKkkKQKK...", "...KKKK..KKKK...", "....KK....KK...."] },
    side: { y: 5, rows: ["..kkkk..........", "kkKQKKkkkk......", "..KKKK..........", "...KK..........."] },
  },
  "Eye patch": {
    pal: { k: "#2a2438", K: "#3f3652" },
    down: { y: 3, rows: [".......k........", "........k.......", ".........kkkk...", ".........KKKK...", ".........KKKK...", "..........KK...."] },
    side: { y: 4, rows: ["..kkkkkkkkk.....", "..KKK...........", "..KKK...........", "...K............"] },
  },
  Monocle: {
    pal: { g: "#e2b04a", G: "#a87a2a" },
    down: { y: 5, rows: ["..........gg....", ".........g..g...", ".........g..g...", "..........gg....", "............G...", "............G..."] },
    side: { y: 5, rows: ["..gg............", ".g..g...........", ".g..g...........", "..gg............", "....G...........", "....G..........."] },
  },
};
