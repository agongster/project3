/**
 * Monster looks in the art module: every species × colour family × feature
 * × marking × frame is painted headless (a stub `document` whose canvases
 * keep the pixels they are given) and checked: the right size, no magenta
 * "typo" pixels, families that really differ, the classic look unchanged,
 * and the lair marks within their size limits.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MONSTERS } from "@/lib/game/catalog";
import { LOOK_FAMILIES, LOOK_FEATURES, LOOK_MARKINGS, MARKED_KINDS, PLAIN_LOOK, type MonsterLook } from "@/lib/game/monsterLooks";
import { MONSTER_KINDS, type MonsterKind } from "@/lib/types";
import type { Sprite } from "@/game/art/engine";
import { MONSTER_FRAMES, monsterSprite } from "@/game/art/monsters";
import { championCrownSprite, CROWN_FRAMES, LAIR_BANNER_FRAMES, lairBadgeSprite, lairBannerSprite, mapMarkSprite, type LairMarkKind } from "@/game/art/monstersMarks";

/** A canvas stand-in: remembers the pixels put into it, ignores everything else. */
interface FakeCanvas {
  width: number;
  height: number;
  pixels: Uint8ClampedArray | null;
  getContext(): object;
}

function fakeCanvas(): FakeCanvas {
  const canvas: FakeCanvas = {
    width: 0,
    height: 0,
    pixels: null,
    getContext: () => ({
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (img: { data: Uint8ClampedArray }) => (canvas.pixels = img.data),
      drawImage: () => {},
      fillRect: () => {},
    }),
  };
  return canvas;
}

const globals = globalThis as { document?: unknown };
const realDocument = globals.document;
beforeAll(() => {
  globals.document = { createElement: () => fakeCanvas() };
});
afterAll(() => {
  globals.document = realDocument;
});

function pixelsOf(sprite: Sprite): Uint8ClampedArray {
  const pixels = (sprite.canvas as unknown as FakeCanvas).pixels;
  if (!pixels) throw new Error("sprite was never painted");
  return pixels;
}

function hasMagenta(pixels: Uint8ClampedArray): boolean {
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i] === 255 && pixels[i + 1] === 0 && pixels[i + 2] === 255 && pixels[i + 3] > 0) return true;
  return false;
}

function samePixels(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Every look a species can be painted in (sizeStep is not painted). */
function looksOf(kind: MonsterKind): MonsterLook[] {
  const markings = MARKED_KINDS.has(kind) ? LOOK_MARKINGS.length : 1;
  const looks: MonsterLook[] = [];
  for (let family = 0; family < LOOK_FAMILIES[kind].length; family++) {
    for (let feature = 0; feature < LOOK_FEATURES[kind].length; feature++) {
      for (let marking = 0; marking < markings; marking++) looks.push({ family, feature, marking, sizeStep: 0 });
    }
  }
  return looks;
}

describe("monster looks", () => {
  for (const kind of MONSTER_KINDS) {
    it(`paints every look of the ${kind} at its size, without typo pixels`, () => {
      const size = MONSTERS[kind].size;
      for (const look of looksOf(kind)) {
        for (let frame = 0; frame < MONSTER_FRAMES[kind]; frame++) {
          for (const variant of kind === "mimic" ? (["normal", "disguised"] as const) : (["normal"] as const)) {
            const sprite = monsterSprite(kind, frame, variant, look);
            expect([sprite.w, sprite.h], `${kind} ${JSON.stringify(look)} frame ${frame}`).toEqual([size, size]);
            expect(hasMagenta(pixelsOf(sprite)), `${kind} ${JSON.stringify(look)} frame ${frame} ${variant}`).toBe(false);
          }
        }
      }
    });
  }

  it("gives every colour family of a species its own picture", () => {
    for (const kind of MONSTER_KINDS) {
      const families = LOOK_FAMILIES[kind].map((_, family) => pixelsOf(monsterSprite(kind, 0, "normal", { ...PLAIN_LOOK, family })));
      for (let a = 0; a < families.length; a++) {
        for (let b = a + 1; b < families.length; b++) expect(samePixels(families[a], families[b]), `${kind} families ${a} and ${b}`).toBe(false);
      }
    }
  });

  it("gives every feature and marking its own picture", () => {
    for (const kind of MONSTER_KINDS) {
      const features = LOOK_FEATURES[kind].map((_, feature) => pixelsOf(monsterSprite(kind, 0, "normal", { ...PLAIN_LOOK, feature })));
      for (let f = 1; f < features.length; f++) expect(samePixels(features[0], features[f]), `${kind} feature ${f}`).toBe(false);
      if (!MARKED_KINDS.has(kind)) continue;
      for (let marking = 1; marking < LOOK_MARKINGS.length; marking++) {
        const marked = pixelsOf(monsterSprite(kind, 0, "normal", { ...PLAIN_LOOK, marking }));
        expect(samePixels(features[0], marked), `${kind} marking ${marking}`).toBe(false);
      }
    }
  });

  it("paints the classic look when no look is given", () => {
    for (const kind of MONSTER_KINDS) {
      for (let frame = 0; frame < MONSTER_FRAMES[kind]; frame++) {
        expect(monsterSprite(kind, frame)).toBe(monsterSprite(kind, frame, "normal", PLAIN_LOOK));
        expect(monsterSprite(kind, frame, "normal", { ...PLAIN_LOOK, sizeStep: 1 })).toBe(monsterSprite(kind, frame));
      }
    }
  });

  it("wraps out-of-range look numbers instead of throwing", () => {
    const odd: MonsterLook[] = [
      { family: 99, feature: -3, marking: 7, sizeStep: 5 },
      { family: Number.NaN, feature: Number.POSITIVE_INFINITY, marking: -1, sizeStep: 0 },
      { family: 2.7, feature: 1.2, marking: 3.9, sizeStep: 0 },
    ];
    for (const kind of MONSTER_KINDS) {
      for (const look of odd) expect(monsterSprite(kind, 5, "flash", look).w).toBe(MONSTERS[kind].size);
    }
  });
});

describe("lair marks", () => {
  const kinds: LairMarkKind[] = ["boss", "champion"];

  it("stay within their size limits and have no typo pixels", () => {
    const check = (sprite: Sprite, maxW: number, maxH: number) => {
      expect(sprite.w).toBeLessThanOrEqual(maxW);
      expect(sprite.h).toBeLessThanOrEqual(maxH);
      expect(hasMagenta(pixelsOf(sprite))).toBe(false);
    };
    for (const kind of kinds) {
      check(lairBadgeSprite(kind), 11, 10);
      check(mapMarkSprite(kind), 7, 7);
      for (let frame = 0; frame < LAIR_BANNER_FRAMES; frame++) check(lairBannerSprite(kind, frame), 10, 16);
    }
    for (let frame = 0; frame < CROWN_FRAMES; frame++) check(championCrownSprite(frame), 9, 7);
  });

  it("anchor where the callers expect: badges and crowns at the bottom, map marks in the middle", () => {
    for (const kind of kinds) {
      const badge = lairBadgeSprite(kind);
      expect(badge.ay).toBe(badge.h);
      const mark = mapMarkSprite(kind);
      expect([mark.ax, mark.ay]).toEqual([Math.floor(mark.w / 2), Math.floor(mark.h / 2)]);
      expect(lairBannerSprite(kind, 0).ay).toBe(lairBannerSprite(kind, 0).h);
    }
    expect(championCrownSprite(0).ay).toBe(championCrownSprite(0).h);
  });

  it("tell a boss from a champion", () => {
    expect(samePixels(pixelsOf(lairBadgeSprite("boss")), pixelsOf(lairBadgeSprite("champion")))).toBe(false);
    expect(samePixels(pixelsOf(mapMarkSprite("boss")), pixelsOf(mapMarkSprite("champion")))).toBe(false);
    expect(samePixels(pixelsOf(championCrownSprite(0)), pixelsOf(championCrownSprite(1)))).toBe(false);
  });
});
