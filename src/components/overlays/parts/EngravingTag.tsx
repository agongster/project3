"use client";

/**
 * The line engraved on a chest item: "Forged in get_batch() · data/prepare.py"
 * (see src/lib/game/engraving.ts). Shown under the chest's item card and in
 * the bag. The text comes from the repo, so it is rendered as plain text and
 * allowed to wrap anywhere.
 */
import { cx } from "@/components/ui/kit";
import { engravingText } from "@/lib/game/engraving";
import type { Engraving } from "@/lib/types";

interface EngravingTagProps {
  engraving: Engraving;
  /** "dark" for the chest's dark panel, "light" for the bag's cream column. */
  tone: "dark" | "light";
  className?: string;
}

export function EngravingTag({ engraving, tone, className }: EngravingTagProps) {
  return (
    <p
      title={engravingText(engraving)}
      className={cx("break-words text-center text-sm italic leading-snug", tone === "dark" ? "text-gold" : "text-ink-soft", className)}
    >
      Forged in{" "}
      {engraving.name && (
        <>
          <code className={cx("font-mono font-bold not-italic", tone === "dark" ? "text-cream" : "text-ink")}>{engraving.name}</code>
          {" · "}
        </>
      )}
      {engraving.path}
    </p>
  );
}
