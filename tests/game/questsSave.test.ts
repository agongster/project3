/**
 * Loading quest boards and the Workshop record from localStorage: old saves
 * load unchanged, valid ones round-trip, and hostile or oversized data is
 * cleaned and bounded.
 */
import { describe, expect, it } from "vitest";
import { analyzeDemoSources } from "@/lib/analysis/demo";
import { getProgress } from "@/lib/game/progress";
import { MAX_DONE_QUESTS, MAX_RECENT_QUESTS, QUEST_BOARD_SIZE } from "@/lib/game/quests";
import { sanitizeQuestSpec, sanitizeRepoQuests, sanitizeWorkshop } from "@/lib/game/questsSave";
import { settleQuests } from "@/lib/game/questsSettle";
import type { QuestSpec } from "@/lib/game/questsTypes";
import { defaultSave, sanitizeSave } from "@/lib/game/store";
import { createNodeLint } from "../analysis/nodeLint";
import { expectValidSave, KEY, saveWith } from "./helpers";

const demo = analyzeDemoSources(createNodeLint());

/** A save that has posted a board, completed nothing yet, and earned a badge. */
function playedSave() {
  const save = saveWith({ stats: { ...defaultSave().stats, bugsSquashed: 3 } });
  return settleQuests(save, KEY, demo, null).save;
}

const fixSpec = (): QuestSpec => getProgress(playedSave(), KEY).quests!.active[0];

describe("sanitizeSave with Workshop fields", () => {
  it("loads a save from before the Workshop unchanged (no new fields appear)", () => {
    const old = saveWith({ coins: 40 });
    const loaded = sanitizeSave(JSON.parse(JSON.stringify(old)));
    expect(loaded).toEqual(old);
    expect("workshop" in loaded).toBe(false);
  });

  it("round-trips a played save through JSON", () => {
    const save = playedSave();
    expect(save.workshop?.achievements).toEqual(["first-squash"]);
    const loaded = sanitizeSave(JSON.parse(JSON.stringify(save)));
    expect(loaded).toEqual(save);
    expectValidSave(loaded);
  });

  it("drops damaged fields instead of failing", () => {
    const save = JSON.parse(JSON.stringify(playedSave()));
    save.workshop = "lots of achievements";
    save.repos[KEY].quests = 7;
    const loaded = sanitizeSave(save);
    expect(loaded.workshop).toBeUndefined();
    expect(getProgress(loaded, KEY).quests).toBeUndefined();
    expectValidSave(loaded);
  });
});

describe("sanitizeQuestSpec", () => {
  it("keeps a valid spec and drops one whose id does not match its contents", () => {
    const spec = fixSpec();
    expect(sanitizeQuestSpec(JSON.parse(JSON.stringify(spec)))).toEqual(spec);
    expect(sanitizeQuestSpec({ ...spec, lineText: "import sys" })).toBeNull();
    expect(sanitizeQuestSpec({ ...spec, id: "fix:somewhere-else" })).toBeNull();
  });

  it("drops unknown kinds, bad enums, out-of-range numbers and over-long text", () => {
    const spec = fixSpec();
    expect(sanitizeQuestSpec({ ...spec, kind: "conquer" })).toBeNull();
    expect(sanitizeQuestSpec({ ...spec, monster: "dragon" })).toBeNull();
    expect(sanitizeQuestSpec({ ...spec, line: -3 })).toBeNull();
    expect(sanitizeQuestSpec({ ...spec, path: "x".repeat(5000) })).toBeNull();
    expect(sanitizeQuestSpec({ ...spec, message: "m".repeat(5000) })).toBeNull();
    expect(sanitizeQuestSpec({ kind: "grade", id: "grade:a.py:S", path: "a.py", from: "C", to: "S" })).toBeNull();
    expect(sanitizeQuestSpec({ kind: "purify", id: "purify:a.py", path: "a.py", bugs: 1e9 })).toBeNull();
    expect(sanitizeQuestSpec({ kind: "tidy", id: "tidy:1", path: "a.py", task: "hack", round: 1, baseline: 0, goal: 1 })).toBeNull();
    for (const junk of [null, 4, "fix", [], { __proto__: { kind: "fix" } }]) expect(sanitizeQuestSpec(junk)).toBeNull();
  });

  it("accepts each kind when it is well-formed", () => {
    const specs: QuestSpec[] = [
      { kind: "document", id: "document:a.py:Shop.open", path: "a.py", name: "Shop.open", defKind: "method", line: 12 },
      { kind: "grade", id: "grade:a.py:B", path: "a.py", from: "C", to: "B" },
      { kind: "purify", id: "purify:a.py", path: "a.py", bugs: 2 },
      { kind: "tidy", id: "tidy:4", path: "a.py", task: "comment", round: 4, baseline: 3, goal: 1 },
    ];
    for (const spec of specs) expect(sanitizeQuestSpec(spec)).toEqual(spec);
  });
});

describe("sanitizeRepoQuests", () => {
  it("bounds every list: the board, completed ids and recent quests", () => {
    const spec = fixSpec();
    const tidy = (round: number): QuestSpec => ({ kind: "tidy", id: `tidy:${round}`, path: "a.py", task: "comment", round, baseline: 0, goal: 1 });
    const documents = Array.from({ length: 50 }, (_, i): QuestSpec => ({ kind: "document", id: `document:a.py:f${i}`, path: "a.py", name: `f${i}`, defKind: "function", line: i + 1 }));
    const quests = sanitizeRepoQuests({
      active: [tidy(3), ...documents, spec, spec, tidy(2)],
      done: [...Array.from({ length: 5000 }, (_, i) => `document:a.py:f${i}`), 42, "", "x".repeat(10_000)],
      recent: documents,
      tidyRounds: 1,
    })!;
    expect(quests.active).toHaveLength(QUEST_BOARD_SIZE);
    expect(quests.active.at(-1)).toEqual(tidy(3));
    expect(quests.active.filter((s) => s.kind === "tidy")).toHaveLength(1);
    expect(quests.done).toHaveLength(MAX_DONE_QUESTS);
    expect(quests.done.at(-1)).toBe("document:a.py:f4999");
    expect(quests.recent).toHaveLength(MAX_RECENT_QUESTS);
    // The counter is lifted past every chore already numbered, so the next one gets a fresh id.
    expect(quests.tidyRounds).toBe(3);
  });

  it("returns undefined when there is no board, and an empty board for an empty object", () => {
    expect(sanitizeRepoQuests(undefined)).toBeUndefined();
    expect(sanitizeRepoQuests("board")).toBeUndefined();
    expect(sanitizeRepoQuests({})).toEqual({ active: [], done: [], recent: [], tidyRounds: 0 });
  });
});

describe("sanitizeWorkshop", () => {
  it("clamps numbers, keeps only known achievements once, and checks the forge fingerprint", () => {
    const workshop = sanitizeWorkshop({
      streak: 4.7,
      bestStreak: 2,
      lastForge: "<script>",
      counts: { lostField: Infinity, handPurified: -5, bossesMended: "9", raisedToS: 1e15, questsDone: 3, lanternsLit: null },
      achievements: ["first-fix", "first-fix", "be-a-hacker", 7, "__proto__", "restored"],
    })!;
    expect(workshop).toEqual({
      streak: 4,
      bestStreak: 4,
      lastForge: "",
      counts: { handPurified: 0, bossesMended: 0, raisedToS: 999_999_999, questsDone: 3, lanternsLit: 0 },
      achievements: ["first-fix", "restored"],
    });
    expect(sanitizeWorkshop({ lastForge: "1z141z3" })?.lastForge).toBe("1z141z3");
    expect(sanitizeWorkshop(null)).toBeUndefined();
  });
});
