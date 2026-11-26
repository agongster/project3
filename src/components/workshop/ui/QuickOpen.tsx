"use client";

/**
 * Quick-open (Ctrl/Cmd+P): type a few letters of a file's name, Up/Down to
 * pick, Enter to open. Letters only need to appear in order ("bord" finds
 * bakery/orders.py).
 */
import { useMemo, useState, type KeyboardEvent } from "react";
import type { WorkspaceEntry } from "@/lib/workspace/contract";
import { rankPaths } from "../logic/fileTree";
import { clip } from "./bits";
import { Popup } from "./Popup";

const MAX_PATH_LENGTH = 90;

interface QuickOpenProps {
  entries: readonly WorkspaceEntry[];
  onOpen: (path: string) => void;
  onClose: () => void;
}

export function QuickOpen({ entries, onOpen, onClose }: QuickOpenProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const paths = useMemo(() => entries.map((entry) => entry.path), [entries]);
  const hits = useMemo(() => rankPaths(paths, query), [paths, query]);
  const current = Math.min(selected, Math.max(0, hits.length - 1));

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setSelected((current + step + hits.length) % Math.max(1, hits.length));
    } else if (event.key === "Enter" && hits[current]) {
      event.preventDefault();
      onOpen(hits[current]);
    }
  }

  return (
    <Popup label="Open a file" onClose={onClose} place="top" className="ws-quick-open">
      <input
        className="px-input ws-quick-input"
        placeholder="Type a file name…"
        aria-label="File name"
        aria-controls="ws-quick-list"
        aria-activedescendant={hits[current] ? `ws-quick-${current}` : undefined}
        value={query}
        spellCheck={false}
        data-autofocus
        onChange={(event) => {
          setQuery(event.target.value);
          setSelected(0);
        }}
        onKeyDown={onKeyDown}
      />
      <ul id="ws-quick-list" role="listbox" aria-label="Matching files" className="ws-quick-list px-scroll">
        {hits.length === 0 && <li className="ws-faint-ink">No file matches.</li>}
        {hits.map((path, i) => (
          <li
            key={path}
            id={`ws-quick-${i}`}
            role="option"
            aria-selected={i === current}
            className={i === current ? "ws-quick-hit ws-quick-hit-active" : "ws-quick-hit"}
            onMouseEnter={() => setSelected(i)}
            onMouseDown={(event) => {
              event.preventDefault();
              onOpen(path);
            }}
          >
            <span className="ws-quick-name">{clip(path.slice(path.lastIndexOf("/") + 1), MAX_PATH_LENGTH)}</span>
            <span className="ws-faint-ink">{clip(path, MAX_PATH_LENGTH)}</span>
          </li>
        ))}
      </ul>
    </Popup>
  );
}
