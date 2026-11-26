/**
 * The hero creator's pure parts: sections and their choices, the shuffle,
 * presets, keyboard navigation and the undo history.
 */
import { describe, expect, it } from "vitest";
import { LOOK_FIELDS, secondColor } from "@/game/art";
import { PRESETS, optionIndex, presetLook } from "@/components/character/lookPresets";
import { choicesFor, groupLabel, SECTIONS, sectionFields, shuffleSection, surpriseLook } from "@/components/character/lookSections";
import { nextPosition } from "@/components/character/SwatchGrid";
import { MAX_UNDO_STEPS, pushBounded, sameSnapshot } from "@/components/character/useLookHistory";
import { EYE_STYLE_ORDER, HAIR_COLOR_ORDER, HAIR_STYLE_ORDER, HAIR_STYLES, OUTFIT_COLOR_ORDER, OUTFIT_ORDER, SKIN_TONE_ORDER } from "@/lib/game/catalog";
import { LOOK_OPTION_COUNTS, defaultSave, sanitizeLook } from "@/lib/game/store";

const look = defaultSave().look;

describe("sections", () => {
  it("offer every look field exactly once", () => {
    const fields = SECTIONS.flatMap((section) => section.groups.map((group) => group.field));
    expect([...fields].sort()).toEqual([...LOOK_FIELDS].sort());
    expect(SECTIONS.filter((section) => section.hats)).toHaveLength(1);
  });

  it.each(LOOK_FIELDS)("list every option of %s exactly once", (field) => {
    const values = choicesFor(field, look).map((choice) => choice.value);
    expect([...values].sort((a, b) => a - b)).toEqual(Array.from({ length: LOOK_OPTION_COUNTS[field] }, (_, i) => i));
  });

  it("use display orders that hold every index once", () => {
    const orders = [SKIN_TONE_ORDER, HAIR_STYLE_ORDER, HAIR_COLOR_ORDER, OUTFIT_ORDER, OUTFIT_COLOR_ORDER, EYE_STYLE_ORDER];
    for (const order of orders) expect([...order].sort((a, b) => a - b)).toEqual(order.map((_, i) => i));
  });

  it("show Classic first in the colour it gives the current outfit", () => {
    const [classic] = choicesFor("outfitColor2", look);
    expect(classic).toEqual({ value: 0, name: "Classic", color: secondColor({ ...look, outfitColor2: 0 }) });
  });

  it("call the hair colour a scarf colour for a head covering", () => {
    const hairColor = SECTIONS.flatMap((section) => section.groups).find((group) => group.field === "hairColor")!;
    expect(groupLabel(hairColor, look)).toBe("Hair colour");
    expect(groupLabel(hairColor, { ...look, hairStyle: HAIR_STYLES.indexOf("Hijab") })).toBe("Scarf colour");
  });
});

describe("shuffle and surprise", () => {
  it.each(SECTIONS.map((section) => section.id))("shuffle %s changes only that section's fields, repeatably", (id) => {
    const patch = shuffleSection(id, 1234);
    expect(Object.keys(patch).sort()).toEqual([...sectionFields(id)].sort());
    expect(shuffleSection(id, 1234)).toEqual(patch);
    const next = { ...look, ...patch };
    expect(sanitizeLook(next)).toEqual(next);
  });

  it("surprise keeps the player's name", () => {
    expect(surpriseLook({ ...look, name: "Ada" }, 5).name).toBe("Ada");
  });
});

describe("presets", () => {
  it("are valid looks with unique titles", () => {
    expect(new Set(PRESETS.map((preset) => preset.title)).size).toBe(PRESETS.length);
    for (const preset of PRESETS) {
      const made = presetLook(preset, "Ada");
      expect(sanitizeLook(made)).toEqual(made);
      expect(made.name).toBe("Ada");
    }
  });

  it("reject an unknown option name", () => {
    expect(() => optionIndex(HAIR_STYLES, "Mullet")).toThrow(/Mullet/);
  });
});

describe("keyboard and undo", () => {
  it("moves through swatches with arrows (wrapping), Home and End", () => {
    expect(nextPosition("ArrowRight", 0, 5)).toBe(1);
    expect(nextPosition("ArrowDown", 4, 5)).toBe(0);
    expect(nextPosition("ArrowLeft", 0, 5)).toBe(4);
    expect(nextPosition("ArrowUp", 2, 5)).toBe(1);
    expect(nextPosition("Home", 3, 5)).toBe(0);
    expect(nextPosition("End", 0, 5)).toBe(4);
    expect(nextPosition("Enter", 0, 5)).toBeNull();
    expect(nextPosition("ArrowRight", 0, 0)).toBeNull();
  });

  it("keeps only the newest undo steps", () => {
    let list: number[] = [];
    for (let i = 0; i < MAX_UNDO_STEPS + 5; i++) list = pushBounded(list, i, MAX_UNDO_STEPS);
    expect(list).toHaveLength(MAX_UNDO_STEPS);
    expect(list.at(-1)).toBe(MAX_UNDO_STEPS + 4);
  });

  it("knows when a change changes nothing", () => {
    expect(sameSnapshot({ look, hatId: null }, { look: { ...look }, hatId: null })).toBe(true);
    expect(sameSnapshot({ look, hatId: null }, { look, hatId: "halo" })).toBe(false);
    expect(sameSnapshot({ look, hatId: null }, { look: { ...look, mouth: 2 }, hatId: null })).toBe(false);
  });
});
