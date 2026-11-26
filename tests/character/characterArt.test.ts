/**
 * Every option in the catalog has pixel art, and every combination that
 * matters is drawn without a typo in its grids (an unknown grid letter is
 * painted magenta, so a magenta pixel means a broken part).
 */
import { describe, expect, it } from "vitest";
import { composeCharacter, LOOK_FIELDS, SWATCH_CROPS, CHAR_H } from "@/game/art/character";
import { BACK_ART } from "@/game/art/characterBack";
import { EYE_ART, EYEWEAR_ART, FACE_DETAIL_ART, FACIAL_HAIR_ART, MOUTH_ART } from "@/game/art/characterFace";
import { HAIR } from "@/game/art/characterHair";
import { HAT_ART } from "@/game/art/characterHats";
import { OUTFIT_PARTS, OUTFIT_STYLES } from "@/game/art/characterOutfits";
import type { Pix } from "@/game/art/engine";
import { BACK_ITEMS, EYE_STYLES, EYEWEAR, FACE_DETAILS, FACIAL_HAIR, HAIR_STYLES, HATS, MOUTHS, OUTFITS } from "@/lib/game/catalog";
import { LOOK_OPTION_COUNTS, defaultSave } from "@/lib/game/store";
import type { CharacterLook } from "@/lib/types";

const VIEWS = ["down", "up", "side"] as const;
const look = defaultSave().look;

function magentaPixels(pix: Pix): number {
  let count = 0;
  for (let i = 0; i < pix.data.length; i += 4) if (pix.data[i + 3] && pix.data[i] === 255 && pix.data[i + 1] === 0 && pix.data[i + 2] === 255) count++;
  return count;
}

function expectClean(test: CharacterLook, hat: string | null, label: string): void {
  for (const view of VIEWS) for (let step = 0; step < 3; step++) expect(magentaPixels(composeCharacter(test, hat, view, step)), `${label} ${view} ${step}`).toBe(0);
}

describe("every option has art", () => {
  it("hair styles and outfits", () => {
    for (const style of HAIR_STYLES) expect(HAIR[style], style).toBeDefined();
    for (const outfit of OUTFITS) {
      expect(OUTFIT_PARTS[outfit], outfit).toBeDefined();
      expect(OUTFIT_STYLES[outfit], outfit).toBeDefined();
    }
  });

  it("faces, from the front and the side", () => {
    for (const view of ["down", "side"] as const) {
      for (const name of EYE_STYLES) expect(EYE_ART[view][name], name).toBeDefined();
      for (const name of MOUTHS) expect(MOUTH_ART[view][name], name).toBeDefined();
      for (const name of FACE_DETAILS.slice(1)) expect(FACE_DETAIL_ART[view][name], name).toBeDefined();
      for (const name of FACIAL_HAIR.slice(1)) expect(FACIAL_HAIR_ART[view][name], name).toBeDefined();
    }
    for (const name of EYEWEAR.slice(1)) expect(EYEWEAR_ART[name], name).toBeDefined();
  });

  it("back items and hats", () => {
    for (const name of BACK_ITEMS.slice(1)) expect(BACK_ART[name], name).toBeDefined();
    for (const hat of HATS) expect(HAT_ART[hat.id], hat.id).toBeDefined();
  });
});

describe("drawing", () => {
  it.each(LOOK_FIELDS)("every option of %s draws cleanly in every view and step", (field) => {
    for (let value = 0; value < LOOK_OPTION_COUNTS[field]; value++) expectClean({ ...look, [field]: value }, null, `${field}=${value}`);
  });

  it("every hat draws cleanly on every hair style", () => {
    for (let hairStyle = 0; hairStyle < HAIR_STYLES.length; hairStyle++) {
      for (const hat of HATS) expectClean({ ...look, hairStyle }, hat.id, `${HAIR_STYLES[hairStyle]} + ${hat.id}`);
    }
  });

  it("swatch crops stay inside the frame", () => {
    for (const [top, bottom] of Object.values(SWATCH_CROPS)) {
      expect(top).toBeGreaterThanOrEqual(0);
      expect(bottom).toBeLessThanOrEqual(CHAR_H);
      expect(bottom).toBeGreaterThan(top);
    }
  });
});
