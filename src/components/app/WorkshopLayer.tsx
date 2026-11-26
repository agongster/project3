"use client";

/**
 * The Workshop mounted over the game: a full-window layer (it covers the
 * whole window, not just the 400×225 stage), with the Quests panel plugged
 * into its side sheet and the quest news of its forges shown over it. The
 * editor itself downloads on first use (`Workshop` from
 * "@/components/workshop" is a lazy wrapper with its own fallback).
 *
 * Esc must always lead back to the world. The Workshop handles Esc itself
 * while it has the keyboard; this layer also takes an Esc that lands
 * outside it (the keyboard focus was lost, or the editor is still
 * downloading), which would otherwise go nowhere.
 */
import { useEffect, useEffectEvent, useMemo } from "react";
import { Workshop, type ForgeRewards, type WorkshopExtraTab, type WorkshopTabContext } from "@/components/workshop";
import { QuestNews, QuestPanel } from "@/components/workshop/quests";
import type { QuestNewsItem } from "@/lib/game";
import type { AudioApi, WorkshopTarget } from "@/game/bridge";
import { useStore } from "@/lib/game/useStore";
import type { SaveData, Store } from "@/lib/types";
import type { ForgeReport, Workspace } from "@/lib/workspace";

interface Props {
  workspace: Workspace;
  save: Store<SaveData>;
  repoKey: string;
  audio: AudioApi;
  target: WorkshopTarget;
  /** The quest news of the latest forge (a new array each time). */
  news: Store<readonly QuestNewsItem[]>;
  onForged: (report: ForgeReport, savedText: string) => ForgeRewards;
  onClose: () => void;
}

interface QuestsTabProps {
  workspace: Workspace;
  save: Store<SaveData>;
  repoKey: string;
  context: WorkshopTabContext;
}

/** The quest board in the side sheet; it follows the live analysis itself, so the tab list never changes. */
function QuestsTab({ workspace, save, repoKey, context }: QuestsTabProps) {
  const analysis = useStore(workspace.analysis, (a) => a);
  return <QuestPanel analysis={analysis} save={save} repoKey={repoKey} onOpenFile={context.openFile} />;
}

export function WorkshopLayer({ workspace, save, repoKey, audio, target, news, onForged, onClose }: Props) {
  const latestNews = useStore(news, (items) => items);
  // The same array on every render: a new one would redraw the Workshop's side sheet.
  const extraTabs = useMemo<WorkshopExtraTab[]>(
    () => [{ id: "quests", label: "Quests", render: (context) => <QuestsTab workspace={workspace} save={save} repoKey={repoKey} context={context} /> }],
    [workspace, save, repoKey],
  );
  const initial = target.path === null ? undefined : { path: target.path, line: target.line };

  const onStrayEscape = useEffectEvent((event: KeyboardEvent) => {
    const inside = event.target instanceof Element && event.target.closest(".ws-root") !== null;
    if (event.key !== "Escape" || inside || event.defaultPrevented) return;
    event.preventDefault();
    onClose();
  });
  useEffect(() => {
    // Capture phase: the Workshop stops every key at the document, after its own handlers.
    const listener = (event: KeyboardEvent) => onStrayEscape(event);
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, []);

  return (
    <>
      <Workshop workspace={workspace} save={save} repoKey={repoKey} audio={audio} initial={initial} onForged={onForged} onClose={onClose} extraTabs={extraTabs} />
      <QuestNews news={latestNews} audio={audio} />
    </>
  );
}
