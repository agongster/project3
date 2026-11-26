/**
 * Live hints while typing: the file in front is linted (`workspace.check`)
 * shortly after the player stops typing, and its saved text is linted once
 * so the status bar can say what forging would change. Nothing here touches
 * the game: checking is free, only forging counts.
 *
 * The workspace answers only the newest check of a file and rejects older
 * ones as "superseded" (src/lib/workspace/latestOnly.ts), so this hook asks
 * one question at a time: first "the text being typed", and once that is
 * answered, "the saved text". A superseded question is simply asked again.
 */
import { useEffect, useState } from "react";
import { isSuperseded } from "@/lib/workspace";
import type { LiveCheck, Workspace } from "@/lib/workspace/contract";

/** Wait this long after the last keystroke before linting (ms). Ruff is fast; this just avoids linting every key. */
export const CHECK_DEBOUNCE_MS = 350;

/** One check and the exact text it was made for. */
export interface CheckedText {
  path: string;
  text: string;
  check: LiveCheck;
}

export type CheckStatus = "off" | "checking" | "ready" | "failed";

type Question = { kind: "live" | "baseline"; text: string };

/**
 * @param path   the file in front, or null
 * @param text   its current text (null while it loads)
 * @param saved  its last forged text (null while it loads)
 * @param python only Python files are linted
 */
export function useLiveCheck(workspace: Workspace, path: string | null, text: string | null, saved: string | null, python: boolean) {
  const [live, setLive] = useState<CheckedText | null>(null);
  const [baseline, setBaseline] = useState<CheckedText | null>(null);
  const [failure, setFailure] = useState<{ path: string; text: string } | null>(null);
  const [retries, setRetries] = useState(0);

  /** The newest check of this file, even if the text has moved on since (better than nothing). */
  const liveHere = python && path !== null && live?.path === path ? live : null;
  const fresh = liveHere !== null && liveHere.text === text;
  const savedIsLive = liveHere !== null && liveHere.text === saved;
  const baselineHere = savedIsLive ? liveHere : baseline !== null && baseline.path === path && baseline.text === saved ? baseline : null;
  const failed = (candidate: string) => failure !== null && failure.path === path && failure.text === candidate;

  let question: Question | null = null;
  if (python && path !== null && text !== null && saved !== null) {
    if (!fresh && !failed(text)) question = { kind: "live", text };
    else if (baselineHere === null && !failed(saved)) question = { kind: "baseline", text: saved };
  }
  const firstCheck = liveHere === null;
  const kind = question?.kind ?? null;
  const asked = question?.text ?? null;

  useEffect(() => {
    if (path === null || kind === null || asked === null) return;
    // Set when this question is replaced by a newer one of ours: its answer no longer matters.
    let replaced = false;
    const delay = kind === "live" && !firstCheck ? CHECK_DEBOUNCE_MS : 0;
    const timer = setTimeout(() => {
      workspace
        .check(path, asked)
        .then((check) => {
          if (!replaced) (kind === "live" ? setLive : setBaseline)({ path, text: asked, check });
        })
        .catch((error: unknown) => {
          if (replaced) return;
          // Someone else checked this file in between: ask again.
          if (isSuperseded(error)) setRetries((n) => n + 1);
          else setFailure({ path, text: asked });
        });
    }, delay);
    return () => {
      replaced = true;
      clearTimeout(timer);
    };
  }, [workspace, path, kind, asked, firstCheck, retries]);

  const status: CheckStatus = !python || path === null ? "off" : text !== null && failed(text) ? "failed" : fresh ? "ready" : "checking";
  return { live: liveHere, baseline: baselineHere, fresh, status };
}
