import { describe, expect, it } from "vitest";
import { FONT_CAP_HEIGHT, measureText } from "@/game/art/font";
import { GLYPHS } from "@/game/art/fontGlyphs";

/** Rows of ink a glyph definition draws, with its starting row ("2:...") applied. */
function inkRows(def: string): string[] {
  const colon = def.indexOf(":");
  const top = colon > 0 ? Number(def.slice(0, colon)) : 0;
  const rows = (colon > 0 ? def.slice(colon + 1) : def).split("/");
  return [...Array(top).fill(""), ...rows];
}

/** Characters that are easy to mix up in code, file names and numbers. */
const LOOK_ALIKES = ["0O", "1lI|", "2Z", "5S", "6b", "8B", "9gq", "co", "ij", "ae"];

describe("bitmap font", () => {
  it("draws every glyph from '#' and '.' only, in rows of one width", () => {
    for (const [ch, def] of Object.entries(GLYPHS)) {
      const rows = inkRows(def).filter((row) => row !== "");
      expect(rows.every((row) => /^[#.]+$/.test(row)), `glyph ${JSON.stringify(ch)}`).toBe(true);
      expect(new Set(rows.map((row) => row.length)).size, `glyph ${JSON.stringify(ch)}`).toBe(1);
    }
  });

  it("keeps capitals and digits exactly cap height", () => {
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") expect(inkRows(GLYPHS[ch]).length, ch).toBe(FONT_CAP_HEIGHT);
  });

  it("draws look-alike characters differently", () => {
    for (const group of LOOK_ALIKES) {
      const shapes = [...group].map((ch) => inkRows(GLYPHS[ch]).join("/"));
      expect(new Set(shapes).size, group).toBe(group.length);
    }
  });

  it("measures text as glyph widths plus one column between letters", () => {
    // "l" is 2 px (stem + foot), "|" is 1 px: 2 + 1 + 1 = 4.
    expect(measureText("l|")).toBe(4);
    expect(measureText("l|", 3)).toBe(12);
    expect(measureText("ab\nl")).toBe(measureText("ab"));
  });
});
