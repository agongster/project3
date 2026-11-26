import { describe, expect, it } from "vitest";
import { DEMO_SOURCES } from "@/lib/analysis/demo";
import { definitionAt, emptyOutline, MAX_OUTLINE_COMMENTS, MAX_OUTLINE_TEXT, outlineSource } from "@/lib/analysis/outline";

const SHOP = `"""A tiny shop.

More text that is not the first line.
"""
import os, sys as system
import numpy.linalg
from collections import OrderedDict
from . import sibling
from .local import thing

# Prices are in gold coins.
TAX = 0.2  # not a standalone comment


def total(prices, discount=0):
    """Add up the prices."""
    result = 0
    for price in prices:
        if price > 100:
            result += price * 0.9
        elif price < 0:
            continue
        else:
            result += price
    return result - discount


class Till:
    """Holds the money."""

    limit = 50

    def open(self):
        # TODO: ring the bell
        return True

    async def close(
        self,
        force=False,
    ):
        while not force:
            try:
                force = True
            except ValueError:
                pass

        def helper():
            if force:
                return 1

        return helper()


def undocumented():
    return "def not_a_function(): # nope"
`;

describe("outlineSource", () => {
  const outline = outlineSource(SHOP);
  const byName = (name: string) => outline.definitions.find((d) => d.name === name)!;

  it("lists top-level functions, classes and their methods in line order", () => {
    expect(outline.definitions.map((d) => `${d.kind}:${d.name}`)).toEqual([
      "function:total",
      "class:Till",
      "method:Till.open",
      "method:Till.close",
      "function:undocumented",
    ]);
  });

  it("finds where each body starts and ends", () => {
    const lines = SHOP.split("\n");
    const total = byName("total");
    expect(lines[total.line - 1]).toBe("def total(prices, discount=0):");
    expect(lines[total.endLine - 1]).toBe("    return result - discount");
    // The class runs to the end of its last method; a `):` closing a long parameter list does not end the method.
    expect(lines[byName("Till").endLine - 1]).toBe("        return helper()");
    expect(lines[byName("Till.close").endLine - 1]).toBe("        return helper()");
    expect(lines[byName("Till.open").endLine - 1]).toBe("        return True");
  });

  it("counts branching statements per function, including those in nested helpers", () => {
    expect(byName("total").branches).toBe(3); // for, if, elif
    expect(byName("Till.open").branches).toBe(0);
    expect(byName("Till.close").branches).toBe(3); // while, except, and the nested helper's if
    expect(byName("Till").branches).toBe(0);
  });

  it("reads the first line of docstrings", () => {
    expect(outline.moduleDocstring).toBe("A tiny shop.");
    expect(byName("total").docstring).toBe("Add up the prices.");
    expect(byName("Till").docstring).toBe("Holds the money.");
    expect(byName("Till.open").docstring).toBeNull();
    // A string that is returned is not a docstring, and code inside a string is not code.
    expect(byName("undocumented").docstring).toBeNull();
    expect(outline.definitions.some((d) => d.name === "not_a_function")).toBe(false);
  });

  it("keeps standalone comments and skips trailing ones", () => {
    expect(outline.comments.map((c) => c.text)).toEqual(["Prices are in gold coins.", "TODO: ring the bell"]);
    expect(SHOP.split("\n")[outline.comments[0].line - 1]).toBe("# Prices are in gold coins.");
  });

  it("lists imported top-level modules once, without relative imports", () => {
    expect(outline.imports).toEqual(["os", "sys", "numpy", "collections"]);
  });

  it("finds the function a line belongs to", () => {
    const lineOf = (text: string) => SHOP.split("\n").findIndex((l) => l.includes(text)) + 1;
    expect(definitionAt(outline, lineOf("price * 0.9"))?.name).toBe("total");
    expect(definitionAt(outline, lineOf("except ValueError"))?.name).toBe("Till.close");
    expect(definitionAt(outline, lineOf("limit = 50"))?.name).toBe("Till");
    expect(definitionAt(outline, lineOf("TAX = 0.2"))).toBeNull();
  });
});

describe("outlineSource on awkward input", () => {
  it("returns an empty outline for an empty file", () => {
    expect(outlineSource("")).toEqual(emptyOutline());
  });

  it("ignores tool directives, dividers and shebangs among the comments", () => {
    const outline = outlineSource("#!/usr/bin/env python\n# -*- coding: utf-8 -*-\n# noqa: E501\n# type: ignore\n# ----------\n# ok\n# A real remark.\n");
    expect(outline.comments.map((c) => c.text)).toEqual(["A real remark."]);
  });

  it("does not treat the contents of a triple-quoted string as code or comments", () => {
    const outline = outlineSource('TEXT = """\ndef fake():\n    # not a comment\n"""\n\ndef real():\n    pass\n');
    expect(outline.definitions.map((d) => d.name)).toEqual(["real"]);
    expect(outline.comments).toEqual([]);
    expect(outline.moduleDocstring).toBeNull();
  });

  it("reads a docstring whose summary starts on the line after the quotes", () => {
    const outline = outlineSource('"""\nModule summary.\n"""\n\ndef f():\n    \'\'\'\n    Function summary.\n    More.\n    \'\'\'\n    return 1\n\ndef g():\n    """One-liner."""\n');
    expect(outline.moduleDocstring).toBe("Module summary.");
    expect(outline.definitions.map((d) => [d.name, d.docstring])).toEqual([
      ["f", "Function summary."],
      ["g", "One-liner."],
    ]);
    expect(outline.definitions[0].endLine).toBe(10);
  });

  it("caps the number of comments and the length of texts", () => {
    const many = Array.from({ length: MAX_OUTLINE_COMMENTS + 20 }, (_, i) => `# remark number ${i}`).join("\n");
    expect(outlineSource(many).comments).toHaveLength(MAX_OUTLINE_COMMENTS);
    const long = outlineSource(`# ${"word ".repeat(80)}\n`).comments[0].text;
    expect(long.length).toBe(MAX_OUTLINE_TEXT);
    expect(long.endsWith("…")).toBe(true);
  });

  it("never throws on broken or strange code", () => {
    const strange = ["def broken(:\n  x = (1,\n", "\t\tdef tabs():\n\t\t\treturn 1\n", 'x = "unterminated\n', "'''never closed\ndef f(): pass\n", "))))]]]\nclass\n def\n"];
    for (const source of strange) expect(() => outlineSource(source)).not.toThrow();
  });

  it("outlines every file of the demo kingdom sensibly", () => {
    for (const { path, source } of DEMO_SOURCES) {
      const outline = outlineSource(source);
      const lineCount = source.split("\n").length;
      for (const definition of outline.definitions) {
        expect(definition.line, `${path}:${definition.name}`).toBeGreaterThanOrEqual(1);
        expect(definition.endLine, `${path}:${definition.name}`).toBeGreaterThanOrEqual(definition.line);
        expect(definition.endLine, `${path}:${definition.name}`).toBeLessThanOrEqual(lineCount);
      }
    }
    const allNames = DEMO_SOURCES.flatMap(({ source }) => outlineSource(source).definitions);
    expect(allNames.length).toBeGreaterThan(10);
  });
});
