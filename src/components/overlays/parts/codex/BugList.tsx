"use client";

/**
 * The codex's left column: findings grouped by file. Only open groups render
 * their rows, so even a repo with hundreds of findings stays snappy.
 * Up/Down arrows move the selection through the visible findings. Each row
 * is tagged with its bug's state (nothing while its monster still fights,
 * then SUBDUED, FIXED or SEALED); bugs gone from the code are listed after
 * a file's live ones.
 */
import type { KeyboardEvent } from "react";
import { cx } from "@/components/ui/kit";
import { lookOf } from "@/lib/game/monsterLooks";
import type { Finding } from "@/lib/types";
import { MonsterIcon } from "../MonsterIcon";
import { SEVERITY_INFO } from "../monsterText";
import type { BugStatus, DungeonState, FileGroup } from "../codexData";
import { DoneMark } from "../DoneMark";

const ROW_ICON_BOX = 32;

/** The tag at the end of a row, by state (alive bugs get none). */
const STATE_TAG: Readonly<Record<Exclude<BugStatus, "alive">, { label: string; background: string }>> = {
  subdued: { label: "Subdued", background: "#2a6f8a" },
  fixed: { label: "Fixed", background: "var(--color-leaf-deep)" },
  sealed: { label: "Ignored", background: "#6f6a7d" },
};

/** The badge on a file's header, by its dungeon's state. */
const DUNGEON_BADGE: Readonly<Record<DungeonState, { label: string; background: string }>> = {
  cursed: { label: "Cursed", background: "var(--color-berry)" },
  quiet: { label: "Quiet", background: "#2a6f8a" },
  purified: { label: "Purified", background: "var(--color-leaf-deep)" },
};

interface BugListProps {
  groups: readonly FileGroup[];
  statusOf: (finding: Finding) => BugStatus;
  openPaths: ReadonlySet<string>;
  selectedId: string | null;
  onToggle: (path: string) => void;
  onSelect: (finding: Finding) => void;
}

export function BugList({ groups, statusOf, openPaths, selectedId, onToggle, onSelect }: BugListProps) {
  const visible = groups.filter((group) => openPaths.has(group.file.path)).flatMap((group) => [...group.file.findings, ...group.gone]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step === 0 || visible.length === 0) return;
    event.preventDefault();
    const index = visible.findIndex((finding) => finding.id === selectedId);
    const next = visible[Math.max(0, Math.min(visible.length - 1, index + step))];
    onSelect(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-finding="${CSS.escape(next.id)}"]`)?.focus();
  }

  if (groups.length === 0) {
    return <p className="p-4 text-center">Not a single bug in this repo. Spotless!</p>;
  }

  return (
    <div className="flex flex-col gap-2" onKeyDown={onKeyDown}>
      {groups.map((group) => {
        const open = openPaths.has(group.file.path);
        return (
          <section key={group.file.path}>
            <GroupHeader group={group} open={open} onToggle={() => onToggle(group.file.path)} />
            {open && (
              <ul className="mt-1 flex flex-col gap-1">
                {group.file.findings.map((finding) => (
                  <li key={finding.id}>
                    <FindingRow finding={finding} status={statusOf(finding)} selected={finding.id === selectedId} onSelect={() => onSelect(finding)} />
                  </li>
                ))}
                {group.gone.map((finding) => (
                  <li key={`gone:${finding.id}`}>
                    <FindingRow finding={finding} status={statusOf(finding)} selected={finding.id === selectedId} onSelect={() => onSelect(finding)} />
                  </li>
                ))}
                {group.file.overflow > 0 && (
                  <li className="px-2 text-sm opacity-70">+{group.file.overflow} smaller findings not shown as monsters</li>
                )}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function GroupHeader({ group, open, onToggle }: { group: FileGroup; open: boolean; onToggle: () => void }) {
  const total = group.file.findings.length + group.gone.length;
  const badge = DUNGEON_BADGE[group.state];
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="flex w-full items-center gap-2 bg-cream-deep px-2 py-1 text-left font-bold hover:brightness-105 focus-visible:outline-3 focus-visible:outline-gold"
    >
      <span aria-hidden="true" className="w-3 text-center">
        {open ? "-" : "+"}
      </span>
      <span className="min-w-0 flex-1 truncate">{group.file.path}</span>
      <span className="text-sm tabular-nums">
        {group.gone.length}/{total}
      </span>
      <span
        className="px-1.5 text-xs uppercase text-cream"
        style={{ background: badge.background }}
      >
        {badge.label}
      </span>
    </button>
  );
}

interface FindingRowProps {
  finding: Finding;
  status: BugStatus;
  selected: boolean;
  onSelect: () => void;
}

function FindingRow({ finding, status, selected, onSelect }: FindingRowProps) {
  const done = status === "fixed" || status === "sealed";
  return (
    <button
      type="button"
      data-finding={finding.id}
      data-selected={selected}
      aria-pressed={selected}
      onClick={onSelect}
      className={cx(
        "flex w-full items-center gap-2 px-2 py-0.5 text-left text-sm hover:bg-gold/30 focus-visible:outline-3 focus-visible:outline-gold",
        selected && "bg-gold/50",
        done && !selected && "opacity-60",
      )}
    >
      <MonsterIcon kind={finding.monster} box={ROW_ICON_BOX} look={lookOf(finding)} />
      <span aria-hidden="true" className="h-3 w-1.5 shrink-0" style={{ background: SEVERITY_INFO[finding.severity].color }} />
      <code className="w-16 shrink-0 font-mono text-xs">{finding.code}</code>
      <span className="min-w-0 flex-1 truncate">{finding.title}</span>
      <span className="shrink-0 text-xs tabular-nums opacity-70">L{finding.line}</span>
      {status === "alive" ? <DoneMark done={false} /> : <StateTag status={status} />}
    </button>
  );
}

function StateTag({ status }: { status: Exclude<BugStatus, "alive"> }) {
  const tag = STATE_TAG[status];
  return (
    <span className="shrink-0 px-1 text-xs font-bold uppercase text-cream" style={{ background: tag.background }}>
      {tag.label}
    </span>
  );
}
