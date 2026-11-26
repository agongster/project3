/**
 * Seal scrolls (src/lib/game/seal.ts), checked against the REAL Ruff: for
 * every rule family the game turns into monsters, the planned `# noqa`
 * edit must make that finding disappear without breaking the code, and
 * after a forge a sealed finding must be told apart from a real fix.
 */
import { describe, expect, it } from "vitest";
import { analyzeFile } from "@/lib/analysis/analyzeSources";
import { SYNTAX_CODE, isProbeRule } from "@/lib/analysis/rules";
import { ALREADY_SEALED, CANT_SEAL_SYNTAX, planSeal, scanLines, splitSealed } from "@/lib/game/seal";
import type { TextEdit } from "@/lib/workspace/contract";
import { createNodeLint } from "../analysis/nodeLint";

const lint = createNodeLint();

/** Applies one edit (1-based lines, 1-based columns, end exclusive) to a text. */
function applyEdit(text: string, edit: TextEdit): string {
  const lines = text.split("\n");
  const offset = (line: number, col: number) => lines.slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0) + col - 1;
  return text.slice(0, offset(edit.line, edit.col)) + edit.text + text.slice(offset(edit.endLine, edit.endCol));
}

/** The codes Ruff reports, without the quality probes (they never become monsters). */
function codesOf(source: string): string[] {
  return lint(source)
    .map((d) => String(d.code))
    .filter((code) => !isProbeRule(code));
}

/** Seals the first diagnostic of `code` in `source` and returns the new text. */
function sealFirst(source: string, code: string): string {
  const line = lint(source).find((d) => d.code === code)?.start_location?.row;
  if (line === undefined) throw new Error(`Ruff should report ${code}`);
  const plan = planSeal(source, { code }, line);
  if (!plan.ok) throw new Error(plan.reason);
  return applyEdit(source, plan.edit);
}

const COMPLEX = `def pick(x):\n${Array.from({ length: 11 }, (_, i) => `    if x == ${i}:\n        return ${i}`).join("\n")}\n    return -1\n`;
const MANY_RETURNS = `def pick(x):\n${Array.from({ length: 7 }, (_, i) => `    if x == ${i}:\n        return ${i}`).join("\n")}\n    return -1\n`;
const MANY_STATEMENTS = `def busy():\n${Array.from({ length: 52 }, (_, i) => `    print(${i})`).join("\n")}\n`;

/** One sample per rule family the game selects (src/lib/analysis/rules.ts). */
const FAMILIES: readonly [family: string, code: string, source: string][] = [
  ["F (Pyflakes)", "F401", "import os\n"],
  ["F, unused variable", "F841", "def f():\n    x = 1\n"],
  ["F, undefined name", "F821", "print(cauldron)\n"],
  ["E711", "E711", "x = 1\nif x == None:\n    pass\n"],
  ["E712", "E712", "x = 1\nif x == True:\n    pass\n"],
  ["E721", "E721", "x = 1\nif type(x) == type(2):\n    pass\n"],
  ["E722", "E722", "try:\n    pass\nexcept:\n    pass\n"],
  ["E731", "E731", "f = lambda: 1\n"],
  ["E741", "E741", "l = 1\nprint(l)\n"],
  ["B (Bugbear)", "B006", "def f(a=[]):\n    return a\n"],
  ["S (Bandit)", "S105", 'password = "hunter2"\n'],
  ["S, eval", "S307", "x = eval(input())\n"],
  ["C901", "C901", COMPLEX],
  ["PLE", "PLE0101", "class A:\n    def __init__(self):\n        return 1\n"],
  ["PLR0911", "PLR0911", MANY_RETURNS],
  ["PLR0913", "PLR0913", "def f(a, b, c, d, e, f, g, h, i):\n    return a\n"],
  ["PLR0915", "PLR0915", MANY_STATEMENTS],
  ["PLW", "PLW0127", "x = 1\nx = x\n"],
  ["BLE001", "BLE001", "try:\n    pass\nexcept Exception:\n    print('oops')\n"],
  ["A001", "A001", "list = [1]\nprint(list)\n"],
  ["A002", "A002", "def f(list):\n    return list\n"],
  ["ERA001", "ERA001", "# print(x)\nx = 1\n"],
  ["FIX (TODO)", "FIX002", "x = 1  # TODO: tidy this up\n"],
  ["SIM", "SIM118", "d = {}\nif 1 in d.keys():\n    pass\n"],
];

describe("planSeal with the real Ruff", () => {
  it.each(FAMILIES)("seals %s (%s) without breaking the code", (_family, code, source) => {
    const before = codesOf(source).filter((c) => c === code).length;
    const sealed = sealFirst(source, code);
    expect(sealed).toContain(`# noqa: ${code}`);
    const after = codesOf(sealed);
    expect(after.filter((c) => c === code)).toHaveLength(before - 1);
    expect(after).not.toContain("invalid-syntax");
  });

  it("puts the seal at the end of a multi-line string (Ruff's rule)", () => {
    const source = 'def f(cur, name):\n    cur.execute("""\n        SELECT * FROM t WHERE n = \'%s\'\n    """ % name)\n';
    const sealed = sealFirst(source, "S608");
    expect(sealed.split("\n")[3]).toBe('    """ % name)  # noqa: S608');
    expect(codesOf(sealed)).not.toContain("S608");
  });

  it("puts the seal after a backslash continuation, never after the backslash", () => {
    const source = "x = eval(\\\n    input())\n";
    const sealed = sealFirst(source, "S307");
    expect(sealed).toBe("x = eval(\\\n    input())  # noqa: S307\n");
    expect(codesOf(sealed)).toEqual([]);
  });

  it("seals a finding inside a multi-line f-string at the string's last line", () => {
    const source = 'x = f"""\n{eval("1")}\n"""\n';
    const sealed = sealFirst(source, "S307");
    expect(sealed.split("\n")[2]).toBe('"""  # noqa: S307');
    expect(codesOf(sealed)).not.toContain("S307");
  });

  it("seals one name of a multi-line import on its own line", () => {
    const source = "from os import (\n    path,\n    sep,\n)\n";
    const sealed = sealFirst(source, "F401");
    expect(sealed.split("\n")[1]).toBe("    path,  # noqa: F401");
    expect(codesOf(sealed).filter((c) => c === "F401")).toHaveLength(1);
  });

  it("keeps a comment that is already there", () => {
    const sealed = sealFirst("import os  # we need this one\n", "F401");
    expect(sealed).toBe("import os  # we need this one  # noqa: F401\n");
    expect(codesOf(sealed)).toEqual([]);
  });

  it("adds the code to a noqa comment for another rule", () => {
    const source = "x = 1\nif x == None:  # noqa: E712\n    pass\n";
    const sealed = sealFirst(source, "E711");
    expect(sealed.split("\n")[1]).toBe("if x == None:  # noqa: E712, E711");
    expect(codesOf(sealed)).not.toContain("E711");
  });

  it("replaces trailing spaces instead of piling the comment after them", () => {
    expect(sealFirst("import os   \n", "F401")).toBe("import os  # noqa: F401\n");
  });

  it("is not fooled by a # inside a string", () => {
    const sealed = sealFirst('import os\nlabel = "# not a comment"; x = eval(label)\n', "S307");
    expect(sealed.split("\n")[1]).toBe('label = "# not a comment"; x = eval(label)  # noqa: S307');
  });

  it("refuses to seal a syntax error, and says so plainly", () => {
    expect(planSeal("def f(:\n    pass\n", { code: SYNTAX_CODE }, 1)).toEqual({ ok: false, reason: CANT_SEAL_SYNTAX });
  });

  it("says when the line already carries the seal", () => {
    expect(planSeal("import os  # noqa: F401\n", { code: "F401" }, 1)).toEqual({ ok: false, reason: ALREADY_SEALED });
    expect(planSeal("import os  # noqa\n", { code: "F401" }, 1)).toEqual({ ok: false, reason: ALREADY_SEALED });
  });
});

describe("scanLines", () => {
  it("maps every line of a multi-line string or continuation to its last line", () => {
    const lines = ['a = """', "inside", '""" + b  # done', "c = 1 + \\", "    2", "d = 3"];
    expect(scanLines(lines).map((line) => line.noqaLine)).toEqual([2, 2, 2, 4, 4, 5]);
    expect(scanLines(lines)[2].commentAt).toBe(9);
  });

  it("closes a one-quote string that was never closed at the end of its line", () => {
    expect(scanLines(['x = "oops', "y = 1  # fine"]).map((line) => line.commentAt)).toEqual([null, 7]);
  });
});

describe("splitSealed with the real Ruff", () => {
  const original = "import os\nimport sys\npassword = 'hunter2'\n";
  const file = analyzeFile({ path: "app.py", size: 1, source: original }, lint);
  const [os, sys, password] = file.findings;

  it("tells a sealed line from a rewritten one", () => {
    const saved = "import os  # noqa: F401\npassword = 'hunter2'  # noqa: S105\n";
    expect(codesOf(saved)).toEqual([]);
    expect(splitSealed([os, sys, password], saved)).toEqual({ fixed: [sys], sealed: [os, password] });
  });

  it("counts a line changed beyond spacing as a real fix, even under a noqa", () => {
    expect(splitSealed([password], "password = os.environ['PASSWORD']  # noqa: S105\n")).toEqual({ fixed: [password], sealed: [] });
  });

  it("ignores a noqa for another rule, and accepts a bare noqa", () => {
    expect(splitSealed([os], "import os  # noqa: E501\n").sealed).toEqual([]);
    expect(splitSealed([os], "import  os  # noqa\n").sealed).toEqual([os]);
  });

  it("finds a seal that moved to another line number", () => {
    expect(splitSealed([password], "\n\n\n# settings\npassword = 'hunter2'  # noqa: S105\n").sealed).toEqual([password]);
  });
});
