/**
 * The trait table: which rule codes get which behaviour, that the data
 * agrees with the rule → monster table, and that the lines read right on
 * the real demo kingdom (linted with the real Ruff).
 */
import { describe, expect, it } from "vitest";
import { analyzeDemoSources } from "@/lib/analysis/demo";
import { ruleInfo } from "@/lib/analysis/rules";
import { TRAITS_BY_CODE, traitBehaviour, traitLine, type TraitBehaviour } from "@/lib/analysis/traits";
import type { Finding, MonsterKind } from "@/lib/types";
import { createNodeLint } from "./nodeLint";

const demo = analyzeDemoSources(createNodeLint());
const demoFindings = demo.files.flatMap((f) => f.findings);
const demoFinding = (code: string) => demoFindings.find((f) => f.code === code)!;

/** Behaviours that only make sense on one kind of monster's body. */
const BEHAVIOUR_KIND: Partial<Record<TraitBehaviour, MonsterKind>> = {
  undefinedName: "phantom",
  swallowsShots: "swallowToad",
  echoTwin: "echoBat",
  squeaksNote: "todoMite",
  wearsName: "mimic",
  noodles: "spaghetti",
};

describe("trait table", () => {
  it("only gives a body-specific behaviour to codes that become that monster", () => {
    for (const [code, row] of Object.entries(TRAITS_BY_CODE)) {
      const kind = row.behaviour ? BEHAVIOUR_KIND[row.behaviour] : undefined;
      if (kind) expect(`${code} → ${ruleInfo(code).monster}`).toBe(`${code} → ${kind}`);
    }
  });

  it("only twins minions (they are never dazed, so one finding still has one defeat)", () => {
    for (const [code, row] of Object.entries(TRAITS_BY_CODE)) {
      if (row.behaviour === "echoTwin") expect(ruleInfo(code).severity).toBe("minion");
    }
  });

  it("keys behaviours on the rule code, falling back to the monster", () => {
    expect(traitBehaviour({ code: "B006", monster: "mimic" })).toBe("growsWhenHit");
    expect(traitBehaviour({ code: "B023", monster: "mimic" })).toBeNull(); // the mimic's usual ambush already fits
    expect(traitBehaviour({ code: "SIM118", monster: "echoBat" })).toBe("echoTwin");
    expect(traitBehaviour({ code: "E711", monster: "echoBat" })).toBeNull(); // `== None` says nothing twice
    expect(traitBehaviour({ code: "BLE999", monster: "swallowToad" })).toBe("swallowsShots");
    expect(traitBehaviour({ code: "F632", monster: "gremlin" })).toBeNull();
  });

  it("has no line for a monster that fights the plain way", () => {
    const plain: Pick<Finding, "code" | "monster" | "message" | "snippet"> = { code: "E711", monster: "echoBat", message: "", snippet: [] };
    expect(traitLine(plain)).toBeNull();
  });

  it("keeps every line short and free of unfilled placeholders", () => {
    for (const f of demoFindings) {
      const line = traitLine(f);
      if (!line) continue;
      expect(line.length).toBeLessThanOrEqual(170);
      expect(line).not.toContain("{name}");
    }
  });
});

describe("trait lines on the demo kingdom", () => {
  it("names the undefined name, the unused import and the shadowed builtin", () => {
    expect(traitLine(demoFinding("F821"))).toContain("`PRICES`");
    expect(traitLine(demoFinding("F401"))).toContain("`import os`");
    expect(traitLine(demoFinding("F841"))).toContain("= …`");
    expect(traitLine(demoFinding("A001"))).toContain("`list`");
    expect(traitLine(demoFinding("S105"))).toContain("`ADMIN_PASSWORD`");
  });

  it("shows off every one of the owner's five traits", () => {
    const behaviours = new Set(demoFindings.map((f) => traitBehaviour(f)));
    for (const b of ["undefinedName", "growsWhenHit", "swallowsShots", "echoTwin", "leavesName"] as const) expect(behaviours).toContain(b);
  });
});
