import { describe, expect, it } from "vitest";
import { cardAnchor } from "@/components/workshop/ui/placement";
import { creptInText, describeForge, gradeImproved, mergeMoments, sealedText, withArticle } from "@/components/workshop/logic/forgeMoment";
import { badgeDescription, explorerBadge } from "@/components/workshop/logic/fileBadges";
import { diffRows, MAX_DIFF_ROWS } from "@/components/workshop/logic/diffRows";
import { languageForPath } from "@/components/workshop/logic/languages";
import { commandFor, shortcutKeys, type KeyPress } from "@/components/workshop/logic/shortcuts";
import { fixCoins } from "@/lib/game/forge";
import type { ForgeReport } from "@/lib/workspace/contract";
import { KEY, makeFile, makeFinding, saveWith } from "../game/helpers";

function report(overrides: Partial<ForgeReport> = {}): ForgeReport {
  return {
    path: "bakery/orders.py",
    linted: true,
    fixed: [],
    introduced: [],
    kept: [],
    before: { grade: "C", score: 40, findingCount: 1 },
    after: { grade: "C", score: 40, findingCount: 1 },
    purified: false,
    file: null,
    ...overrides,
  };
}

describe("describeForge", () => {
  it("banishes fixed bugs and announces new ones", () => {
    const fixed = makeFinding("bakery/orders.py", 4, "mimic", { title: "Mutable default argument" });
    const crept = makeFinding("bakery/orders.py", 12, "gremlin");
    const moment = describeForge(report({ fixed: [fixed], introduced: [crept] }), { coins: 30, xp: 20, lines: [] });
    expect(moment.banished).toEqual([{ id: fixed.id, monster: "mimic", name: "Mimic", title: "Mutable default argument", line: 4, coins: null }]);
    expect(creptInText(moment.creptIn[0])).toBe("A Gremlin crept in at line 12 — no harm done");
    expect(creptInText(moment.creptIn[0], true)).toBe("A Gremlin is back at line 12 — no harm done");
    expect(moment.quiet).toBe(false);
  });

  it("shows what each paid fix earned, matching the original finding by code and message", () => {
    const fixed = makeFinding("a.py", 9, "mimic", { code: "B006", message: "mutable default" });
    const notPaid = makeFinding("a.py", 20, "dustBunny");
    // The game reports the paid fix as it was in the original text, two lines higher.
    const original = { ...fixed, id: "a.py:7:1:B006", line: 7 };
    const moment = describeForge(report({ fixed: [fixed, notPaid] }), { coins: 24, xp: 30, lines: [], paidFixes: [original] });
    expect(moment.banished.map((monster) => monster.coins)).toEqual([fixCoins(fixed), null]);
  });

  it("is quiet when nothing changed and nothing was paid", () => {
    expect(describeForge(report(), undefined).quiet).toBe(true);
    expect(describeForge(report(), { coins: 0, xp: 0, lines: [] }).quiet).toBe(true);
    expect(describeForge(report(), { coins: 0, xp: 0, lines: ["Quest done"] }).quiet).toBe(false);
  });

  it("notes purification and grade changes", () => {
    const moment = describeForge(report({ purified: true, after: { grade: "A", score: 75, findingCount: 0 } }), null);
    expect(moment.purified).toEqual(["bakery/orders.py"]);
    expect(moment.grades).toEqual([{ path: "bakery/orders.py", from: "C", to: "A" }]);
  });

  it("ignores lint facts of a file that is not linted", () => {
    const moment = describeForge(report({ linted: false, purified: true, after: { grade: "S", score: 99, findingCount: 0 } }), null);
    expect(moment.quiet).toBe(true);
  });

  it("merges several forges and adds up the rewards", () => {
    const a = describeForge(report({ path: "a.py", fixed: [makeFinding("a.py", 1)] }), { coins: 10, xp: 5, lines: ["one"] });
    const b = describeForge(report({ path: "b.py" }), { coins: 3, xp: 0, lines: [] });
    const merged = mergeMoments([a, b]);
    expect(merged.paths).toEqual(["a.py", "b.py"]);
    expect(merged.banished).toHaveLength(1);
    expect(merged.rewards).toEqual({ coins: 13, xp: 5, lines: ["one"], sealedIds: [] });
    expect(mergeMoments([]).quiet).toBe(true);
  });

  it("lists sealed bugs plainly, apart from the banished ones, with no coins", () => {
    const fixed = makeFinding("a.py", 1);
    const sealed = makeFinding("a.py", 4, "keyThief", { code: "S105" });
    const moment = describeForge(report({ path: "a.py", fixed: [fixed, sealed] }), { coins: 0, xp: 0, lines: [], paidFixes: [], sealedIds: [sealed.id] });
    expect(moment.banished.map((m) => m.id)).toEqual([fixed.id]);
    expect(moment.sealed.map((m) => m.id)).toEqual([sealed.id]);
    expect(sealedText(moment.sealed[0])).toBe("Key Thief ignored at line 4 — skipped with # noqa, no reward");
    const onlySealed = describeForge(report({ path: "a.py", fixed: [sealed] }), { coins: 0, xp: 0, lines: [], sealedIds: [sealed.id] });
    expect(onlySealed.quiet).toBe(false);
    expect(onlySealed.banished).toEqual([]);
  });

  it("uses the right article and grade order", () => {
    expect(withArticle("Echo Bat")).toBe("An Echo Bat");
    expect(withArticle("Mimic")).toBe("A Mimic");
    expect(gradeImproved("C", "B")).toBe(true);
    expect(gradeImproved("S", "A")).toBe(false);
  });
});

describe("explorerBadge", () => {
  it("shows a cursed file's fighting monsters and its worst one", () => {
    const findings = [makeFinding("x.py", 1, "dustBunny"), makeFinding("x.py", 2, "keyThief"), makeFinding("x.py", 3, "mimic")];
    const file = makeFile("x.py", { findings, grade: "C" });
    const save = saveWith({ repos: { [KEY]: { defeated: [findings[1].id], cleared: [], opened: [], milestones: [] } } });
    const badge = explorerBadge(save, KEY, file);
    expect(badge).toEqual({ kind: "world", status: "cursed", bugs: 2, monster: "mimic", grade: "C" });
    expect(badgeDescription(badge)).toBe("cursed, 2 monsters to fight, grade C");
  });

  it("shows a quiet file's lines left to fix", () => {
    const findings = [makeFinding("x.py", 1), makeFinding("x.py", 2)];
    const save = saveWith({ repos: { [KEY]: { defeated: findings.map((f) => f.id), cleared: [], opened: [], milestones: [] } } });
    const badge = explorerBadge(save, KEY, makeFile("x.py", { findings, grade: "B" }));
    expect(badge).toEqual({ kind: "world", status: "quiet", bugs: 2, monster: null, grade: "B" });
    expect(badgeDescription(badge)).toBe("quiet, 2 lines to fix, grade B");
  });

  it("follows the building state for clean, failed and non-Python files", () => {
    expect(explorerBadge(saveWith({}), KEY, makeFile("ok.py", { grade: "S" }))).toMatchObject({ status: "treasure", grade: "S", monster: null });
    expect(explorerBadge(saveWith({}), KEY, makeFile("bad.py", { status: "failed" }))).toEqual({ kind: "ruin" });
    expect(explorerBadge(saveWith({}), KEY, undefined)).toEqual({ kind: "plain" });
  });
});

describe("cardAnchor", () => {
  const area = { left: 250, right: 950, top: 75 } as DOMRect;

  it("puts the bug card on the side of its line with more room, and never past the window's edge", () => {
    const high = cardAnchor({ top: 200, bottom: 220, left: 330 }, area, 800);
    expect(high).toEqual({ left: 330, top: 226, maxHeight: 568 });
    const low = cardAnchor({ top: 600, bottom: 620, left: 330 }, area, 800);
    expect(low).toEqual({ left: 330, bottom: 206, maxHeight: 588 });
    const middle = cardAnchor({ top: 420, bottom: 440, left: 100 }, area, 800);
    expect(middle).toEqual({ left: 256, bottom: 386, maxHeight: 408 });
  });
});

describe("diffRows", () => {
  it("numbers added, removed and unchanged lines", () => {
    const { rows, truncated } = diffRows("a\nb\nc\n", "a\nB\nc\nd\n");
    expect(truncated).toBe(false);
    expect(rows.map((row) => `${row.kind}:${row.oldLine ?? "-"}:${row.newLine ?? "-"}:${row.text}`)).toEqual([
      "context:1:1:a",
      "removed:2:-:b",
      "added:-:2:B",
      "context:3:3:c",
      "added:-:4:d",
    ]);
  });

  it("puts a gap between distant changes and stops at the row limit", () => {
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i}`);
    const changed = lines.map((line, i) => (i === 2 || i === 35 ? `${line}!` : line));
    expect(diffRows(lines.join("\n"), changed.join("\n")).rows.some((row) => row.kind === "gap")).toBe(true);
    const huge = Array.from({ length: MAX_DIFF_ROWS + 100 }, (_, i) => `${i}`).join("\n");
    expect(diffRows("", huge).truncated).toBe(true);
  });
});

describe("languageForPath", () => {
  it("picks the highlighting by extension", () => {
    expect(languageForPath("bakery/orders.py")).toBe("python");
    expect(languageForPath("README.MD")).toBe("markdown");
    expect(languageForPath("conf/app.yml")).toBe("yaml");
    expect(languageForPath("Makefile")).toBe("plain");
    expect(languageForPath(".gitignore")).toBe("plain");
  });
});

describe("shortcuts", () => {
  const press = (overrides: Partial<KeyPress>): KeyPress => ({ code: "", key: "", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...overrides });

  it("maps key presses to commands with Ctrl or Cmd", () => {
    expect(commandFor(press({ code: "KeyS", key: "s", ctrlKey: true }))).toBe("forge");
    expect(commandFor(press({ code: "KeyS", key: "s", metaKey: true }))).toBe("forge");
    expect(commandFor(press({ code: "KeyS", key: "S", metaKey: true, shiftKey: true }))).toBe("forgeAll");
    expect(commandFor(press({ code: "KeyF", key: "Ï", shiftKey: true, altKey: true }))).toBe("polish");
    expect(commandFor(press({ code: "Escape", key: "Escape" }))).toBe("back");
  });

  it("ignores plain typing", () => {
    expect(commandFor(press({ code: "KeyS", key: "s" }))).toBeNull();
    expect(commandFor(press({ code: "Enter", key: "Enter", ctrlKey: true }))).toBeNull();
  });

  it("follows the typed letter on other keyboard layouts", () => {
    expect(commandFor(press({ code: "Semicolon", key: "s", ctrlKey: true }))).toBe("forge");
  });

  it("prints key caps for each platform", () => {
    expect(shortcutKeys("forge", true)).toEqual(["⌘", "S"]);
    expect(shortcutKeys("forgeAll", false)).toEqual(["Ctrl", "Shift", "S"]);
    expect(shortcutKeys("back", false)).toEqual(["Esc"]);
  });
});
