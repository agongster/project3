/**
 * End to end with the real workspace and the real linter: forge actual edits
 * into the Demo Kingdom, pay them with applyForge, feed the real reports and
 * the resulting analysis through settleQuests, and check that exactly the
 * right quests, streak changes and achievements happen.
 */
import { describe, expect, it } from "vitest";
import { repoKey } from "@/game/bridge";
import { applyForge } from "@/lib/game/forge";
import { getProgress } from "@/lib/game/progress";
import { settleQuests } from "@/lib/game/questsSettle";
import type { QuestNewsItem } from "@/lib/game/questsSettle";
import { defaultSave } from "@/lib/game/store";
import type { SaveData } from "@/lib/types";
import type { Workspace } from "@/lib/workspace";
import { demoSource, openDemo } from "../workspace/helpers";

/** What the game does after a forge: pay the fix, then settle quests with who was fought before it. */
async function forge(workspace: Workspace, save: SaveData, path: string, text: string) {
  const key = repoKey(workspace.analysis.get());
  const report = await workspace.forge(path, text);
  const paid = applyForge(save, key, report).save;
  const settled = settleQuests(paid, key, workspace.analysis.get(), report, getProgress(save, key).defeated);
  return { report, ...settled };
}

const questTitles = (news: QuestNewsItem[]) => news.flatMap((item) => (item.type === "quest" ? [item.quest.title] : []));
const badges = (news: QuestNewsItem[]) => news.flatMap((item) => (item.type === "achievement" ? [item.achievement.id] : []));

describe("quests with the real workspace", () => {
  it("a real docstring and a real fix complete exactly their quests", async () => {
    const workspace = await openDemo();
    const key = repoKey(workspace.analysis.get());
    let save = settleQuests(defaultSave(), key, workspace.analysis.get(), null).save;
    const board = getProgress(save, key).quests!.active;
    expect(board.map((spec) => spec.id)).toContain("document:potions/labels.py:make_printers");

    // 1. A docstring for a *different* function first: nothing completes.
    const otherDoc = demoSource("tools/inventory.py").replace("def merge_shelves(*shelves):\n", 'def merge_shelves(*shelves):\n    """Add up several shelves."""\n');
    let step = await forge(workspace, save, "tools/inventory.py", otherDoc);
    expect(questTitles(step.news)).toEqual([]);
    save = step.save;

    // 2. The docstring the quest asks for.
    const labels = demoSource("potions/labels.py").replace("def make_printers(colors):\n", 'def make_printers(colors):\n    """One label printer per ink colour."""\n');
    step = await forge(workspace, save, "potions/labels.py", labels);
    expect(questTitles(step.news)).toEqual(["Document make_printers() in potions/labels.py"]);
    expect(step.news.some((item) => item.type === "streak")).toBe(false); // no finding fixed: the streak is untouched
    expect(badges(step.news)).toEqual(["first-quest"]);
    save = step.save;

    // 3. A blank line above the unused import: the fix quest stays open (only its line moved).
    const fixQuest = getProgress(save, key).quests!.active.find((spec) => spec.kind === "fix" && spec.path === "bakery/recipes.py");
    expect(fixQuest).toBeDefined();
    const shifted = demoSource("bakery/recipes.py").replace("import os\n", "\nimport os\n");
    step = await forge(workspace, save, "bakery/recipes.py", shifted);
    expect(questTitles(step.news)).toEqual([]);
    save = step.save;

    // 4. The real fix: the import is gone. Quest, streak and "First Real Fix" all at once.
    const coinsBefore = save.coins;
    step = await forge(workspace, save, "bakery/recipes.py", demoSource("bakery/recipes.py").replace("import os\n", ""));
    expect(step.report.fixed.map((f) => f.code)).toEqual(["F401"]);
    expect(questTitles(step.news)).toEqual(["Remove the unused import at line 3 of bakery/recipes.py"]);
    expect(step.news).toContainEqual({ type: "streak", streak: 1, reward: { coins: 0, xp: 0 } });
    expect(badges(step.news)).toEqual(["first-fix"]);
    expect(step.save.stats.realFixes).toBe(1);
    expect(step.save.coins).toBeGreaterThan(coinsBefore + step.coins); // the fix itself paid too (applyForge)

    // 5. The same settle again pays nothing.
    const again = settleQuests(step.save, key, workspace.analysis.get(), step.report);
    expect(again.save).toBe(step.save);
    save = step.save;

    // 6. Mend the Key Thief boss and the FIXME in config.py without fighting: a clean forge ×2, purified by hand.
    const config = demoSource("config.py")
      .replace('"""Shop settings. Please don\'t read this file out loud."""\n', '"""Shop settings. Please don\'t read this file out loud."""\n\nimport os\n')
      .replace('ADMIN_PASSWORD = "sugarplum123"', 'ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")')
      .replace("# FIXME: the dragon discount should not be negative.\n", "");
    step = await forge(workspace, save, "config.py", config);
    expect(step.report.introduced).toEqual([]);
    expect(step.report.purified).toBe(true);
    expect(step.news).toContainEqual({ type: "streak", streak: 2, reward: { coins: 5, xp: 0 } });
    expect(badges(step.news)).toEqual(expect.arrayContaining(["hand-purified", "boss-mended"]));
    // Three real fixes so far: the "fix any 2 bugs" chore, posted when there were none, is done.
    expect(questTitles(step.news)).toContain("Fix any 2 bugs for real");
    save = step.save;

    // 7. A forge that adds a bug ends the streak, with no other penalty.
    const coins = save.coins;
    step = await forge(workspace, save, "main.py", `import json\n${demoSource("main.py")}`);
    expect(step.report.introduced.length).toBeGreaterThan(0);
    expect(step.news).toContainEqual({ type: "streakLost", streak: 2 });
    expect(step.save.workshop?.streak).toBe(0);
    expect(step.save.coins).toBeGreaterThanOrEqual(coins);

    workspace.dispose();
  });

  it("a boss fought before its code is fixed does not count as mended", async () => {
    const workspace = await openDemo();
    const key = repoKey(workspace.analysis.get());
    const boss = workspace.analysis.get().files.find((f) => f.path === "config.py")!.findings.find((f) => f.severity === "boss")!;
    let save = settleQuests(defaultSave(), key, workspace.analysis.get(), null).save;
    save = { ...save, repos: { ...save.repos, [key]: { ...getProgress(save, key), defeated: [boss.id] } } };
    const config = demoSource("config.py").replace('ADMIN_PASSWORD = "sugarplum123"', "ADMIN_PASSWORD = None");
    const step = await forge(workspace, save, "config.py", config);
    expect(step.report.fixed.map((f) => f.id)).toContain(boss.id);
    expect(badges(step.news)).not.toContain("boss-mended");
    workspace.dispose();
  });

  it("breaking a file's syntax (which hides Ruff's other findings) completes no quest", async () => {
    const workspace = await openDemo();
    const key = repoKey(workspace.analysis.get());
    const save = settleQuests(defaultSave(), key, workspace.analysis.get(), null).save;
    const broken = demoSource("bakery/recipes.py").replace("    return scaled\n", "    return scaled(\n");
    const step = await forge(workspace, save, "bakery/recipes.py", broken);
    expect(step.report.introduced.map((f) => f.code)).toContain("SYNTAX");
    expect(questTitles(step.news)).toEqual([]);
    workspace.dispose();
  });
});
