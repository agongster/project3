"use client";

/**
 * The explorer, drawn as the village: a folder tree where every Python file
 * shows what its building is in the world (a monster and its bug count when
 * cursed, a chest when it holds treasure, a tick when done) and its grade.
 * Files with forged edits carry a quill mark, files with unforged typing a dot.
 *
 * Keyboard: it is an ARIA tree. Up/Down move, Right opens a folder (or steps
 * into it), Left closes it (or steps out), Enter opens a file, Home/End jump.
 * Down from the filter box enters the tree.
 */
import { memo, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { PixelSprite } from "@/components/overlays/parts/PixelSprite";
import { uiIcon } from "@/components/overlays/parts/sprites";
import { GRADE_INFO } from "@/components/overlays/parts/GradeBadge";
import type { AnalyzedFile, RepoAnalysis, SaveData } from "@/lib/types";
import type { WorkspaceEntry } from "@/lib/workspace/contract";
import { badgeDescription, explorerBadge, type ExplorerBadge } from "../logic/fileBadges";
import { buildFileTree, visibleRows, type TreeRow } from "../logic/fileTree";
import { clip } from "./bits";
import { MonsterThumb } from "./MonsterThumb";

/** Longest file or folder name drawn (the rest is cut; CSS also ellipsizes). */
const MAX_NAME_LENGTH = 80;
/** Box size of the little monster next to a cursed file. */
const MONSTER_BOX = 18;

interface ExplorerProps {
  entries: readonly WorkspaceEntry[];
  analysis: RepoAnalysis;
  save: SaveData;
  repoKey: string;
  active: string | null;
  /** Paths with unforged typing. */
  dirty: ReadonlySet<string>;
  expanded: ReadonlySet<string>;
  onToggleFolder: (path: string) => void;
  onOpen: (path: string) => void;
}

function BadgeView({ badge }: { badge: ExplorerBadge }) {
  if (badge.kind !== "world") return null;
  const grade = (
    <span className="ws-grade-chip" style={{ background: GRADE_INFO[badge.grade].color }}>
      {badge.grade}
    </span>
  );
  if (badge.status === "cursed") {
    return (
      <span className="ws-badge">
        {badge.monster && <MonsterThumb kind={badge.monster} size={MONSTER_BOX} />}
        <span className="ws-bug-count">{badge.bugs}</span>
        {grade}
      </span>
    );
  }
  if (badge.status === "quiet") {
    return (
      <span className="ws-badge">
        <PixelSprite sprite={uiIcon("zzz")} scale={1} />
        <span className="ws-bug-count ws-fix-count">{badge.bugs}</span>
        {grade}
      </span>
    );
  }
  const icon = badge.status === "done" ? uiIcon("checkmark") : uiIcon("chestClosed");
  return (
    <span className={`ws-badge ws-badge-${badge.status}`}>
      <PixelSprite sprite={icon} scale={1} />
      {grade}
    </span>
  );
}

/** Memoized: it only needs to redraw when files, progress or the open tab change, not on every keystroke. */
export const Explorer = memo(function Explorer({ entries, analysis, save, repoKey, active, dirty, expanded, onToggleFolder, onOpen }: ExplorerProps) {
  const [filter, setFilter] = useState("");
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const tree = useMemo(() => buildFileTree(entries), [entries]);
  const rows = useMemo(() => visibleRows(tree, expanded, filter), [tree, expanded, filter]);
  const filesByPath = useMemo(() => new Map<string, AnalyzedFile>(analysis.files.map((file) => [file.path, file])), [analysis]);

  // The roving tab stop: the focused row, else the active file, else the first row.
  const tabStop = rows.find((row) => row.node.path === focusedPath) ?? rows.find((row) => row.node.path === active) ?? rows[0];

  function focusRow(index: number) {
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (!row) return;
    setFocusedPath(row.node.path);
    treeRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(row.node.path)}"]`)?.focus();
  }

  function activate(row: TreeRow) {
    if (row.node.kind === "folder") onToggleFolder(row.node.path);
    else onOpen(row.node.path);
  }

  function onTreeKey(event: KeyboardEvent<HTMLDivElement>) {
    const index = rows.findIndex((row) => row.node.path === (focusedPath ?? tabStop?.node.path));
    const row = rows[index];
    if (!row) return;
    const isFolder = row.node.kind === "folder";
    const moves: Record<string, () => void> = {
      ArrowDown: () => focusRow(index + 1),
      ArrowUp: () => (index === 0 ? document.getElementById("ws-filter")?.focus() : focusRow(index - 1)),
      Home: () => focusRow(0),
      End: () => focusRow(rows.length - 1),
      ArrowRight: () => (isFolder && !row.expanded ? onToggleFolder(row.node.path) : isFolder ? focusRow(index + 1) : undefined),
      ArrowLeft: () => {
        if (isFolder && row.expanded) return onToggleFolder(row.node.path);
        const parent = rows.slice(0, index).findLastIndex((candidate) => candidate.depth < row.depth);
        if (parent >= 0) focusRow(parent);
      },
      Enter: () => activate(row),
      " ": () => activate(row),
    };
    const move = moves[event.key];
    if (!move || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    move();
  }

  return (
    <nav className="ws-explorer" aria-label="Files">
      <div className="ws-panel-title">
        <span className="font-title">Village</span>
        <span className="ws-faint">{entries.length} files</span>
      </div>
      <input
        id="ws-filter"
        className="ws-filter"
        type="search"
        placeholder="Filter files…"
        aria-label="Filter files"
        value={filter}
        spellCheck={false}
        onChange={(event) => setFilter(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            focusRow(0);
          }
        }}
      />
      <div ref={treeRef} role="tree" aria-label="Repository files" className="ws-tree px-scroll" onKeyDown={onTreeKey}>
        {rows.length === 0 && <p className="ws-faint ws-tree-empty">No file matches “{clip(filter, 40)}”.</p>}
        {rows.map((row) => {
          const { node } = row;
          const isFile = node.kind === "file";
          const badge = isFile ? explorerBadge(save, repoKey, node.entry.kind === "python" ? filesByPath.get(node.path) : undefined) : null;
          const description = badge ? badgeDescription(badge) : "";
          const isDirty = isFile && dirty.has(node.path);
          const edited = isFile && node.entry.modified;
          return (
            <div
              key={node.path}
              role="treeitem"
              data-row={node.path}
              aria-level={row.depth + 1}
              aria-expanded={isFile ? undefined : row.expanded}
              aria-selected={isFile ? node.path === active : undefined}
              aria-label={[node.name, description, edited ? "edited" : "", isDirty ? "unsaved" : ""].filter(Boolean).join(", ")}
              tabIndex={node.path === tabStop?.node.path ? 0 : -1}
              className={`ws-row${node.path === active ? " ws-row-active" : ""}${isFile ? "" : " ws-row-folder"}`}
              style={{ paddingLeft: `${8 + row.depth * 14}px` }}
              title={node.path}
              onFocus={() => setFocusedPath(node.path)}
              onClick={() => activate(row)}
            >
              <span className={`ws-row-icon ${isFile ? `ws-file-icon ws-file-${node.entry.kind}` : ""}`} aria-hidden="true">
                {isFile ? "" : row.expanded ? "▾" : "▸"}
              </span>
              <span className="ws-row-name">{clip(node.name, MAX_NAME_LENGTH)}</span>
              {edited && (
                <span className="ws-edited" title="Edited and saved">
                  ✎
                </span>
              )}
              {isDirty && <span className="ws-dirty-dot" title="Unsaved typing" />}
              {badge && <BadgeView badge={badge} />}
            </div>
          );
        })}
      </div>
    </nav>
  );
});
