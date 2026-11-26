import { EditorState, Text } from "@codemirror/state";
import { lineEndingsOf, textOf } from "@/components/workshop/editor/lineEndings";
import { describe, expect, it } from "vitest";
import {
  columnToOffset,
  editsToChanges,
  lineSeparatorOf,
  minimalChange,
  offsetToColumn,
  offsetToPosition,
  positionToOffset,
  rangeToOffsets,
  toUnixBreaks,
} from "@/components/workshop/logic/positions";

/** A CodeMirror document, exactly like the editor's. */
function doc(source: string): Text {
  return Text.of(source.split("\n"));
}

/** Applies offset changes to a string (all positions refer to the original). */
function apply(source: string, changes: { from: number; to: number; insert: string }[]): string {
  let out = source;
  for (const change of [...changes].reverse()) out = out.slice(0, change.from) + change.insert + out.slice(change.to);
  return out;
}

describe("columns and offsets", () => {
  it("is a shift by one, in UTF-16 units like the workspace's Ruff positions", () => {
    expect(columnToOffset("abc", 1)).toBe(0);
    expect(columnToOffset("abc", 3)).toBe(2);
    expect(offsetToColumn("abc", 2)).toBe(3);
    // The snake takes two units, so `y` is at column 12 for Ruff and offset 11 for the editor.
    const line = 'x = "🐍" + y';
    expect(line.slice(columnToOffset(line, 12))).toBe("y");
  });

  it("clamps columns outside the line", () => {
    expect(columnToOffset("ab", 99)).toBe(2);
    expect(columnToOffset("ab", 0)).toBe(0);
    expect(offsetToColumn("ab", 99)).toBe(3);
  });
});

describe("positions in a document", () => {
  const text = doc("import os\n\ndef f(a=[]):\n    return a");

  it("finds a line and column", () => {
    expect(positionToOffset(text, 3, 7)).toBe("import os\n\ndef f(".length);
    expect(offsetToPosition(text, "import os\n\ndef f(".length)).toEqual({ line: 3, col: 7 });
  });

  it("clamps lines outside the document (Ruff reports syntax errors one line past the end)", () => {
    expect(positionToOffset(text, 99, 1)).toBe(text.line(4).from);
    expect(positionToOffset(text, 0, 1)).toBe(0);
  });

  it("turns a range into offsets that never run backwards", () => {
    const { from, to } = rangeToOffsets(text, { line: 1, col: 8, endLine: 1, endCol: 10 });
    expect(text.sliceString(from, to)).toBe("os");
    expect(rangeToOffsets(text, { line: 3, col: 9, endLine: 2, endCol: 1 })).toEqual({ from: 19, to: 19 });
  });
});

describe("quick-fix edits", () => {
  it("applies edits that all refer to the original text, whatever their order", () => {
    const source = "import os, sys\nprint(sys)";
    const text = doc(source);
    const changes = editsToChanges(text, [
      { line: 2, col: 7, endLine: 2, endCol: 10, text: "sys.argv" },
      { line: 1, col: 8, endLine: 1, endCol: 12, text: "" },
    ]);
    expect(changes.map((change) => change.from)).toEqual([7, 21]);
    expect(apply(source, changes)).toBe("import sys\nprint(sys.argv)");
  });

  it("drops an edit that overlaps an earlier one", () => {
    const changes = editsToChanges(doc("abcdef"), [
      { line: 1, col: 1, endLine: 1, endCol: 4, text: "X" },
      { line: 1, col: 3, endLine: 1, endCol: 5, text: "Y" },
    ]);
    expect(changes).toHaveLength(1);
  });

  it("handles a deletion that removes a whole line", () => {
    const source = "import os\nx = 1\n";
    const changes = editsToChanges(doc(source), [{ line: 1, col: 1, endLine: 2, endCol: 1, text: "" }]);
    expect(apply(source, changes)).toBe("x = 1\n");
  });
});

describe("minimalChange", () => {
  it("replaces only the part that differs", () => {
    expect(minimalChange("a  =  1\nb=2\n", "a = 1\nb=2\n")).toEqual({ from: 2, to: 5, insert: "=" });
  });

  it("is null for equal texts", () => {
    expect(minimalChange("same", "same")).toBeNull();
  });

  it("round-trips insertions, deletions and repeated letters", () => {
    for (const [before, after] of [
      ["aaa", "aaaa"],
      ["aaaa", "aa"],
      ["", "x = 1\n"],
      ["x = 1\n", ""],
      ["def f( a ):\n  pass", "def f(a):\n    pass\n"],
    ]) {
      const change = minimalChange(before, after)!;
      expect(apply(before, [change])).toBe(after);
    }
  });
});

describe("line endings", () => {
  it("keeps Windows line breaks when most breaks are Windows ones", () => {
    expect(lineSeparatorOf("a\r\nb\r\n")).toBe("\r\n");
    expect(lineSeparatorOf("a\r\nb\r\nc\n")).toBe("\r\n");
    expect(lineSeparatorOf("a\nb\n")).toBe("\n");
    expect(lineSeparatorOf("a\nb\nc\r\n")).toBe("\n");
    expect(lineSeparatorOf("")).toBe("\n");
  });

  it("gives a CRLF file back with CRLF after editing, so its patch only shows the edit", () => {
    const original = "import os\r\n\r\ndef f(a=[]):\r\n    return a\r\n";
    const state = EditorState.create({ doc: original, extensions: lineEndingsOf(original) });
    expect(state.doc.lines).toBe(5);
    expect(textOf(state)).toBe(original);
    const line3 = state.doc.line(3);
    // A Ruff range on line 3 (`[]`) lands on the right characters: line breaks count once, whatever they are.
    const range = rangeToOffsets(state.doc, { line: 3, col: 9, endLine: 3, endCol: 11 });
    expect(state.doc.sliceString(range.from, range.to)).toBe("[]");
    const edited = state.update({ changes: { ...range, insert: "None" } }).state;
    expect(textOf(edited)).toBe("import os\r\n\r\ndef f(a=None):\r\n    return a\r\n");
    // Code pasted with "\n" breaks still becomes separate lines, and comes back with the file's breaks.
    const pasted = edited.update({ changes: { from: line3.from, insert: "# a\n# b\n" } }).state;
    expect(pasted.doc.lines).toBe(7);
    expect(textOf(pasted)).toBe("import os\r\n\r\n# a\r\n# b\r\ndef f(a=None):\r\n    return a\r\n");
  });

  it("keeps \"\\n\" files as they are", () => {
    const original = "a = 1\nb = 2\n";
    expect(textOf(EditorState.create({ doc: original, extensions: lineEndingsOf(original) }))).toBe(original);
    expect(toUnixBreaks("a\r\nb\rc\n")).toBe("a\nb\nc\n");
  });
});
