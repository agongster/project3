/**
 * Monster looks (src/lib/game/monsterLooks.ts) and modifiers
 * (src/lib/game/monsterModifiers.ts): deterministic per finding, the same
 * rule always wearing the same colours, bounded, varied, and never making
 * a fight harder on average.
 */
import { describe, expect, it } from "vitest";
import { ruleInfo } from "@/lib/analysis/rules";
import { traitBehaviour } from "@/lib/analysis/traits";
import { MONSTERS } from "@/lib/game/catalog";
import { codeFromId, familiesMet, familyFor, LOOK_FAMILIES, LOOK_FEATURES, LOOK_MARKINGS, lookOf, MARKED_KINDS } from "@/lib/game/monsterLooks";
import { ARCHETYPE_MODIFIERS, MODIFIER_CHANCE, MODIFIER_CLASHES, MODIFIER_IDS, MODIFIERS, modifiedHp, modifierOf } from "@/lib/game/monsterModifiers";
import { MONSTER_KINDS, type Finding } from "@/lib/types";
import { saveWith } from "./helpers";

/** A finding of a real rule code at a line (the id carries the line, like Ruff's findings). */
function finding(code: string, line: number, path = "shop.py"): Pick<Finding, "id" | "code" | "monster" | "severity"> {
  const info = ruleInfo(code);
  return { id: `${path}:${line}:5:${code}`, code, monster: info.monster, severity: info.severity };
}

/** Every rule code named in the look tables, with its species. */
const TABLE_CODES = MONSTER_KINDS.flatMap((kind) => LOOK_FAMILIES[kind].flatMap((family) => (family.codes ?? []).map((code) => ({ kind, code }))));

describe("monster looks", () => {
  it("only lists rule codes that really become that species", () => {
    for (const { kind, code } of TABLE_CODES) expect(`${code} → ${ruleInfo(code).monster}`).toBe(`${code} → ${kind}`);
  });

  it("lists every code once per species, so a rule has exactly one family", () => {
    for (const kind of MONSTER_KINDS) {
      const codes = LOOK_FAMILIES[kind].flatMap((f) => f.codes ?? []);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  it("tells an unused import from an unused variable at a glance", () => {
    expect(familyFor("dustBunny", "F401")).toBe(0);
    expect(familyFor("dustBunny", "F841")).toBe(1);
    expect(familyFor("dustBunny", "B007")).toBe(2);
    expect(familyFor("echoBat", "SIM118")).toBe(familyFor("echoBat", "SIM999")); // prefix
    expect(familyFor("glitchKing", "SYNTAX")).toBe(0);
    expect(familyFor("glitchKing", "F706")).toBe(1);
  });

  it("gives the same rule the same colours everywhere, and the same finding the same look", () => {
    for (let line = 1; line < 60; line++) {
      expect(lookOf(finding("F841", line)).family).toBe(1);
      expect(lookOf(finding("F841", line))).toEqual(lookOf(finding("F841", line)));
    }
  });

  it("keeps every number inside its table, and bosses at their tuned size", () => {
    const codes = ["F401", "F841", "FIX002", "ERA001", "SIM118", "E711", "F632", "B002", "F821", "B006", "A001", "E722", "C901", "PLR0913", "S105", "S307", "SYNTAX", "ZZZ9", "S999"];
    for (const code of codes) {
      for (let line = 1; line < 40; line++) {
        const f = finding(code, line);
        const look = lookOf(f);
        expect(look.family).toBeGreaterThanOrEqual(0);
        expect(look.family).toBeLessThan(LOOK_FAMILIES[f.monster].length);
        expect(look.feature).toBeLessThan(LOOK_FEATURES[f.monster].length);
        expect(look.marking).toBeLessThan(MARKED_KINDS.has(f.monster) ? LOOK_MARKINGS.length : 1);
        expect([-1, 0, 1]).toContain(look.sizeStep);
        if (f.severity === "boss") expect(look.sizeStep).toBe(0);
      }
    }
  });

  it("rarely dresses two findings of one rule alike", () => {
    const looks = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(lookOf(finding("F401", i + 1)))));
    expect(looks.size).toBeGreaterThanOrEqual(15);
  });

  it("reads the code back out of a finding id, and the families met out of the save", () => {
    expect(codeFromId("src/a:b.py:12:5:F401")).toBe("F401");
    const save = saveWith({
      repos: {
        "a/b@1": { defeated: ["x.py:1:1:F401", "x.py:2:1:F841"], cleared: [], opened: [], milestones: [], fixes: ["y.py:3:1:B007"] },
        "c/d@2": { defeated: ["z.py:4:1:F401", "z.py:5:1:SYNTAX"], cleared: [], opened: [], milestones: [] },
      },
    });
    const met = familiesMet(save);
    expect([...(met.get("dustBunny") ?? [])].sort()).toEqual([0, 1, 2]);
    expect([...(met.get("glitchKing") ?? [])]).toEqual([0]);
    expect(met.has("gremlin")).toBe(false);
  });
});

describe("monster modifiers", () => {
  /** Ordinary findings of every species (no bosses), many lines each. */
  const many = ["F401", "FIX002", "SIM118", "E711", "F632", "F821", "B006", "B023", "E722", "C901"].flatMap((code) => Array.from({ length: 40 }, (_, i) => finding(code, i + 1)));

  it("is deterministic per finding", () => {
    for (const f of many) expect(modifierOf(f)).toBe(modifierOf(f));
  });

  it("gives about MODIFIER_CHANCE of the monsters that may have one a modifier, and uses every modifier", () => {
    const eligible = many.filter((f) => traitBehaviour(f) !== "echoTwin");
    const given = eligible.map((f) => modifierOf(f)).filter((m) => m !== null);
    const share = given.length / eligible.length;
    expect(share).toBeGreaterThan(MODIFIER_CHANCE - 0.15);
    expect(share).toBeLessThan(MODIFIER_CHANCE + 0.15);
    expect(new Set(given)).toEqual(new Set(MODIFIER_IDS));
  });

  it("never goes on bosses or champions, nor against a trait or an archetype's act", () => {
    for (const code of ["S105", "S307", "SYNTAX"]) for (let line = 1; line < 30; line++) expect(modifierOf(finding(code, line))).toBeNull();
    for (const f of many) {
      expect(modifierOf(f, true)).toBeNull();
      const id = modifierOf(f);
      if (!id) continue;
      const behaviour = traitBehaviour(f);
      if (behaviour) expect(MODIFIER_CLASHES[behaviour] ?? []).not.toContain(id);
      const allowed = ARCHETYPE_MODIFIERS[MONSTERS[f.monster].archetype];
      if (allowed) expect(allowed).toContain(id);
    }
  });

  it("never leaves a monster without health", () => {
    for (const id of MODIFIER_IDS) for (const hp of [1, 2, 9, 39]) expect(modifiedHp(hp, id)).toBeGreaterThanOrEqual(1);
    expect(modifiedHp(9, null)).toBe(9);
  });

  it("gives with one hand what it takes with the other: no modifier makes a monster much more dangerous", () => {
    // Danger ≈ how long it lasts (health) × how fast it closes in (speed) × how far its bump reaches.
    const danger = (id: (typeof MODIFIER_IDS)[number]) => MODIFIERS[id].hp * MODIFIERS[id].speed * MODIFIERS[id].reach;
    for (const id of MODIFIER_IDS) expect(danger(id), id).toBeLessThanOrEqual(1.1);
    const average = MODIFIER_IDS.reduce((sum, id) => sum + danger(id), 0) / MODIFIER_IDS.length;
    expect(average).toBeLessThanOrEqual(1);
  });
});
