"use client";

/**
 * Shown on the title screen when building a world failed. It explains what
 * happened in plain words (the analysis already wrote a friendly message),
 * counts down when GitHub asked us to wait, and always offers a way to keep
 * playing: try again, or the offline Demo Kingdom.
 */
import { useEffect, useState } from "react";
import type { AudioApi } from "@/game/bridge";
import { Modal, PixelButton } from "@/components/ui/kit";
import { targetLabel, type FlowError, type WorldTarget } from "@/components/app/flow";
import { EXAMPLE_REPOS } from "./recentRepos";

/** A headline for each kind of failure; the message from the error goes underneath. */
const HEADLINES: Record<FlowError["code"], string> = {
  bad_input: "Hmm, that's not a repo name",
  not_found: "That kingdom isn't on the map",
  rate_limited: "GitHub needs a breather",
  no_python: "No Python here!",
  upstream: "GitHub is having a moment",
  network: "The road to GitHub is blocked",
  linter_failed: "The bug detector won't wake up",
  aborted: "Cancelled",
  unknown: "Something went sideways",
};

const NO_PYTHON_NOTE = "Lintlands only understands Python for now. These ones are full of it:";

/** Seconds left before "Try again" makes sense (counts down once per second). */
function useCountdown(seconds: number | undefined): number {
  const [left, setLeft] = useState(Math.max(0, Math.ceil(seconds ?? 0)));
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return left;
}

function formatWait(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}:${String(rest).padStart(2, "0")}` : `${rest}s`;
}

interface Props {
  error: FlowError;
  audio: AudioApi;
  onRetry: () => void;
  onDemo: () => void;
  onPick: (target: WorldTarget) => void;
  onClose: () => void;
}

export function ErrorPanel({ error, audio, onRetry, onDemo, onPick, onClose }: Props) {
  const wait = useCountdown(error.retryAfterSec);
  const isNoPython = error.code === "no_python";

  const click = (action: () => void) => () => {
    audio.sfx("uiSelect");
    action();
  };

  return (
    <Modal label="Couldn't build the world" onClose={onClose} className="flex w-[min(560px,100%)] flex-col gap-3 p-6">
      <h2 className="font-title text-pixel-sm leading-relaxed text-berry">{HEADLINES[error.code]}</h2>
      <p className="font-semibold">{error.message}</p>
      {error.target.kind === "repo" && <p className="text-ink-soft">Repo: {targetLabel(error.target)}</p>}

      {isNoPython && (
        <div className="flex flex-col gap-1">
          <p className="text-ink-soft">{NO_PYTHON_NOTE}</p>
          <div className="flex flex-wrap">
            {EXAMPLE_REPOS.map((name) => {
              const [owner, repo] = name.split("/");
              return (
                <PixelButton key={name} tone="cream" small onClick={click(() => onPick({ kind: "repo", owner, repo }))}>
                  {name}
                </PixelButton>
              );
            })}
          </div>
        </div>
      )}

      {wait > 0 && (
        <p className="font-bold text-ink" aria-live="polite">
          You can try again in <span className="text-grape">{formatWait(wait)}</span>, or play the demo while you wait.
        </p>
      )}

      <div className="mt-2 flex flex-wrap justify-end gap-1">
        <PixelButton tone="cream" onClick={click(onClose)}>
          Close
        </PixelButton>
        {!isNoPython && (
          <PixelButton tone="sky" disabled={wait > 0} onClick={click(onRetry)}>
            Try again
          </PixelButton>
        )}
        <PixelButton onClick={click(onDemo)}>Play the Demo Kingdom instead</PixelButton>
      </div>
    </Modal>
  );
}
