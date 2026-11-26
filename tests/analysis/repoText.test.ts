/** The helpers every piece of repo text goes through before it is shown. */
import { describe, expect, it } from "vitest";
import { asciiOrNull, clipPath, clipWords, oneLine } from "@/lib/analysis/repoText";

describe("oneLine", () => {
  it("removes control and invisible characters and collapses whitespace", () => {
    expect(oneLine("  a\tb\n\nc\u0000d\u200Be \u2028 f  ")).toBe("a b c d e f");
  });
});

describe("clipWords", () => {
  it("leaves short text alone", () => {
    expect(clipWords("short", 10)).toBe("short");
  });

  it("cuts at a space and adds an ellipsis", () => {
    expect(clipWords("one two three four five", 12)).toBe("one two…");
  });

  it("cuts inside a word when there is no good space", () => {
    expect(clipWords("x".repeat(500), 8)).toBe("xxxxxxx…");
  });

  it("counts emoji as one character and never splits one", () => {
    const clipped = clipWords("🍰".repeat(20), 5);
    expect(clipped).toBe("🍰🍰🍰🍰…");
  });
});

describe("clipPath", () => {
  it("keeps the end of a long path", () => {
    expect(clipPath("a/very/deeply/nested/folder/structure/train.py", 20)).toBe("…/structure/train.py");
    expect(clipPath("train.py", 20)).toBe("train.py");
  });
});

describe("asciiOrNull", () => {
  it("swaps typographic punctuation for ASCII look-alikes", () => {
    expect(asciiOrNull("Don’t “panic” — it’s fine…")).toBe(`Don't "panic" - it's fine...`);
  });

  it("refuses text the bitmap font cannot draw", () => {
    expect(asciiOrNull("café")).toBeNull();
    expect(asciiOrNull("🍰 cake")).toBeNull();
    expect(asciiOrNull("蛋糕")).toBeNull();
  });
});
