import { describe, expect, it } from "vitest";
import { ruleInfo } from "@/lib/analysis/rules";
import { MONSTERS } from "@/lib/game/catalog";
import {
  CRITICAL_FIX_XP_MULTIPLIER,
  WRONG_ANSWER_RULES,
  criticalFixBonusXp,
  finisherOptions,
  hasFinisher,
  recordCriticalFix,
} from "@/lib/game/finisher";
import { MAX_XP } from "@/lib/game/store";
import type { Finding, FindingCategory, Severity } from "@/lib/types";
import { deepFreeze, makeFinding, saveWith } from "./helpers";

/** A finding for a real Ruff rule, with the title, tip, category and monster the rule table gives it. */
function findingFor(code: string, line = 7, path = "shop.py"): Finding {
  const info = ruleInfo(code);
  return makeFinding(path, line, info.monster, { code, title: info.title, tip: info.tip, category: info.category, severity: info.severity });
}

/** The two wrong answers' texts. */
function wrongTexts(finding: Finding): string[] {
  return finisherOptions(finding)
    .filter((option) => !option.correct)
    .map((option) => option.text);
}

const CATEGORIES: readonly FindingCategory[] = ["unused", "todo", "style", "bug", "trap", "error-handling", "complexity", "security", "syntax"];
const SEVERITIES: readonly Severity[] = ["minion", "elite", "boss"];

describe("hasFinisher", () => {
  it("is for elites and bosses only", () => {
    expect(hasFinisher("minion")).toBe(false);
    expect(hasFinisher("elite")).toBe(true);
    expect(hasFinisher("boss")).toBe(true);
  });
});

describe("finisherOptions", () => {
  it("offers three different answers, exactly one of them the finding's own tip", () => {
    const finding = findingFor("B006");
    const options = finisherOptions(finding);
    expect(options).toHaveLength(3);
    expect(new Set(options.map((o) => o.text)).size).toBe(3);
    expect(options.filter((o) => o.correct)).toEqual([{ text: finding.tip, correct: true }]);
  });

  it("gives the same order every time for the same finding", () => {
    const finding = findingFor("S307", 12);
    expect(finisherOptions(finding)).toEqual(finisherOptions(structuredClone(finding)));
  });

  it("puts the right answer in every position across different findings", () => {
    const positions = new Set<number>();
    for (let line = 1; line <= 30; line++) positions.add(finisherOptions(findingFor("F821", line)).findIndex((o) => o.correct));
    expect([...positions].sort()).toEqual([0, 1, 2]);
  });

  it("borrows wrong answers from the same category first (believable, not random)", () => {
    const sameCategory = (category: FindingCategory) => WRONG_ANSWER_RULES.map(ruleInfo).filter((r) => r.category === category).map((r) => r.tip);
    for (const code of ["B006", "E722", "C901", "S105", "F401"]) {
      const finding = findingFor(code);
      for (const text of wrongTexts(finding)) expect(sameCategory(finding.category)).toContain(text);
    }
  });

  it("falls back to the same severity when the category has no other rule (syntax errors)", () => {
    const finding = findingFor("SYNTAX");
    const bossTips = WRONG_ANSWER_RULES.map(ruleInfo).filter((r) => r.severity === "boss").map((r) => r.tip);
    for (const text of wrongTexts(finding)) expect(bossTips).toContain(text);
  });

  it("never offers the finding's own rule as a wrong answer, even when its tip was reworded", () => {
    const finding = { ...findingFor("F401"), tip: "Remove the import nobody uses." };
    expect(wrongTexts(finding)).not.toContain(ruleInfo("F401").tip);
  });

  it("still works for a rule the table does not know", () => {
    const finding = makeFinding("lab.py", 3, "gremlin", { code: "XYZ123", tip: "Read the message and double-check this line.", category: "bug" });
    const options = finisherOptions(finding);
    expect(options).toHaveLength(3);
    expect(new Set(options.map((o) => o.text)).size).toBe(3);
    expect(options.find((o) => o.correct)?.text).toBe(finding.tip);
  });

  it("always has three distinct answers, for every borrowed rule and every category × severity", () => {
    const findings = [
      ...WRONG_ANSWER_RULES.map((code) => findingFor(code)),
      ...CATEGORIES.flatMap((category) =>
        SEVERITIES.map((severity) => makeFinding("odd.py", 1, "gremlin", { code: `ODD-${category}-${severity}`, category, severity, tip: ruleInfo("F401").tip })),
      ),
    ];
    for (const finding of findings) {
      const texts = finisherOptions(finding).map((o) => o.text);
      expect(new Set(texts).size, finding.code).toBe(3);
      expect(texts.filter((t) => t === finding.tip), finding.code).toHaveLength(1);
    }
  });
});

describe("recordCriticalFix", () => {
  it("adds the bonus XP and counts the right pick, without touching the input", () => {
    const save = deepFreeze(saveWith({ xp: 100 }));
    const next = recordCriticalFix(save, { monster: "gremlin" });
    expect(next.xp).toBe(100 + criticalFixBonusXp("gremlin"));
    expect(next.stats.fixesPicked).toBe(1);
    expect(next.stats.bugsSquashed).toBe(save.stats.bugsSquashed);
    expect(save.stats.fixesPicked).toBe(0);
  });

  it(`pays ${CRITICAL_FIX_XP_MULTIPLIER}× the monster's XP in total (its usual XP comes with the defeat)`, () => {
    expect(criticalFixBonusXp("keyThief")).toBe(MONSTERS.keyThief.xp * (CRITICAL_FIX_XP_MULTIPLIER - 1));
  });

  it("never pushes XP past MAX_XP", () => {
    expect(recordCriticalFix(saveWith({ xp: MAX_XP - 1 }), { monster: "glitchKing" }).xp).toBe(MAX_XP);
  });
});
