/**
 * The demo kingdom's village speaks the demo code's own words: villagers
 * named after its classes and functions, quoting its comments with an
 * attribution, and a guide who greets the player with the demo README.
 */
import { describe, expect, it } from "vitest";
import { analyzeDemoSources } from "@/lib/analysis/demo";
import { generateOverworld, overworldProblems } from "@/lib/worldgen";
import { ATTRIBUTION_SEPARATOR, MAX_BUBBLE_LENGTH } from "@/lib/worldgen/repoWords";
import { createNodeLint } from "../analysis/nodeLint";

const analysis = analyzeDemoSources(createNodeLint());
const world = generateOverworld(analysis);

describe("the demo village", () => {
  it("is a valid world", () => {
    expect(overworldProblems(world, analysis)).toEqual([]);
  });

  it("greets the player with the demo README", () => {
    expect(analysis.readme).toMatch(/^The friendliest bakery-and-potion shop in the kingdom/);
    const guide = world.npcs[0];
    expect(guide.lines[0]).toBe(`Welcome to demo-kingdom! ${analysis.readme}`);
    expect(guide.lines.at(-1)).toBe("Press Space to swing, Shift to dash!");
  });

  it("names villagers after the demo's own classes and functions", () => {
    const definitionNames = new Set(analysis.files.flatMap((f) => f.outline.definitions.map((d) => d.name)));
    const fromCode = world.npcs.filter((n) => [...definitionNames].some((d) => d.replace(/_/g, " ").toLowerCase().endsWith(n.name.toLowerCase())));
    expect(fromCode.length).toBeGreaterThanOrEqual(3);
  });

  it("quotes real comments and docstrings, with where they come from", () => {
    const quotes = world.npcs.flatMap((n) => n.lines).filter((line) => line.includes(ATTRIBUTION_SEPARATOR));
    expect(quotes.length).toBeGreaterThanOrEqual(3);
    for (const quote of quotes) expect(quote).toMatch(/^“.+”\n# from .+\.py/);
  });

  it("gives villagers short speech-bubble sayings", () => {
    const sayings = world.npcs.flatMap((n) => n.bubbles ?? []);
    expect(sayings.length).toBeGreaterThanOrEqual(world.npcs.length);
    for (const text of sayings) {
      expect(text.length).toBeLessThanOrEqual(MAX_BUBBLE_LENGTH);
      expect(text).toMatch(/^[\x20-\x7E]+$/);
    }
  });
});
