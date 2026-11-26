"use client";

/**
 * "How it fights": the one plain-English line that ties a monster's trait
 * to its bug ("Grows with every hit and stays big: a mutable default keeps
 * what it collected…"), from src/lib/analysis/traits.ts. Shown in the codex,
 * on the boss bug card and in the finisher. Renders nothing when the
 * monster fights the plain way.
 *
 * The line can quote names from the player's repo, so it is plain React
 * text: `backticked` parts become <code>, nothing is ever read as HTML.
 */
import { cx } from "@/components/ui/kit";
import { traitLine } from "@/lib/analysis/traits";
import type { Finding } from "@/lib/types";

interface TraitLineProps {
  finding: Finding;
  className?: string;
}

export function TraitLine({ finding, className }: TraitLineProps) {
  const line = traitLine(finding);
  if (!line) return null;
  // Splitting on backticks: every odd piece was inside `...`.
  const pieces = line.split("`");
  return (
    <section className={cx("bg-grape/15 p-2", className)}>
      <h4 className="text-xs font-bold uppercase opacity-70">How it fights</h4>
      <p>
        {pieces.map((piece, i) =>
          i % 2 === 1 ? (
            <code key={i} className="font-mono text-[0.9em]">
              {piece}
            </code>
          ) : (
            <span key={i}>{piece}</span>
          ),
        )}
      </p>
    </section>
  );
}
