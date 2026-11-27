"use client";

/**
 * Quest test page (/dev/quests): the quest board and the quest news on the
 * Demo Kingdom, with buttons that pretend to forge, fight and wish (see
 * simulate.ts), so quests, the streak and achievements can be judged
 * without the rest of the Workshop. The save lives only in memory.
 *
 *   /dev/quests                 a 320 px side panel and a wide one, side by side
 *   /dev/quests?layout=side     only the 320 px side panel
 *   /dev/quests?layout=wide     only the wide panel
 *
 * Every button goes through the real reducers in the order the game uses:
 * `applyForge` (pays the fix itself), then `settleQuests`.
 * `window.__questSave()` returns the current save for scripts.
 */
import { useEffect, useState } from "react";
import { QuestNews, QuestPanel } from "@/components/workshop/quests";
import { createAudio } from "@/game/audio";
import { repoKey } from "@/game/bridge";
import type { AudioApi } from "@/game/bridge";
import { analyzeDemo } from "@/lib/analysis/demo";
import { recordDefeat } from "@/lib/game/actions";
import { ACHIEVEMENTS, ACHIEVEMENT_REWARD } from "@/lib/game/achievements";
import { applyForge } from "@/lib/game/forge";
import { getProgress } from "@/lib/game/progress";
import { questBoard } from "@/lib/game/questsBoard";
import { settleQuests } from "@/lib/game/questsSettle";
import type { QuestNewsItem } from "@/lib/game/questsSettle";
import { createStore, defaultSave } from "@/lib/game/store";
import { useStore } from "@/lib/game/useStore";
import type { RepoAnalysis, SaveData, Store } from "@/lib/types";
import type { ForgeReport } from "@/lib/workspace/contract";
import { addBug, finishQuest, fixAnyBug, monstersToSquash } from "./simulate";

declare global {
  interface Window {
    __questSave?: () => SaveData;
  }
}

/** Width of the side-panel column, like the Workshop's side panel. */
const SIDE_PANEL_WIDTH = 320;
/** Coins and XP the test hero starts with. */
const START_COINS = 120;
const START_XP = 20;
/** "Wish ×10" adds this many wishes to the lifetime count. */
const WISHES_PER_CLICK = 10;

// One audio engine for the page, created on first use (never during server rendering).
let audioEngine: AudioApi | null = null;
function getAudio(): AudioApi {
  if (!audioEngine) audioEngine = createAudio();
  return audioEngine;
}
const lazyAudio: AudioApi = {
  unlock: () => getAudio().unlock(),
  sfx: (name, opts) => getAudio().sfx(name, opts),
  music: (track) => getAudio().music(track),
  setTheme: (theme) => getAudio().setTheme(theme),
  setVolumes: (sfx, music) => getAudio().setVolumes(sfx, music),
};

interface Demo {
  original: RepoAnalysis;
  key: string;
  store: Store<SaveData>;
}

function startSave(): SaveData {
  return { ...defaultSave(), created: true, coins: START_COINS, xp: START_XP };
}

/** One of every kind of news, made from the real board, for judging the toasts. */
function everyKindOfNews(analysis: RepoAnalysis, save: SaveData, key: string): QuestNewsItem[] {
  const [quest] = questBoard(getProgress(save, key), analysis).active;
  return [
    { type: "streak", streak: 3, reward: { coins: 10, xp: 0 } },
    { type: "quest", quest: { ...quest, progress: { done: true } } },
    { type: "streakLost", streak: 4 },
    { type: "achievement", achievement: ACHIEVEMENTS[0], reward: ACHIEVEMENT_REWARD },
    { type: "achievement", achievement: ACHIEVEMENTS[4], reward: ACHIEVEMENT_REWARD },
    { type: "levelUp", level: 3, title: "Bug Hunter" },
  ];
}

export default function QuestsDevPage() {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [analysis, setAnalysis] = useState<RepoAnalysis | null>(null);
  const [news, setNews] = useState<readonly QuestNewsItem[]>([]);
  const [lastOpen, setLastOpen] = useState("Click a quest's “Go to …” button.");
  const [bugSerial, setBugSerial] = useState(1);
  const [layout] = useState(() => (typeof window === "undefined" ? "both" : new URLSearchParams(window.location.search).get("layout") ?? "both"));

  useEffect(() => {
    let alive = true;
    analyzeDemo(() => undefined).then((original) => {
      if (!alive) return;
      const key = repoKey(original);
      const store = createStore(settleQuests(startSave(), key, original, null).save);
      setDemo({ original, key, store });
      setAnalysis(original);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Browsers only allow sound after a click or key press.
  useEffect(() => {
    const unlock = () => lazyAudio.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    if (demo) window.__questSave = () => demo.store.get();
  }, [demo]);

  if (!demo || !analysis) {
    return <main className="flex h-screen items-center justify-center bg-night text-cream">Building the demo kingdom…</main>;
  }

  /** Runs one change through the real reducers, like the game will. */
  function settle(next: RepoAnalysis, report: ForgeReport | null, before: SaveData = demo!.store.get()) {
    const paid = report ? applyForge(before, demo!.key, report).save : before;
    const result = settleQuests(paid, demo!.key, next, report, getProgress(before, demo!.key).defeated);
    demo!.store.set(result.save);
    setAnalysis(next);
    setNews(result.news);
  }

  function defeatMonsters(count: number) {
    let save = demo!.store.get();
    for (const finding of monstersToSquash(analysis!, getProgress(save, demo!.key), count)) save = recordDefeat(save, demo!.key, finding).save;
    settle(analysis!, null, save);
  }

  function finish(index: number) {
    const spec = getProgress(demo!.store.get(), demo!.key).quests?.active[index];
    if (!spec) return;
    const forged = finishQuest(analysis!, getProgress(demo!.store.get(), demo!.key), spec);
    if (forged) settle(forged.analysis, forged.report);
    else defeatMonsters(3);
  }

  const actions: { label: string; tone: string; run: () => void }[] = [
    { label: "Save: fix a bug", tone: "leaf", run: () => { const forged = fixAnyBug(analysis); if (forged) settle(forged.analysis, forged.report); } },
    { label: "Save: add a bug", tone: "berry", run: () => { const forged = addBug(analysis, bugSerial); setBugSerial(bugSerial + 1); settle(forged.analysis, forged.report); } },
    { label: "Fight: defeat a monster", tone: "rose", run: () => defeatMonsters(1) },
    { label: `Wish ×${WISHES_PER_CLICK}`, tone: "grape", run: () => settle(analysis, null, { ...demo.store.get(), stats: { ...demo.store.get().stats, wishes: demo.store.get().stats.wishes + WISHES_PER_CLICK } }) },
    { label: "Show every toast", tone: "gold", run: () => setNews(everyKindOfNews(analysis, demo.store.get(), demo.key)) },
    { label: "Reset", tone: "cream", run: () => { demo.store.set(settleQuests(startSave(), demo.key, demo.original, null).save); setAnalysis(demo.original); setNews([]); } },
  ];

  const panel = <QuestPanel analysis={analysis} save={demo.store} repoKey={demo.key} onOpenFile={(path, line) => setLastOpen(`onOpenFile(${JSON.stringify(path)}${line ? `, ${line}` : ""})`)} />;

  return (
    <main className="min-h-screen bg-night p-3 text-cream">
      <nav className="flex flex-wrap items-center gap-1">
        <span className="font-title mr-2">Quests</span>
        {actions.map((action) => (
          <button key={action.label} type="button" className={`px-btn small ${action.tone}`} onClick={action.run}>
            {action.label}
          </button>
        ))}
        <FinishButtons demo={demo} onFinish={finish} />
      </nav>
      <p className="my-2 text-sm text-gold">{lastOpen}</p>
      <div className="flex flex-wrap items-start gap-6">
        {layout !== "wide" && (
          <aside className="shrink-0 bg-night-soft" style={{ width: SIDE_PANEL_WIDTH }}>
            {panel}
          </aside>
        )}
        {layout !== "side" && <section className="min-w-0 flex-1">{panel}</section>}
      </div>
      <QuestNews news={news} audio={lazyAudio} />
    </main>
  );
}

/** "Finish fix", "Finish document"…: one button per posted quest. */
function FinishButtons({ demo, onFinish }: { demo: Demo; onFinish: (index: number) => void }) {
  const active = useStore(demo.store, (s) => getProgress(s, demo.key).quests?.active ?? []);
  return (
    <>
      {active.map((spec, index) => (
        <button key={spec.id} type="button" className="px-btn small sky" onClick={() => onFinish(index)}>
          Finish {spec.kind}
        </button>
      ))}
    </>
  );
}
