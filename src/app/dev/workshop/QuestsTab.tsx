"use client";

/**
 * The Quests agent's panel, plugged into the Workshop's file sheet through
 * `extraTabs`, exactly the way the game does it: the panel gets the live
 * analysis, the save, and the sheet's `openFile`.
 */
import { QuestPanel } from "@/components/workshop/quests";
import type { WorkshopExtraTab, WorkshopTabContext } from "@/components/workshop";
import { useStore } from "@/lib/game/useStore";
import type { SaveData, Store } from "@/lib/types";
import type { Workspace } from "@/lib/workspace";

interface QuestsTabProps {
  workspace: Workspace;
  save: Store<SaveData>;
  repoKey: string;
  context: WorkshopTabContext;
}

function QuestsTab({ workspace, save, repoKey, context }: QuestsTabProps) {
  const analysis = useStore(workspace.analysis, (a) => a);
  return <QuestPanel analysis={analysis} save={save} repoKey={repoKey} onOpenFile={context.openFile} />;
}

export function questsExtraTab(workspace: Workspace, save: Store<SaveData>, repoKey: string): WorkshopExtraTab {
  return {
    id: "quests",
    label: "Quests",
    render: (context) => <QuestsTab workspace={workspace} save={save} repoKey={repoKey} context={context} />,
  };
}
