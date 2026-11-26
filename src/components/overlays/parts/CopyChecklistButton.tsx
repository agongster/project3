"use client";

/**
 * "Copy to-do list (Markdown)": puts the repo's bug checklist on the
 * clipboard, the game's real-world takeaway.
 *
 * The clipboard API can fail (insecure page, denied permission, old
 * browser). Then the text is shown in a read-only box, already selected,
 * so the player can still copy it with Ctrl/Cmd+C.
 */
import { useEffect, useRef, useState } from "react";
import { PixelButton } from "@/components/ui/kit";
import type { ButtonTone } from "@/components/ui/kit";
import { buildChecklist } from "@/lib/game";
import type { RepoAnalysis, RepoProgress } from "@/lib/types";
import { useTimeout } from "./hooks";

/** How long "Copied!" stays on the button. */
const COPIED_MESSAGE_MS = 2200;

type CopyState = "idle" | "copied" | "fallback";

interface CopyChecklistButtonProps {
  analysis: RepoAnalysis;
  /** This repo's progress (ticked boxes = defeated monsters). */
  progress: RepoProgress;
  tone?: ButtonTone;
  small?: boolean;
  /** Called after a successful copy (e.g. to play a sound). */
  onCopied?: () => void;
}

export function CopyChecklistButton({ analysis, progress, tone = "sky", small, onCopied }: CopyChecklistButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const [text, setText] = useState("");
  useTimeout(() => setState("idle"), COPIED_MESSAGE_MS, state === "copied");

  async function copy() {
    const markdown = buildChecklist(analysis, progress);
    setText(markdown);
    try {
      await navigator.clipboard.writeText(markdown);
      setState("copied");
      onCopied?.();
    } catch {
      setState("fallback");
    }
  }

  return (
    <div className="flex flex-col items-stretch">
      <PixelButton tone={state === "copied" ? "leaf" : tone} small={small} onClick={copy} aria-live="polite">
        {state === "copied" ? "Copied!" : "Copy to-do list (Markdown)"}
      </PixelButton>
      {state === "fallback" && <FallbackText text={text} />}
    </div>
  );
}

/** The checklist in a read-only box, selected on appear, for copying by hand. */
function FallbackText({ text }: { text: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <label className="mt-2 flex flex-col gap-1 text-xs">
      <span>Couldn&apos;t reach the clipboard. Press Ctrl/Cmd + C to copy:</span>
      <textarea ref={ref} readOnly value={text} rows={5} className="px-input font-mono text-xs leading-4" />
    </label>
  );
}
