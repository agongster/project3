/**
 * Demo data for the overlay test page: a save that has played for a while
 * (coins, a few items, some bugs squashed) and the requests behind each
 * `?open=` shortcut.
 */
import type { OverlayRequest } from "@/components/overlays/types";
import { defaultSave, withRepoProgress } from "@/lib/game";
import type { RepoAnalysis, SaveData } from "@/lib/types";

/** Items the demo hero already found (besides the starter items every save has). */
const DEMO_OWNED = ["bugNet", "rubberDuck", "refactorHammer", "hotCoffee", "luckyClover", "springBoots", "catEars", "duckling", "sparkleTrail"];

/** Files whose monsters are already defeated in the demo save, so the codex shows a mix of done and to-do. */
const DEMO_CLEARED_FILES = ["bakery/recipes.py", "config.py", "tools/restock.py"];

/** A mid-game save for `analysis`, stored under `key`. */
export function demoSave(analysis: RepoAnalysis, key: string): SaveData {
  const base = defaultSave();
  const cleared = analysis.files.filter((file) => DEMO_CLEARED_FILES.includes(file.path));
  const save: SaveData = {
    ...base,
    created: true,
    coins: 640,
    xp: 210,
    owned: [...base.owned, ...DEMO_OWNED],
    equipped: { weapon: "rubberDuck", hat: "catEars", pet: "duckling", trail: "sparkleTrail", charms: ["hotCoffee", "luckyClover"] },
    gacha: { totalPulls: 12, sinceEpic: 7, sinceLegendary: 12 },
    stats: { bugsSquashed: 10, chestsOpened: 2, dungeonsCleared: 3, wishes: 12 },
  };
  return withRepoProgress(save, key, {
    defeated: cleared.flatMap((file) => file.findings.map((finding) => finding.id)),
    cleared: cleared.map((file) => file.path),
    opened: ["main.py"],
    milestones: [25],
  });
}

/** The same save after every monster in the repo is defeated (for the victory screen). */
export function allClearedSave(save: SaveData, analysis: RepoAnalysis, key: string): SaveData {
  const buggy = analysis.files.filter((file) => file.findings.length > 0);
  const defeated = buggy.flatMap((file) => file.findings.map((finding) => finding.id));
  return withRepoProgress(
    { ...save, xp: 560, stats: { ...save.stats, bugsSquashed: defeated.length, dungeonsCleared: buggy.length, chestsOpened: 14 } },
    key,
    { defeated, cleared: buggy.map((file) => file.path), opened: analysis.files.map((file) => file.path), milestones: [25, 50, 75, 100] },
  );
}

/**
 * The demo kingdom has no clean file graded C, so `chest-c` pretends one
 * `__init__.py` scored badly (with no highlights, to show the fallback reason).
 */
const GRADE_C_PATH = "bakery/__init__.py";

export function withGradeCFile(analysis: RepoAnalysis): RepoAnalysis {
  return {
    ...analysis,
    files: analysis.files.map((file) =>
      file.path === GRADE_C_PATH ? { ...file, quality: { ...file.quality, score: 20, grade: "C", highlights: [] } } : file,
    ),
  };
}

/** How many copies of every buggy file `codex-big` makes (≈ 550 findings, to check the codex stays fast). */
const STRESS_COPIES = 25;

/**
 * The demo repo with every buggy file copied many times into folders
 * copy1/, copy2/, … It is also marked as not-a-demo, so the codex shows its
 * "View on GitHub" links.
 */
export function withManyFindings(analysis: RepoAnalysis): RepoAnalysis {
  const buggy = analysis.files.filter((file) => file.findings.length > 0);
  const copies = Array.from({ length: STRESS_COPIES }, (_, index) =>
    buggy.map((file) => {
      const path = `copy${index + 1}/${file.path}`;
      return { ...file, path, findings: file.findings.map((finding) => ({ ...finding, path, id: `${path}:${finding.id}` })) };
    }),
  ).flat();
  return { ...analysis, demo: false, files: [...analysis.files, ...copies] };
}

/** Every `?open=` shortcut and the overlay request it opens. */
export function demoRequests(analysis: RepoAnalysis): Record<string, OverlayRequest> {
  const boss = analysis.files.flatMap((file) => file.findings).find((finding) => finding.severity === "boss");
  const requests: Record<string, OverlayRequest> = {
    "chest-s": { kind: "chest", source: "clean-file", path: "bakery/oven.py" },
    "chest-a": { kind: "chest", source: "clean-file", path: "potions/ingredients.py" },
    "chest-c": { kind: "chest", source: "clean-file", path: GRADE_C_PATH },
    "chest-dungeon": { kind: "chest", source: "dungeon-clear", path: "potions/brewing.py" },
    "chest-opened": { kind: "chest", source: "clean-file", path: "main.py" },
    "chest-missing": { kind: "chest", source: "clean-file", path: "nowhere/ghost.py" },
    gacha: { kind: "gacha" },
    "gacha-broke": { kind: "gacha" },
    bag: { kind: "bag" },
    codex: { kind: "codex" },
    "codex-big": { kind: "codex" },
    "codex-focus": { kind: "codex", focusFindingId: boss?.id },
    board: { kind: "board" },
    victory: { kind: "victory" },
  };
  if (boss) requests.bugcard = { kind: "bugCard", finding: boss };
  return requests;
}
