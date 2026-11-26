/**
 * The Workshop (the code editor) as seen from the game screen. It is a room
 * of the game: the world stays mounted and paused underneath, and a door
 * (an iris wipe, WorkshopDoor.tsx) is passed on the way in and out.
 *
 *   open(target)   the game pauses where the hero stands, the door closes,
 *                  the Workshop opens at that file and line
 *   onForged       every forge and revert is applied HERE, once (forgeFlow.ts):
 *                  the save is written once, the engine hears which monsters
 *                  were fixed and which were sealed, quest news is announced
 *   close()        the game resumes exactly where it was, the door opens on
 *                  the world reacting, and a banner sums up what changed
 *
 *   null ──open──► entering ──door shut──► open ──close──► leaving ──door open──► null
 */
import { useRef, useState, type RefObject } from "react";
import type { GameHandle, WorkshopTarget } from "@/game/bridge";
import type { ForgeRewards } from "@/components/workshop";
import type { Feed } from "@/components/hud/feed";
import type { QuestNewsItem } from "@/lib/game";
import type { Bounty } from "@/lib/game/bounties";
import type { Store } from "@/lib/types";
import type { ForgeReport, Workspace } from "@/lib/workspace";
import { EMPTY_TALLY, addToTally, originalIds, returnBanner, settleForge, traceIds } from "./forgeFlow";
import type { AppServices } from "./services";

export type WorkshopVisit = { phase: "entering" | "open"; target: WorkshopTarget } | { phase: "leaving" };

interface WorkshopOptions {
  gameRef: RefObject<GameHandle | null>;
  workspace: Workspace;
  services: AppServices;
  repoKey: string;
  feed: Feed;
  /** The notice board's bounties (they follow the code, see forgeFlow.ts). */
  bounties: Store<Bounty[]>;
  /** Quest news of the latest forge, for the Workshop's news toasts (a new array each time). */
  news: Store<readonly QuestNewsItem[]>;
}

export function useWorkshop({ gameRef, workspace, services, repoKey, feed, bounties, news }: WorkshopOptions) {
  const { save, audio } = services;
  const [visit, setVisit] = useState<WorkshopVisit | null>(null);
  /** What this visit's forges changed, for the banner on the way out. */
  const tally = useRef(EMPTY_TALLY);
  /** Finding ids now → ids when the Workshop opened (see `traceIds`). */
  const trace = useRef(new Map<string, string>());
  /** Each report is paid once, even if it is handed over twice. */
  const settled = useRef(new WeakMap<ForgeReport, ForgeRewards>());

  function open(where: WorkshopTarget): void {
    if (visit !== null) return;
    gameRef.current?.pause();
    tally.current = EMPTY_TALLY;
    trace.current = new Map();
    news.set([]); // the news component shows only this visit's news
    audio.sfx("door", { pitch: 1.3 });
    setVisit({ phase: "entering", target: where });
  }

  /** The door has closed behind the hero: show the Workshop. */
  function entered(): void {
    setVisit((current) => (current?.phase === "entering" ? { phase: "open", target: current.target } : current));
  }

  function close(): void {
    if (visit?.phase !== "open") return;
    setVisit({ phase: "leaving" });
    audio.sfx("door", { pitch: 1.1 });
    const banner = returnBanner(tally.current);
    if (banner) feed.banner({ ...banner, tone: "forge" });
    // The world runs again at once, so the door opens on it reacting to the edits.
    gameRef.current?.resume();
  }

  /** The door is open again: the visit is over. */
  function left(): void {
    setVisit((current) => (current?.phase === "leaving" ? null : current));
  }

  function onForged(report: ForgeReport, text: string): ForgeRewards {
    const known = settled.current.get(report);
    if (known) return known;
    const analysis = workspace.analysis.get();
    const outcome = settleForge({ save: save.get(), repoKey, analysis, report, text, bounties: bounties.get() });
    if (outcome.save !== save.get()) save.set(outcome.save);
    bounties.set(outcome.bounties);
    if (outcome.news.length > 0) news.set(outcome.news);
    tally.current = addToTally(tally.current, report, outcome);
    gameRef.current?.updateAnalysis(analysis, originalIds(trace.current, outcome.fixed), originalIds(trace.current, outcome.sealed));
    trace.current = traceIds(trace.current, report);
    settled.current.set(report, outcome.rewards);
    return outcome.rewards;
  }

  /** Where the open Workshop shows, or null when it is not open. */
  const target = visit?.phase === "open" ? visit.target : null;
  return { visit, target, open, entered, close, left, onForged };
}
