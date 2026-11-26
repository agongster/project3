"use client";

/**
 * The codex's right column: everything about one finding — where it is, the
 * code, what Ruff said, how to fix it, a link to the exact line on GitHub,
 * and "Fix it for real", which opens the Workshop on that line.
 */
import { MONSTERS } from "@/lib/game/catalog";
import type { Finding, RepoAnalysis } from "@/lib/types";
import { CodeSnippet } from "../CodeSnippet";
import { MonsterIcon } from "../MonsterIcon";
import { SEVERITY_INFO } from "../monsterText";
import { githubLineUrl, type BugStatus } from "../codexData";
import { TraitLine } from "./TraitLine";
import { WorkshopLink } from "../WorkshopLink";

const DETAIL_ICON_BOX = 64;

/** One line about where the bug stands, and its colour. */
const STATUS_LINE: Record<BugStatus, { text: string; className: string }> = {
  lurking: { text: "Still lurking in the code.", className: "font-bold text-berry" },
  squashed: { text: "Monster squashed! Now fix it in the code.", className: "font-bold text-leaf-deep" },
  fixed: { text: "Fixed in the code ✓ You rewrote this line in the Workshop, so its monster is gone for good.", className: "font-bold text-leaf-deep" },
};

interface FindingDetailProps {
  finding: Finding;
  analysis: RepoAnalysis;
  status: BugStatus;
  /** Opens the Workshop on the finding's line (not offered for a bug already fixed in the code). */
  onFix: () => void;
}

export function FindingDetail({ finding, analysis, status, onFix }: FindingDetailProps) {
  const monster = MONSTERS[finding.monster];
  const severity = SEVERITY_INFO[finding.severity];
  return (
    <article className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <MonsterIcon kind={finding.monster} box={DETAIL_ICON_BOX} />
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-tight">{finding.title}</h3>
          <p className="text-sm">
            <code className="font-mono">{finding.code}</code> · {monster.name} ·{" "}
            <span className="font-bold" style={{ color: severity.color }}>
              {severity.label}
            </span>
          </p>
          <p className="truncate text-sm opacity-75">
            {finding.path}:{finding.line}
          </p>
        </div>
      </div>

      <p className={STATUS_LINE[status].className}>{STATUS_LINE[status].text}</p>

      <CodeSnippet lines={finding.snippet} />

      <section>
        <h4 className="text-xs font-bold uppercase opacity-70">Ruff says</h4>
        <p>{finding.message}</p>
      </section>
      <TraitLine finding={finding} />
      <section>
        <h4 className="text-xs font-bold uppercase opacity-70">How to fix it</h4>
        <p>{finding.tip}</p>
      </section>

      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {!analysis.demo && (
          <a
            href={githubLineUrl(analysis, finding)}
            target="_blank"
            rel="noreferrer noopener"
            className="font-bold text-[#3b6fd1] underline underline-offset-4 hover:text-grape"
          >
            View on GitHub (line {finding.line})
          </a>
        )}
        {status !== "fixed" && <WorkshopLink onClick={onFix} />}
      </div>
    </article>
  );
}
