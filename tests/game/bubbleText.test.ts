/** Word-wrapping a villager's saying into a speech bubble (measured here as 5 px per character). */
import { describe, expect, it } from "vitest";
import { wrapBubbleText } from "@/game/ui/bubbleText";

const measure = (text: string) => text.length * 5;

describe("wrapBubbleText", () => {
  it("keeps short text on one line", () => {
    expect(wrapBubbleText("Hello there!", 100, 2, measure)).toEqual(["Hello there!"]);
  });

  it("breaks at spaces into lines that fit", () => {
    expect(wrapBubbleText("one two three four", 50, 2, measure)).toEqual(["one two", "three four"]);
  });

  it("ends with an ellipsis when the text needs more lines than allowed", () => {
    const lines = wrapBubbleText("one two three four five six seven", 50, 2, measure);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(50);
  });

  it("cuts a single word that is wider than the bubble", () => {
    const lines = wrapBubbleText("x".repeat(500), 50, 2, measure);
    expect(lines).toHaveLength(1);
    expect(measure(lines[0])).toBeLessThanOrEqual(50);
    expect(lines[0].endsWith("…")).toBe(true);
  });

  it("gives no lines for empty or blank text", () => {
    expect(wrapBubbleText("", 50, 2, measure)).toEqual([]);
    expect(wrapBubbleText("     ", 50, 2, measure)).toEqual([]);
  });
});
