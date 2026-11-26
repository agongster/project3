/**
 * The hero's look: old saves keep their hero pixel for pixel, every index
 * is clamped, random looks are repeatable (and villagers keep their names),
 * and the sprite cache key tells every field apart.
 */
import { describe, expect, it } from "vitest";
import { cachedBounded, composeCharacter, LOOK_FIELDS, lookKey } from "@/game/art/character";
import { randomLook, SURPRISE_ODDS } from "@/game/art/characterRandom";
import { LEGACY_ACCESSORIES } from "@/lib/game/catalog";
import { LOOK_OPTION_COUNTS, defaultSave, sanitizeLook, sanitizeSave } from "@/lib/game/store";
import type { CharacterLook } from "@/lib/types";

/** FNV-1a over bytes: a short fingerprint of a picture. */
function fingerprint(bytes: ArrayLike<number>): number {
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 16777619) >>> 0;
  return hash;
}

/** One fingerprint for all 9 frames (3 views × 3 steps) of a look. */
function sheetFingerprint(look: CharacterLook, hat: string | null): number {
  const frames: number[] = [];
  for (const view of ["down", "up", "side"] as const) for (let step = 0; step < 3; step++) frames.push(fingerprint(composeCharacter(look, hat, view, step).data));
  return fingerprint(new Uint8Array(Uint32Array.from(frames).buffer));
}

/**
 * Looks as saved before round four (with the old single `accessory`), and the
 * fingerprint the generator of that time drew for them.
 */
const OLD_LOOKS: [Record<string, unknown>, string | null, number][] = [
  [{ name: "Hero", skin: 1, hairStyle: 0, hairColor: 1, outfit: 1, outfitColor: 5, eyes: 1, accessory: 2 }, null, 600961854],
  [{ name: "Ada", skin: 0, hairStyle: 2, hairColor: 6, outfit: 3, outfitColor: 9, eyes: 0, accessory: 1 }, "flowerCrown", 1077860074],
  [{ name: "Bo", skin: 5, hairStyle: 4, hairColor: 3, outfit: 2, outfitColor: 10, eyes: 2, accessory: 3 }, "wizardHat", 4059517996],
  [{ name: "Cy", skin: 3, hairStyle: 6, hairColor: 8, outfit: 4, outfitColor: 6, eyes: 1, accessory: 0 }, "catEars", 1458347579],
  [{ name: "Di", skin: 2, hairStyle: 7, hairColor: 11, outfit: 0, outfitColor: 0, eyes: 0, accessory: 1 }, "halo", 13825786],
  [{ name: "Ed", skin: 4, hairStyle: 5, hairColor: 2, outfit: 1, outfitColor: 9, eyes: 2, accessory: 2 }, "snakeHood", 1881934587],
  [{ name: "Fi", skin: 1, hairStyle: 3, hairColor: 10, outfit: 2, outfitColor: 4, eyes: 1, accessory: 3 }, "partyHat", 155922630],
  [{ name: "Gu", skin: 0, hairStyle: 1, hairColor: 7, outfit: 3, outfitColor: 2, eyes: 2, accessory: 0 }, "topHat", 3354576938],
];

/** What randomLook(i * 37 + 1) was named before round four, for i = 0..23. */
const OLD_VILLAGER_NAMES = ["Mora", "Wrenlo", "Fenra", "Prusy", "Rue", "Fen", "Rue", "Nell", "Bixkin", "Nellkin", "Kipna", "Ruera", "Piplo", "Zed", "Solna", "Tam", "Kiplo", "Rue", "Kiplo", "Wrensy", "Pippy", "Junokin", "Boble", "Bosy"];

describe("old saves", () => {
  it.each(OLD_LOOKS)("%o with hat %s is drawn exactly as before", (oldLook, hat, expected) => {
    expect(sheetFingerprint(sanitizeLook(oldLook), hat)).toBe(expected);
  });

  it("turns the old accessory into a face detail and eyewear, the rest into the classic options", () => {
    const names = ["None", "Glasses", "Blush", "Freckles"];
    names.forEach((_, accessory) => {
      const look = sanitizeLook({ name: "Old", skin: 1, hairStyle: 0, hairColor: 1, outfit: 1, outfitColor: 5, eyes: 1, accessory });
      expect({ faceDetail: look.faceDetail, eyewear: look.eyewear }).toEqual(LEGACY_ACCESSORIES[accessory]);
      expect(look).toMatchObject({ outfitColor2: 0, eyeColor: 0, mouth: 0, facialHair: 0, backItem: 0 });
      expect(look).not.toHaveProperty("accessory");
    });
  });

  it("loads a whole old save and keeps its hero", () => {
    const save = sanitizeSave({ ...defaultSave(), look: { name: "Ada", skin: 0, hairStyle: 2, hairColor: 6, outfit: 3, outfitColor: 9, eyes: 0, accessory: 1 } });
    expect(save.look).toEqual({ name: "Ada", skin: 0, hairStyle: 2, hairColor: 6, outfit: 3, outfitColor: 9, outfitColor2: 0, eyes: 0, eyeColor: 0, mouth: 0, faceDetail: 0, eyewear: 1, facialHair: 0, backItem: 0 });
  });

  it("prefers the new fields when a look has both", () => {
    expect(sanitizeLook({ accessory: 1, eyewear: 3, faceDetail: 4 })).toMatchObject({ eyewear: 3, faceDetail: 4 });
  });
});

describe("sanitizeLook", () => {
  const fields = Object.keys(LOOK_OPTION_COUNTS) as (keyof typeof LOOK_OPTION_COUNTS)[];

  it.each(fields)("clamps %s into its option list", (field) => {
    const last = LOOK_OPTION_COUNTS[field] - 1;
    expect(sanitizeLook({ [field]: 999 })[field]).toBe(last);
    expect(sanitizeLook({ [field]: -4 })[field]).toBe(0);
    expect(sanitizeLook({ [field]: 1.9 })[field]).toBe(1);
    expect(sanitizeLook({ [field]: "big" })[field]).toBe(defaultSave().look[field]);
    expect(sanitizeLook({ [field]: Number.NaN })[field]).toBe(defaultSave().look[field]);
  });

  it("covers every picture field and bounds the name", () => {
    expect([...fields].sort()).toEqual([...LOOK_FIELDS].sort());
    expect(sanitizeLook({ name: "x".repeat(500) }).name.length).toBeLessThanOrEqual(16);
  });
});

describe("randomLook", () => {
  it("is repeatable", () => {
    expect(randomLook(42)).toEqual(randomLook(42));
    expect(randomLook(42, SURPRISE_ODDS)).toEqual(randomLook(42, SURPRISE_ODDS));
    expect(randomLook(42)).not.toEqual(randomLook(43));
  });

  it("keeps every villager's old name", () => {
    expect(OLD_VILLAGER_NAMES.map((_, i) => randomLook(i * 37 + 1).name)).toEqual(OLD_VILLAGER_NAMES);
  });

  it("makes valid looks that use every option of every field", () => {
    const seen = new Map(LOOK_FIELDS.map((field) => [field, new Set<number>()]));
    for (let seed = 0; seed < 4000; seed++) {
      const look = randomLook(seed, seed % 2 ? SURPRISE_ODDS : undefined);
      expect(sanitizeLook(look)).toEqual(look);
      for (const field of LOOK_FIELDS) seen.get(field)?.add(look[field]);
    }
    for (const field of LOOK_FIELDS) expect(seen.get(field)?.size, field).toBe(LOOK_OPTION_COUNTS[field]);
  });

  it("dresses most villagers plainly (extras are sprinkled, not piled on)", () => {
    const looks = Array.from({ length: 1000 }, (_, seed) => randomLook(seed));
    const share = (has: (look: CharacterLook) => boolean) => looks.filter(has).length / looks.length;
    expect(share((look) => look.eyewear > 0)).toBeLessThan(0.35);
    expect(share((look) => look.backItem > 0)).toBeLessThan(0.35);
    expect(share((look) => look.facialHair > 0)).toBeLessThan(0.3);
  });
});

describe("the sprite cache", () => {
  const base = randomLook(7);

  it("gives every picture field its own part of the key", () => {
    for (const field of LOOK_FIELDS) {
      expect(lookKey({ ...base, [field]: base[field] + 1 }, null), field).not.toBe(lookKey(base, null));
    }
    expect(lookKey(base, "halo")).not.toBe(lookKey(base, null));
    expect(lookKey({ ...base, name: "Someone else" }, null)).toBe(lookKey(base, null));
  });

  it("never mixes up two fields with the same values in another order", () => {
    expect(lookKey({ ...base, skin: 1, hairStyle: 11 }, null)).not.toBe(lookKey({ ...base, skin: 11, hairStyle: 1 }, null));
  });

  it("is bounded and drops the least recently used entry first", () => {
    const store = new Map<string, number>();
    const make = (value: number) => () => value;
    cachedBounded(store, "a", 2, make(1));
    cachedBounded(store, "b", 2, make(2));
    expect(cachedBounded(store, "a", 2, make(99))).toBe(1); // a hit: "a" is now the newest
    cachedBounded(store, "c", 2, make(3)); // over the limit: "b" goes
    expect([...store.keys()]).toEqual(["a", "c"]);
  });
});
