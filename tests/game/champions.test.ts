/**
 * Champions and lairs (src/lib/game/champions.ts): which monster of a
 * dungeon is crowned, that the choice is deterministic and survives edits
 * that only move lines, and how lairs are listed and named.
 */
import { describe, expect, it } from "vitest";
import { analyzeDemoSources } from "@/lib/analysis/demo";
import { ruleInfo } from "@/lib/analysis/rules";
import {
  CHAMPION_MIN_MONSTERS,
  CHAMPION_STATS,
  championHp,
  championName,
  championOf,
  compassName,
  fileLairs,
  isChampion,
  lairCounts,
  aliveLair,
  repoLairs,
} from "@/lib/game/champions";
import { emptyProgress } from "@/lib/game/progress";
import type { AnalyzedFile, Definition, Finding } from "@/lib/types";
import { createNodeLint } from "../analysis/nodeLint";
import { makeAnalysis, makeFile, makeFinding } from "./helpers";

/** A finding of a real rule code (monster, severity, category and title from the rule table). */
function real(path: string, line: number, code: string, col = 1): Finding {
  const info = ruleInfo(code);
  return makeFinding(path, line, info.monster, { code, id: `${path}:${line}:${col}:${code}`, col, severity: info.severity, category: info.category, title: info.title });
}

function fileOf(path: string, findings: Finding[], extra: Partial<AnalyzedFile> = {}): AnalyzedFile {
  return { ...makeFile(path, { findings }), ...extra };
}

/** Same bugs, every line moved down by `by` (ids follow the lines, like after an edit above them). */
function shifted(findings: Finding[], by: number): Finding[] {
  return findings.map((f) => ({ ...f, line: f.line + by, endLine: f.endLine + by, id: `${f.path}:${f.line + by}:${f.col}:${f.code}` }));
}

const DUNGEON = [real("shop.py", 3, "F401"), real("shop.py", 9, "FIX002"), real("shop.py", 14, "B006"), real("shop.py", 20, "F632"), real("shop.py", 31, "E722")];

describe("championOf", () => {
  it("crowns the toughest monster: highest severity, then the most notable kind of bug, then the first line", () => {
    // Three elites; a bug (F632) is more notable than a trap (B006) or swallowed errors (E722).
    expect(championOf(fileOf("shop.py", DUNGEON))?.code).toBe("F632");
    const twoBugs = [...DUNGEON, real("shop.py", 25, "F601")];
    expect(championOf(fileOf("shop.py", twoBugs))?.line).toBe(20);
    const minionsOnly = [real("a.py", 9, "FIX002"), real("a.py", 2, "E711"), real("a.py", 5, "F841"), real("a.py", 7, "F401")];
    expect(championOf(fileOf("a.py", minionsOnly))?.code).toBe("F841"); // unused beats style and todo; line 5 first
  });

  it(`needs at least ${CHAMPION_MIN_MONSTERS} monsters`, () => {
    expect(championOf(fileOf("shop.py", DUNGEON.slice(0, CHAMPION_MIN_MONSTERS - 1)))).toBeNull();
    expect(championOf(fileOf("shop.py", DUNGEON.slice(0, CHAMPION_MIN_MONSTERS)))).not.toBeNull();
  });

  it("never crowns one where a true boss lives, or lived before it was fixed", () => {
    const withBoss = [...DUNGEON, real("shop.py", 40, "S307")];
    expect(championOf(fileOf("shop.py", withBoss))).toBeNull();
    expect(championOf(fileOf("shop.py", DUNGEON, { fixedFindings: [real("shop.py", 40, "S307")] }))).toBeNull();
  });

  it("is deterministic and ignores the order findings come in", () => {
    const reversed = [...DUNGEON].reverse();
    expect(championOf(fileOf("shop.py", reversed))?.id).toBe(championOf(fileOf("shop.py", DUNGEON))?.id);
  });

  it("keeps the same bug when an edit moves lines but keeps the findings", () => {
    const before = championOf(fileOf("shop.py", DUNGEON))!;
    const after = championOf(fileOf("shop.py", shifted(DUNGEON, 7)))!;
    expect([after.code, after.col, after.line]).toEqual([before.code, before.col, before.line + 7]);
  });

  it("stays the champion once its bug is fixed, so the next monster is not crowned", () => {
    const champion = championOf(fileOf("shop.py", DUNGEON))!;
    const rest = DUNGEON.filter((f) => f.id !== champion.id);
    const edited = fileOf("shop.py", rest, { fixedFindings: [champion] });
    expect(championOf(edited)?.id).toBe(champion.id);
    expect(isChampion(edited, rest[0])).toBe(false);
  });

  it("gives every eligible dungeon of a real repo exactly one champion and no other dungeon any", () => {
    const demo = analyzeDemoSources(createNodeLint());
    for (const file of demo.files) {
      const eligible = file.findings.length >= CHAMPION_MIN_MONSTERS && !file.findings.some((f) => f.severity === "boss");
      const crowned = file.findings.filter((f) => isChampion(file, f));
      expect(crowned.length, file.path).toBe(eligible ? 1 : 0);
    }
  });
});

describe("champion numbers and names", () => {
  it("has more health than its species, and never too little", () => {
    expect(championHp(9)).toBe(Math.round(9 * CHAMPION_STATS.hpMultiplier));
    expect(championHp(1)).toBe(CHAMPION_STATS.minHp);
    expect(championHp(2)).toBeGreaterThan(2);
  });

  it("is named after the function it lives in, clipped", () => {
    const def = (name: string, kind: Definition["kind"], line: number, endLine: number): Definition => ({ name, kind, line, endLine, branches: 0, docstring: null });
    const outline = { ...makeFile("x.py").outline, definitions: [def("take_order", "function", 10, 30), def("Shop", "class", 40, 60), def("a".repeat(80), "function", 70, 80)] };
    expect(championName(real("x.py", 20, "F632"), outline)).toBe("Champion Gremlin of take_order()");
    expect(championName(real("x.py", 45, "F632"), outline)).toBe("Champion Gremlin of Shop");
    expect(championName(real("x.py", 2, "F401"), outline)).toBe("Champion Dust Bunny");
    expect(championName(real("x.py", 75, "F632"), outline).length).toBeLessThan(60);
  });
});

describe("lairs", () => {
  const bossFile = fileOf("vault.py", [real("vault.py", 4, "S105"), real("vault.py", 9, "F401"), real("vault.py", 12, "S307")]);
  const champFile = fileOf("shop.py", DUNGEON);
  const small = fileOf("tiny.py", [real("tiny.py", 1, "F401")]);
  const analysis = makeAnalysis([small, champFile, bossFile]);

  it("lists one lair per boss, or the champion, bosses first", () => {
    const lairs = repoLairs(analysis, emptyProgress());
    expect(lairs.map((l) => [l.kind, l.path, l.finding.code])).toEqual([
      ["boss", "vault.py", "S105"],
      ["boss", "vault.py", "S307"],
      ["champion", "shop.py", "F632"],
    ]);
    expect(lairCounts(analysis)).toEqual({ boss: 2, champion: 1 });
  });

  it("uses the SPEC's words for how each lair is doing", () => {
    const progress = { ...emptyProgress(), defeated: ["vault.py:4:1:S105"] };
    expect(fileLairs(bossFile, progress).map((l) => l.state)).toEqual(["subdued", "alive"]);
    expect(aliveLair(bossFile, progress)?.finding.code).toBe("S307");
    const fixed = fileOf("vault.py", [real("vault.py", 9, "F401")], { fixedFindings: [real("vault.py", 4, "S105"), real("vault.py", 12, "S307")] });
    expect(fileLairs(fixed, emptyProgress()).map((l) => l.state)).toEqual(["fixed", "fixed"]);
    expect(aliveLair(fixed, emptyProgress())).toBeNull();
    expect(aliveLair(undefined, emptyProgress())).toBeNull();
  });

  it("counts the demo kingdom's bosses and its champion", () => {
    const demo = analyzeDemoSources(createNodeLint());
    const counts = lairCounts(demo);
    expect(counts.boss).toBe(demo.stats.bySeverity.boss);
    expect(counts.champion).toBeGreaterThanOrEqual(1);
    expect(counts.champion).toBeLessThanOrEqual(2);
  });
});

describe("compassName", () => {
  it("names the eight directions, with north up the screen", () => {
    expect(compassName(5, 0)).toBe("east");
    expect(compassName(0, 5)).toBe("south");
    expect(compassName(-5, 0)).toBe("west");
    expect(compassName(0, -5)).toBe("north");
    expect(compassName(4, -4)).toBe("north-east");
    expect(compassName(-4, 4)).toBe("south-west");
    expect(compassName(10, -1)).toBe("east");
  });
});
