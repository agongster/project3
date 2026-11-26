/**
 * Names read out of untrusted Ruff messages and source lines for monster
 * traits: the right name when it is there, a sensible fallback when it is
 * not, and never anything the bitmap font or a layout can't take.
 */
import { describe, expect, it } from "vitest";
import {
  backtickNames,
  clipName,
  firstName,
  firstNumber,
  grownDefault,
  MAX_NOTE_CHARS,
  MAX_TRAIT_NAME_CHARS,
  mutableDefault,
  noteText,
  quotedNames,
  secretTag,
  UNKNOWN_NAME,
  undefinedName,
  unusedTag,
} from "@/lib/analysis/traitNames";
import type { SnippetLine } from "@/lib/types";

const hit = (text: string): SnippetLine[] => [
  { n: 1, text: "# before", hit: false },
  { n: 2, text, hit: true },
];
const msg = (message: string) => ({ message });

describe("clipName", () => {
  it("keeps short ASCII names as they are", () => {
    expect(clipName("cauldron")).toBe("cauldron");
    expect(clipName("")).toBe("");
  });

  it("collapses whitespace and swaps anything outside printable ASCII for ?", () => {
    expect(clipName("  a\tb\nc  ")).toBe("a b c");
    expect(clipName("café🍰")).toBe("caf??");
  });

  it("clips long names to the maximum, ending in …", () => {
    const clipped = clipName("x".repeat(500));
    expect(Array.from(clipped)).toHaveLength(MAX_TRAIT_NAME_CHARS);
    expect(clipped.endsWith("…")).toBe(true);
    expect(clipName("abcdefgh", 4)).toBe("abc…");
  });
});

describe("quoted names", () => {
  it("finds backtick- and double-quoted parts in order, skipping empty ones", () => {
    expect(backtickNames("Undefined name `foo` in `__all__`")).toEqual(["foo", "__all__"]);
    expect(backtickNames("`a` and ` ` then `x`")).toEqual(["a", "x"]);
    expect(quotedNames('Possible hardcoded password assigned to: "ADMIN_PASSWORD"')).toEqual(["ADMIN_PASSWORD"]);
  });

  it("firstName prefers backticks, then double quotes, else null", () => {
    expect(firstName(msg('`a` and "b"'))).toBe("a");
    expect(firstName(msg('only "b"'))).toBe("b");
    expect(firstName(msg("nothing quoted"))).toBeNull();
    expect(firstName(msg("`\u0000`"))).toBeNull(); // nothing visible left
    expect(firstName(msg("`🐍`"))).toBe("?");
  });
});

describe("undefinedName (the Phantom's rune)", () => {
  it("reads the name Ruff quotes", () => {
    expect(undefinedName(msg("Undefined name `cauldron`"))).toBe("cauldron");
    expect(undefinedName(msg("Local variable `total` referenced before assignment"))).toBe("total");
  });

  it("falls back to ??? when the message names nothing", () => {
    expect(undefinedName(msg("Undefined name"))).toBe(UNKNOWN_NAME);
  });

  it("clips a hostile name", () => {
    expect(Array.from(undefinedName(msg(`Undefined name \`${"🐍".repeat(99)}\``)))).toHaveLength(MAX_TRAIT_NAME_CHARS);
  });
});

describe("unusedTag (what a Dust Bunny leaves behind)", () => {
  const tag = (code: string, message: string, line = "") => unusedTag({ code, message, snippet: line ? hit(line) : [] });

  it("writes the unused thing like the line nobody used", () => {
    expect(tag("F401", "`os` imported but unused", "import os")).toBe("import os");
    expect(tag("F401", "`typing.List` imported but unused", "from typing import List")).toBe("from typing import List");
    expect(tag("F401", "`os.path` imported but unused", "import os.path")).toBe("import os.path");
    expect(tag("F841", "Local variable `leftovers` is assigned to but never used")).toBe("leftovers = …");
    expect(tag("F842", "Local variable `x` is annotated but never used")).toBe("x: …");
    expect(tag("B007", "Loop control variable `i` not used within loop body")).toBe("for i in …");
  });

  it("is null when the message names nothing, and clipped when the name is huge", () => {
    expect(tag("F401", "imported but unused")).toBeNull();
    expect(Array.from(tag("F841", `Local variable \`${"v".repeat(300)}\` is assigned`)!).length).toBeLessThanOrEqual(MAX_TRAIT_NAME_CHARS + 4);
  });
});

describe("secretTag (what a Key Thief drops)", () => {
  it("names the variable that held the secret, or falls back to password", () => {
    expect(secretTag(msg('Possible hardcoded password assigned to: "ADMIN_PASSWORD"'))).toBe('ADMIN_PASSWORD = "…"');
    expect(secretTag(msg("Possible hardcoded password"))).toBe('password = "…"');
  });
});

describe("noteText (what a Todo Mite squeaks)", () => {
  const note = (line: string) => noteText({ title: "TODO comment", snippet: hit(line) });

  it("starts at the TODO / FIXME word", () => {
    expect(note("# TODO: ask Granny Marzipan")).toBe("TODO: ask Granny Marzipan");
    expect(note("x = 1  # fixme later")).toBe("fixme later");
  });

  it("shows commented-out code without its #", () => {
    expect(note('    # scaled["sugar"] = 2')).toBe('scaled["sugar"] = 2');
  });

  it("clips long notes and falls back to the title when the line is empty", () => {
    expect(Array.from(note(`# TODO ${"word ".repeat(50)}`))).toHaveLength(MAX_NOTE_CHARS);
    expect(noteText({ title: "TODO comment", snippet: [] })).toBe("TODO comment");
  });
});

describe("mutable defaults (the growing monster)", () => {
  it("reads the parameter and what kind of container it defaults to", () => {
    expect(mutableDefault({ snippet: hit("def add_to_basket(item, basket=[]):") })).toEqual({ name: "basket", opener: "[" });
    expect(mutableDefault({ snippet: hit("def f(cache: dict = {}):") })).toEqual({ name: "cache", opener: "{" });
    expect(mutableDefault({ snippet: hit("def f(seen=set()):") })).toEqual({ name: "seen", opener: "{" });
    expect(mutableDefault({ snippet: [] })).toEqual({ name: "default", opener: "[" });
  });

  it("shows what the default holds after each call, at most three items", () => {
    expect(grownDefault("basket", "[", 0)).toBe("basket=[]");
    expect(grownDefault("basket", "[", 2)).toBe("basket=[1, 1]");
    expect(grownDefault("basket", "[", 6)).toBe("basket=[1, 1, 1, …]");
    expect(grownDefault("cache", "{", 2)).toBe("cache={0: 0, 1: 1}");
  });
});

describe("firstNumber", () => {
  it("reads the first whole number of a message", () => {
    expect(firstNumber("Too many arguments in function definition (9 > 8)")).toBe(9);
    expect(firstNumber("no numbers")).toBeNull();
  });
});
