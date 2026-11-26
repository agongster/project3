/**
 * Bounties: WANTED notices for a few monsters, chosen deterministically from
 * the repo, paid exactly once, and kind to saves from before bounties existed.
 */
import { describe, expect, it } from "vitest";
import { BOUNTY_REWARD, bountyClue, chooseBounties, isBountyClaimed, MAX_BOUNTIES, MAX_BOUNTY_CODE, settleBounties } from "@/lib/game/bounties";
import { getProgress } from "@/lib/game/progress";
import { MAX_SETTLED_BOUNTIES, sanitizeSave } from "@/lib/game/store";
import type { AnalyzedFile, Finding } from "@/lib/types";
import { deepFreeze, KEY, makeAnalysis, makeFile, makeFinding, saveWith } from "./helpers";

const brewing = makeFile("potions/brewing.py", {
  findings: [
    makeFinding("potions/brewing.py", 9, "evalSerpent", { snippet: [{ n: 9, text: "    return eval(recipe_text, {}, ingredients)", hit: true }] }),
    makeFinding("potions/brewing.py", 14, "keyThief", { code: "S105", snippet: [{ n: 14, text: '    subprocess.run(cmd, shell=True)', hit: true }] }),
  ],
});
const config = makeFile("config.py", { findings: [makeFinding("config.py", 7, "keyThief", { snippet: [{ n: 7, text: 'ADMIN_PASSWORD = "sugarplum123"', hit: true }] })] });
const orders = makeFile("bakery/orders.py", { findings: [makeFinding("bakery/orders.py", 4, "mimic"), makeFinding("bakery/orders.py", 20, "dustBunny")] });
const recipes = makeFile("bakery/recipes.py", { findings: [makeFinding("bakery/recipes.py", 3, "dustBunny")] });
const analysis = makeAnalysis([brewing, config, orders, recipes]);

describe("chooseBounties", () => {
  const bounties = chooseBounties(analysis);

  it(`posts at most ${MAX_BOUNTIES}, toughest first, one per file while other files have monsters`, () => {
    expect(bounties).toHaveLength(MAX_BOUNTIES);
    expect(bounties.map((b) => b.severity)).toEqual(["boss", "boss", "elite"]);
    expect(new Set(bounties.map((b) => b.findingId.split(":")[0])).size).toBe(MAX_BOUNTIES);
    expect(bounties.map((b) => b.findingId)).toContain(orders.findings[0].id);
  });

  it("quotes the real line of code and names only the folder and the line", () => {
    const fromConfig = bounties.find((b) => b.findingId === config.findings[0].id)!;
    expect(fromConfig).toMatchObject({ folder: "", line: 7, code: 'ADMIN_PASSWORD = "sugarplum123"', reward: BOUNTY_REWARD.boss, monster: "keyThief" });
    expect(bountyClue(fromConfig)).toBe("the creature hiding at line 7, somewhere in Town Square");
    const fromBakery = bounties.find((b) => b.findingId === orders.findings[0].id)!;
    expect(bountyClue(fromBakery)).toBe("the creature hiding at line 4, somewhere in bakery/");
  });

  it("is deterministic for a repo, and changes with the commit", () => {
    expect(chooseBounties(analysis)).toEqual(bounties);
    const tied = makeAnalysis(Array.from({ length: 12 }, (_, i) => makeFile(`f${i}.py`, { findings: [makeFinding(`f${i}.py`, 1, "gremlin")] })));
    const picks = (sha: string) => chooseBounties({ ...tied, repo: { ...tied.repo, sha } }).map((b) => b.findingId);
    expect(picks("a".repeat(40))).toEqual(picks("a".repeat(40)));
    const shas = ["a", "b", "c", "d", "e"].map((c) => picks(c.repeat(40)).join());
    expect(new Set(shas).size).toBeGreaterThan(1);
  });

  it("allows two notices in one file only when there are too few files", () => {
    expect(chooseBounties(makeAnalysis([brewing])).map((b) => b.line)).toEqual(expect.arrayContaining([9, 14]));
  });

  it("skips findings without a line of code, ignores failed files, and is empty for a bug-free repo", () => {
    const blank = makeFile("blank.py", { findings: [makeFinding("blank.py", 2, "keyThief", { snippet: [{ n: 2, text: "   ", hit: true }] })] });
    expect(chooseBounties(makeAnalysis([blank]))).toEqual([]);
    expect(chooseBounties(makeAnalysis([{ ...config, status: "failed" } as AnalyzedFile]))).toEqual([]);
    expect(chooseBounties(makeAnalysis([makeFile("clean.py")]))).toEqual([]);
  });

  it("clips hostile code and folders", () => {
    const path = `${"folder/".repeat(50)}evil.py`;
    const snippet = [{ n: 1, text: `\u0000${"x = 1; ".repeat(300)}🍰`, hit: true }];
    const [bounty] = chooseBounties(makeAnalysis([makeFile(path, { findings: [makeFinding(path, 1, "gremlin", { snippet })] })]));
    expect(Array.from(bounty.code).length).toBeLessThanOrEqual(MAX_BOUNTY_CODE);
    expect(bounty.code).not.toContain("\u0000");
    expect(bounty.folder.length).toBeLessThanOrEqual(32);
    expect(bounty.folder.endsWith("folder/")).toBe(true);
  });
});

describe("settleBounties", () => {
  const bounties = chooseBounties(analysis);
  const target: Finding = config.findings[0];
  const defeatedSave = (ids: string[], settled?: string[]) =>
    deepFreeze(saveWith({ coins: 10, repos: { [KEY]: { defeated: ids, cleared: [], opened: [], milestones: [], ...(settled && { bounties: settled }) } } }));

  it("pays each defeated wanted monster once", () => {
    const { save, paid } = settleBounties(defeatedSave([target.id]), KEY, bounties, true);
    expect(paid.map((b) => b.findingId)).toEqual([target.id]);
    expect(save.coins).toBe(10 + BOUNTY_REWARD.boss);
    expect(getProgress(save, KEY).bounties).toEqual([target.id]);
    const again = settleBounties(save, KEY, bounties, true);
    expect(again.save).toBe(save);
    expect(again.paid).toEqual([]);
  });

  it("without pay (old defeats seen for the first time) only marks them settled", () => {
    const before = defeatedSave([target.id]);
    const { save, paid } = settleBounties(before, KEY, bounties, false);
    expect(paid).toEqual([]);
    expect(save.coins).toBe(10);
    expect(isBountyClaimed(getProgress(save, KEY), bounties.find((b) => b.findingId === target.id)!)).toBe(true);
    expect(settleBounties(save, KEY, bounties, true).save).toBe(save);
  });

  it("returns the same save when nothing is due, and ignores defeats that are not wanted", () => {
    const save = defeatedSave([recipes.findings[0].id]);
    expect(settleBounties(save, KEY, bounties, true).save).toBe(save);
    expect(settleBounties(save, "other/repo@1", bounties, true).save).toBe(save);
  });

  it("shows a bounty as claimed once its monster is defeated, even before settling", () => {
    const wanted = bounties[0];
    expect(isBountyClaimed(getProgress(defeatedSave([]), KEY), wanted)).toBe(false);
    expect(isBountyClaimed(getProgress(defeatedSave([wanted.findingId]), KEY), wanted)).toBe(true);
  });
});

describe("saving settled bounties", () => {
  it("loads progress from before bounties existed exactly as it was", () => {
    const old = JSON.parse(JSON.stringify(saveWith({ repos: { [KEY]: { defeated: ["a"], cleared: [], opened: [], milestones: [25] } } })));
    const loaded = sanitizeSave(old);
    expect(loaded).toStrictEqual(old);
    expect("bounties" in loaded.repos[KEY]).toBe(false);
  });

  it("keeps unique ids of a sane length, dropping the oldest beyond the cap", () => {
    const ids = Array.from({ length: MAX_SETTLED_BOUNTIES + 5 }, (_, i) => `f.py:${i}:1:F401`);
    const raw = { repos: { [KEY]: { defeated: [], cleared: [], opened: [], milestones: [], bounties: [...ids, ids[0], 42, null, "", "x".repeat(600)] } } };
    const settled = sanitizeSave(raw).repos[KEY].bounties!;
    expect(settled).toEqual(ids.slice(-MAX_SETTLED_BOUNTIES));
  });
});
