/**
 * The repo's own words: which comments are worth quoting, how identifiers
 * become villager names, and how quotes are attributed. Hostile text
 * (enormous identifiers, punctuation-only comments, emoji, CJK, HTML) must
 * never produce an empty, broken or over-long line.
 */
import { describe, expect, it } from "vitest";
import { emptyOutline, type FileOutline } from "@/lib/analysis/outline";
import { splitAttribution } from "@/components/overlays/parts/dialogText";
import type { AnalyzedFile, Definition } from "@/lib/types";
import {
  attribution,
  bubbleText,
  codeNames,
  fileQuotes,
  isQuotable,
  looksLikeCode,
  MAX_BUBBLE_LENGTH,
  MAX_QUOTE_LENGTH,
  MAX_VILLAGER_NAME,
  quoteLine,
  readableName,
  tidyComment,
} from "@/lib/worldgen/repoWords";
import { makeFile } from "../game/helpers";

function def(name: string, kind: Definition["kind"], line: number, endLine: number, docstring: string | null = null): Definition {
  return { name, kind, line, endLine, branches: 0, docstring };
}

function fileWithOutline(path: string, outline: Partial<FileOutline>): AnalyzedFile {
  return { ...makeFile(path), outline: { ...emptyOutline(), ...outline } };
}

describe("readableName", () => {
  it("splits snake_case and CamelCase into capitalised words", () => {
    expect(readableName("OrderBook")).toBe("Order Book");
    expect(readableName("load_data")).toBe("Load Data");
    expect(readableName("HTTPServer")).toBe("HTTP Server");
    expect(readableName("Trainer.fit")).toBe("Fit");
    expect(readableName("_private_helper")).toBe("Private Helper");
    expect(readableName("test_bake")).toBe("Bake");
  });

  it("refuses names that would not make a good villager", () => {
    expect(readableName("__init__")).toBeNull();
    expect(readableName("Cauldron.__init__")).toBeNull();
    expect(readableName("f")).toBeNull();
    expect(readableName("_")).toBeNull();
    expect(readableName("x".repeat(500))).toBeNull();
    expect(readableName("a_very_long_function_name_indeed")).toBeNull();
    expect(readableName("données")).toBeNull();
    expect(readableName("")).toBeNull();
  });

  it(`never returns a name longer than ${MAX_VILLAGER_NAME} characters`, () => {
    for (const id of ["GPTConfig", "CausalSelfAttention", "get_batch", "estimate_mfu", "configure_optimizers"]) {
      const name = readableName(id);
      if (name !== null) expect(name.length).toBeLessThanOrEqual(MAX_VILLAGER_NAME);
    }
  });
});

describe("looksLikeCode / isQuotable", () => {
  it("spots commented-out code", () => {
    for (const code of ["import os", "from torch import nn", "def forward(self, x):", "x = 1", 'scaled["sugar"] = scaled["sugar"] * 2', "n += 1", "print(loss)", "return foo(bar)", "if x == 3:", "self.cache", "model.eval()"]) {
      expect(looksLikeCode(code)).toBe(true);
    }
  });

  it("keeps ordinary prose, including docstrings that start with Return or If", () => {
    for (const prose of ["Return the price of one pastry (in coins).", "If the cache is empty we rebuild it from disk", "TODO: ask Granny for her cinnamon roll recipe."]) {
      expect(looksLikeCode(prose)).toBe(false);
      expect(isQuotable(prose)).toBe(true);
    }
  });

  it("skips licence boilerplate, links, punctuation and noise", () => {
    for (const noise of [
      "Copyright (c) 2023 Somebody. All rights reserved.",
      "Licensed under the Apache License, Version 2.0",
      "SPDX-License-Identifier: MIT",
      "see https://example.com/docs for details",
      "!!!!!!!!!!!!!!!!!!!!!!!!!!",
      "-----------------------------",
      "ok",
      "",
    ]) {
      expect(isQuotable(tidyComment(noise))).toBe(false);
    }
  });

  it("quotes CJK and emoji comments in dialogs", () => {
    expect(isQuotable("这是训练循环的核心部分")).toBe(true);
    expect(isQuotable("🍰 bake the cake until golden 🍰")).toBe(true);
  });
});

describe("fileQuotes and attributions", () => {
  const file = fileWithOutline("bakery/oven.py", {
    moduleDocstring: "The royal oven: turns raw dough into golden pastries.",
    definitions: [def("bake", "function", 10, 14, "Bake a pastry for a few more minutes."), def("Pastry", "class", 3, 8, null)],
    comments: [
      { line: 12, text: "Never bake for negative time; the oven is not a time machine." },
      { line: 13, text: "pastry.minutes += 1" },
      { line: 20, text: "Copyright 2024 The Bakers" },
    ],
  });

  it("collects the module docstring, docstrings and prose comments in line order, without code or boilerplate", () => {
    expect(fileQuotes(file).map((q) => q.text)).toEqual([
      "The royal oven: turns raw dough into golden pastries.",
      "Bake a pastry for a few more minutes.",
      "Never bake for negative time; the oven is not a time machine.",
    ]);
  });

  it("attributes comments by line and docstrings by their definition", () => {
    const [top, docstring, comment] = fileQuotes(file);
    expect(attribution(top)).toBe("# from the top of bakery/oven.py");
    expect(attribution(docstring)).toBe("# from bake() in bakery/oven.py");
    expect(attribution(comment)).toBe("# from bakery/oven.py, line 12");
  });

  it("writes dialog lines that the dialog box splits back into words and attribution", () => {
    const line = quoteLine(fileQuotes(file)[2]);
    expect(splitAttribution(line)).toEqual({ body: "“Never bake for negative time; the oven is not a time machine.”", note: "# from bakery/oven.py, line 12" });
    expect(splitAttribution("A plain line")).toEqual({ body: "A plain line", note: null });
  });

  it(`clips quotes to ${MAX_QUOTE_LENGTH} characters and deep paths from the left`, () => {
    const long = fileWithOutline(`${"deep/".repeat(30)}file.py`, { comments: [{ line: 1, text: `This comment rambles ${"on and ".repeat(40)}on.` }] });
    const [quote] = fileQuotes(long);
    const { body, note } = splitAttribution(quoteLine(quote));
    expect(Array.from(body).length).toBeLessThanOrEqual(MAX_QUOTE_LENGTH + 2);
    expect(note).toMatch(/^# from …\/.*file\.py, line 1$/);
  });

  it("finds nothing in an empty or failed file", () => {
    expect(fileQuotes(fileWithOutline("a.py", {}))).toEqual([]);
    expect(fileQuotes({ ...file, status: "failed" })).toEqual([]);
  });
});

describe("bubbleText", () => {
  it("keeps short plain sayings and swaps curly quotes for ASCII", () => {
    expect(bubbleText("Don’t feed the cauldron.")).toBe("Don't feed the cauldron.");
  });

  it(`refuses sayings over ${MAX_BUBBLE_LENGTH} characters or that the bitmap font cannot draw`, () => {
    expect(bubbleText("x ".repeat(MAX_BUBBLE_LENGTH))).toBeNull();
    expect(bubbleText("这是训练循环的核心部分")).toBeNull();
    expect(bubbleText("🍰 cake time")).toBeNull();
    expect(bubbleText("   ")).toBeNull();
  });
});

describe("codeNames", () => {
  const files = [
    fileWithOutline("shop/a.py", { definitions: [def("helper", "function", 1, 3), def("OrderBook", "class", 5, 40, "Keeps orders."), def("OrderBook.add", "method", 7, 12, "Add one.")] }),
    fileWithOutline("shop/b.py", { definitions: [def("load_data", "function", 1, 30, "Load it."), def("__init__", "function", 32, 33), def("x".repeat(500), "function", 40, 90)] }),
  ];

  it("prefers classes, then functions (documented and longer first), then methods, and skips unusable names", () => {
    expect(codeNames(files, 10, new Set()).map((n) => n.name)).toEqual(["Order Book", "Load Data", "Helper", "Add"]);
  });

  it("never repeats a name that is already taken", () => {
    const taken = new Set(["Order Book"]);
    const names = codeNames(files, 2, taken).map((n) => n.name);
    expect(names).toEqual(["Load Data", "Helper"]);
    expect(taken.has("Load Data")).toBe(true);
  });

  it("returns nothing for files without definitions", () => {
    expect(codeNames([fileWithOutline("a.py", {})], 3, new Set())).toEqual([]);
  });
});
