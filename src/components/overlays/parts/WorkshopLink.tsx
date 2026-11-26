"use client";

/**
 * "Fix it for real ✎": a quiet text link (styled like "View on GitHub")
 * that opens the Workshop on a bug's line. It is always the SECONDARY way
 * out of an overlay: the game's own action stays the big button with the
 * default key, and this link never answers Space or Enter by itself.
 */
import { cx } from "@/components/ui/kit";

interface WorkshopLinkProps {
  onClick: () => void;
  /** Defaults to "Fix it for real". */
  label?: string;
  className?: string;
  title?: string;
}

export function WorkshopLink({ onClick, label = "Fix it for real", className, title }: WorkshopLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? "Open the Workshop on this line of code"}
      className={cx("font-bold text-[#3b6fd1] underline underline-offset-4 hover:text-grape focus-visible:outline-3 focus-visible:outline-gold", className)}
    >
      {label} ✎
    </button>
  );
}
