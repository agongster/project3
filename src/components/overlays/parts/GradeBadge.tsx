"use client";

/**
 * A file's code-quality grade (S / A / B / C) as a chunky pixel badge.
 * The colours follow the item rarities, so an S feels as precious as a
 * legendary.
 */
import { cx } from "@/components/ui/kit";
import type { Grade } from "@/lib/types";

/** Colour and one-word meaning of each grade. */
export const GRADE_INFO: Readonly<Record<Grade, { color: string; word: string }>> = {
  S: { color: "var(--color-legendary)", word: "Superb" },
  A: { color: "var(--color-epic)", word: "Great" },
  B: { color: "var(--color-rare)", word: "Good" },
  C: { color: "var(--color-common)", word: "Okay" },
};

/** Box and letter size; the letters use the pixel font's crisp sizes (see the type scale in globals.css). */
const BOX_SIZE = { sm: "h-7 w-7 text-pixel-sm", md: "h-10 w-10 text-pixel-md", lg: "h-14 w-14 text-pixel-lg" } as const;

interface GradeBadgeProps {
  grade: Grade;
  size?: "sm" | "md" | "lg";
  /** Also print the one-word meaning ("Superb") under the letter. */
  withWord?: boolean;
  className?: string;
}

export function GradeBadge({ grade, size = "lg", withWord, className }: GradeBadgeProps) {
  const info = GRADE_INFO[grade];
  const box = BOX_SIZE[size];
  return (
    <span className={cx("inline-flex flex-col items-center gap-1", className)} title={`Grade ${grade}: ${info.word}`}>
      <span
        className={cx("font-title inline-flex items-center justify-center text-ink", box)}
        style={{
          background: info.color,
          boxShadow:
            "0 -3px 0 0 var(--color-ink), 0 3px 0 0 var(--color-ink), -3px 0 0 0 var(--color-ink), 3px 0 0 0 var(--color-ink), inset 0 -4px 0 0 rgb(0 0 0 / 0.2), inset 0 3px 0 0 rgb(255 255 255 / 0.45)",
        }}
      >
        {grade}
      </span>
      {withWord && <span className="text-xs font-bold uppercase leading-none tracking-wide">{info.word}</span>}
    </span>
  );
}
