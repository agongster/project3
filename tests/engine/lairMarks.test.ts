/**
 * Boss lairs in the village, as words: the building label, the door prompt,
 * the village rumour and the town guide's live line (which counts what is
 * still alive and points at the nearest lair).
 */
import { describe, expect, it } from "vitest";
import { measureText } from "@/game/art/font";
import { guideLineFor, guideOf, lairDoorPrompt, lairLabelText, lairWho, withLairLine } from "@/game/ui/lairMarks";
import { ruleInfo } from "@/lib/analysis/rules";
import { emptyProgress } from "@/lib/game/progress";
import { guideLairLine, lairRumour } from "@/lib/worldgen/villagers";
import type { AnalyzedFile, Finding, SaveData } from "@/lib/types";
import { makeFile, makeFinding, saveWith } from "../game/helpers";

const REPO_KEY = "a/b@1";

function real(path: string, line: number, code: string): Finding {
  const info = ruleInfo(code);
  return makeFinding(path, line, info.monster, { code, id: `${path}:${line}:1:${code}`, severity: info.severity, category: info.category, title: info.title });
}

const vault: AnalyzedFile = makeFile("vault.py", { findings: [real("vault.py", 4, "S105"), real("vault.py", 9, "F401")] });
const shop: AnalyzedFile = makeFile("shop.py", { findings: [real("shop.py", 3, "F401"), real("shop.py", 9, "FIX002"), real("shop.py", 14, "B006"), real("shop.py", 20, "F632")] });
const tiny: AnalyzedFile = makeFile("tiny.py", { findings: [real("tiny.py", 1, "F401")] });

/** The guide stands at the origin; the vault is far north-east, the shop a little west. */
const PLACES = [
  { file: vault, doorX: 300, doorY: -300 },
  { file: shop, doorX: -100, doorY: 0 },
  { file: tiny, doorX: 5, doorY: 5 },
];

function saveDefeating(ids: string[]): SaveData {
  return saveWith({ repos: { [REPO_KEY]: { ...emptyProgress(), defeated: ids } } });
}

describe("lair words", () => {
  it("names who lives in a lair", () => {
    expect(lairWho({ kind: "boss", finding: real("vault.py", 4, "S105") })).toBe("Key Thief");
    expect(lairWho({ kind: "champion", finding: real("shop.py", 20, "F632") })).toBe("Champion Gremlin");
  });

  it("labels a lair building with its monster, never wider than the label limit", () => {
    expect(lairLabelText("vault.py", null)).toBe("vault.py");
    expect(lairLabelText("vault.py", { kind: "boss", finding: real("vault.py", 4, "S105") })).toBe("vault.py · Key Thief");
    const long = lairLabelText("a_really_long_module_name_that_goes_on.py", { kind: "champion", finding: real("x.py", 1, "C901") });
    expect(measureText(long)).toBeLessThanOrEqual(170);
    expect(lairDoorPrompt("vault.py", { kind: "boss", finding: real("vault.py", 4, "S105") })).toBe("Enter vault.py — the Key Thief lurks inside!");
  });

  it("spreads the rumour of bosses and champions with proper English", () => {
    expect(lairRumour({ boss: 0, champion: 0 })).toBe("No bosses around here, thank goodness. Just small fry!");
    expect(lairRumour({ boss: 1, champion: 0 })).toBe("Rumour has it a boss lurks in the dungeons. Brrr!");
    expect(lairRumour({ boss: 2, champion: 1 })).toBe("Rumour has it 2 bosses and a champion lurk in the dungeons. Brrr!");
    expect(lairRumour({ boss: 0, champion: 3 })).toBe("Rumour has it 3 champions lurk in the dungeons. Brrr!");
  });
});

describe("the town guide's lair line", () => {
  it("says how many are left and points at the nearest", () => {
    const line = guideLineFor(PLACES, { x: 0, y: 0 }, saveDefeating([]), REPO_KEY);
    expect(line).toBe("A boss and a champion still lurk here. The nearest, the Champion Gremlin, hides in shop.py to the west. Look for the red and gold banners by the houses!");
  });

  it("forgets the ones already beaten", () => {
    const line = guideLineFor(PLACES, { x: 0, y: 0 }, saveDefeating(["shop.py:20:1:F632"]), REPO_KEY);
    expect(line).toContain("A boss still lurks here.");
    expect(line).toContain("the Key Thief, hides in vault.py to the north-east");
    expect(guideLineFor(PLACES, { x: 0, y: 0 }, saveDefeating(["shop.py:20:1:F632", "vault.py:4:1:S105"]), REPO_KEY)).toBe(
      "Every boss and champion here has been beaten. The land owes you one, hero!",
    );
  });

  it("has a cheerful line for a land without lairs, and says 'right next to me' up close", () => {
    expect(guideLineFor([{ file: tiny, doorX: 0, doorY: 0 }], { x: 0, y: 0 }, saveDefeating([]), REPO_KEY)).toBe("No bosses or champions in this land, just small fry. Have fun!");
    expect(guideLairLine({ boss: 1, champion: 0 }, { boss: 1, champion: 0 }, { name: "Key Thief", path: "vault.py", direction: null })).toContain("right next to me");
  });

  it("clips a long path, keeping the file name", () => {
    const line = guideLairLine({ boss: 1, champion: 0 }, { boss: 1, champion: 0 }, { name: "Key Thief", path: `${"deep/".repeat(20)}vault.py`, direction: "south" });
    expect(line).toContain("…");
    expect(line).toContain("vault.py to the south");
    expect(line.length).toBeLessThan(160);
  });

  it("finds the guide (nearest the spawn) and puts the lair line second", () => {
    const folk = [{ x: 9, y: 9, name: "far" }, { x: 2, y: 1, name: "guide" }];
    expect(guideOf(folk, { x: 1, y: 1 })?.name).toBe("guide");
    expect(guideOf([], { x: 0, y: 0 })).toBeNull();
    expect(withLairLine(["Welcome!", "Tip"], "Lairs")).toEqual(["Welcome!", "Lairs", "Tip"]);
    expect(withLairLine([], "Lairs")).toEqual(["Lairs"]);
  });
});
