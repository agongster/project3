"use client";

/**
 * A few lines of the player's real source code with line numbers, the
 * offending line(s) highlighted. Used by the codex and the boss bug card.
 *
 * The code comes from someone else's repository, so it is always rendered
 * as plain text by React (never as HTML), which makes it impossible for a
 * file to inject markup into the page.
 */
import { cx } from "@/components/ui/kit";
import type { SnippetLine } from "@/lib/types";

interface CodeSnippetProps {
  lines: readonly SnippetLine[];
  className?: string;
}

export function CodeSnippet({ lines, className }: CodeSnippetProps) {
  if (lines.length === 0) {
    return <p className={cx("text-sm text-ink-soft", className)}>No preview of the code is available.</p>;
  }
  // Width of the widest line number, so the gutter lines up.
  const gutterCh = String(lines[lines.length - 1].n).length + 1;

  return (
    <pre
      className={cx("overflow-x-auto bg-night py-2 font-mono text-[13px] leading-5 text-cream", className)}
      style={{ boxShadow: "0 -3px 0 0 var(--color-ink), 0 3px 0 0 var(--color-ink), -3px 0 0 0 var(--color-ink), 3px 0 0 0 var(--color-ink)" }}
    >
      {lines.map((line) => (
        <div
          key={line.n}
          className={cx("flex pr-3", line.hit ? "bg-berry/35" : "")}
          style={line.hit ? { boxShadow: "inset 4px 0 0 0 var(--color-berry)" } : undefined}
        >
          <span
            aria-hidden="true"
            className={cx("shrink-0 select-none pr-3 text-right", line.hit ? "text-gold" : "text-cream/40")}
            style={{ width: `${gutterCh + 1}ch` }}
          >
            {line.n}
          </span>
          <code className="whitespace-pre">{line.text.length > 0 ? line.text : " "}</code>
        </div>
      ))}
    </pre>
  );
}
