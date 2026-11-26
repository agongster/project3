"use client";

/**
 * One answer button of the pick-the-fix finisher: the key that picks it,
 * the fix it suggests and, once the player has answered, whether it was
 * the real fix.
 */
import { KeyCap, PixelButton, cx, type ButtonTone } from "@/components/ui/kit";

/**
 * open: nothing picked yet · right: the real fix · picked-wrong: the
 * player's (wrong) pick · other: a wrong answer nobody picked.
 */
export type ChoiceState = "open" | "right" | "picked-wrong" | "other";

const LOOK: Record<ChoiceState, { tone: ButtonTone; badge: string | null; dim: boolean }> = {
  open: { tone: "cream", badge: null, dim: false },
  right: { tone: "leaf", badge: "Real fix", dim: false },
  "picked-wrong": { tone: "rose", badge: "Your pick", dim: false },
  other: { tone: "cream", badge: null, dim: true },
};

interface FinisherChoiceProps {
  keyLabel: string;
  text: string;
  state: ChoiceState;
  onPick: () => void;
}

export function FinisherChoice({ keyLabel, text, state, onPick }: FinisherChoiceProps) {
  const look = LOOK[state];
  return (
    <PixelButton
      tone={look.tone}
      small
      onClick={onPick}
      aria-disabled={state !== "open"}
      // The button's 4 px pixel border sits in its margin, hence the 8 px less than full width.
      className={cx("w-[calc(100%-8px)] justify-start text-left leading-snug", look.dim && "opacity-50")}
    >
      <KeyCap>{keyLabel}</KeyCap>
      <span className="min-w-0 flex-1">{text}</span>
      {look.badge && <span className="shrink-0 text-xs font-bold uppercase">{look.badge}</span>}
    </PixelButton>
  );
}
