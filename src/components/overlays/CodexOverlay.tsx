"use client";

/**
 * The Bug Codex: every finding in the repo, the game's real-world takeaway.
 *
 *   Bugs tab      findings grouped by file → pick one to see its code, Ruff's
 *                 message, a fix tip and a GitHub link
 *   Bestiary tab  every monster species and what code problem it embodies
 *
 * The "Copy to-do list" button exports the same list as Markdown.
 * `request.focusFindingId` opens the codex with that finding selected
 * (used by the boss bug card's "View in Codex").
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, PixelBar } from "@/components/ui/kit";
import { getProgress, repoHealth } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import type { Finding } from "@/lib/types";
import { Bestiary } from "./parts/codex/Bestiary";
import { BugList } from "./parts/codex/BugList";
import { FindingDetail } from "./parts/codex/FindingDetail";
import { findFinding, groupFindings, tallyMonsters } from "./parts/codexData";
import { CopyChecklistButton } from "./parts/CopyChecklistButton";
import { PanelHeader } from "./parts/PanelHeader";
import { PANEL_LARGE } from "./parts/panelSizes";
import { Tabs } from "./parts/Tabs";
import type { OverlayProps } from "./types";

type CodexTab = "bugs" | "bestiary";

export default function CodexOverlay({ request, ctx }: OverlayProps<"codex">) {
  const { analysis, audio } = ctx;
  const progress = useStore(ctx.save, (save) => getProgress(save, ctx.repoKey));
  const groups = useMemo(() => groupFindings(analysis, progress), [analysis, progress]);
  const defeated = useMemo(() => new Set(progress.defeated), [progress]);
  const tallies = useMemo(() => tallyMonsters(analysis, progress), [analysis, progress]);
  const health = repoHealth(analysis, progress);

  // Start on the requested finding, else the first one of the first (most urgent) file.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => findFinding(analysis, request.focusFindingId)?.id ?? groups[0]?.file.findings[0]?.id ?? null,
  );
  const [openPaths, setOpenPaths] = useState<ReadonlySet<string>>(() => {
    const first = findFinding(analysis, selectedId ?? undefined)?.path;
    return new Set(first ? [first] : []);
  });
  const [tab, setTab] = useState<CodexTab>("bugs");
  const selected = findFinding(analysis, selectedId ?? undefined);

  // Bring a focused finding into view when the codex opens.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "center" });
  }, []);

  function toggleGroup(path: string) {
    audio.sfx("uiMove");
    setOpenPaths((open) => {
      const next = new Set(open);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function select(finding: Finding) {
    if (finding.id !== selectedId) audio.sfx("uiMove");
    setSelectedId(finding.id);
  }

  function changeTab(next: CodexTab) {
    audio.sfx("uiSelect");
    setTab(next);
  }

  const { owner, repo } = analysis.repo;
  return (
    <Modal label="Bug codex" onClose={ctx.close} className={PANEL_LARGE}>
      <PanelHeader
        title="Bug Codex"
        subtitle={`${owner}/${repo}`}
        onClose={ctx.close}
        actions={<CopyChecklistButton analysis={analysis} progress={progress} small onCopied={() => audio.sfx("uiSelect")} />}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Tabs
          label="Codex sections"
          active={tab}
          onChange={changeTab}
          tabs={[
            { id: "bugs", label: `Bugs (${health.total})` },
            { id: "bestiary", label: "Bestiary" },
          ]}
        />
        <PixelBar value={health.ratio} label="Repo health" className="min-w-24 flex-1" />
        <p className="shrink-0 text-sm font-bold">
          {health.defeated} of {health.total} bugs squashed
        </p>
      </div>

      {tab === "bugs" ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
          <div ref={listRef} className="px-scroll min-h-0 pr-1">
            <BugList
              groups={groups}
              defeated={defeated}
              openPaths={openPaths}
              selectedId={selectedId}
              onToggle={toggleGroup}
              onSelect={select}
            />
          </div>
          <div className="px-scroll min-h-0 pr-1">
            {selected ? (
              <FindingDetail finding={selected} analysis={analysis} done={defeated.has(selected.id)} />
            ) : (
              <p className="p-4 text-center opacity-70">Pick a bug on the left to see its details.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="px-scroll @container min-h-0 flex-1 pr-1">
          <Bestiary tallies={tallies} />
        </div>
      )}
    </Modal>
  );
}
