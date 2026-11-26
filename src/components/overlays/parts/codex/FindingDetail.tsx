"use client";

/**
 * The codex's right column: everything about one finding — where it is, the
 * code, what Ruff said, how to fix it, and a link to the exact line on GitHub.
 */
import { MONSTERS } from "@/lib/game/catalog";
import type { Finding, RepoAnalysis } from "@/lib/types";
import { CodeSnippet } from "../CodeSnippet";
import { MonsterIcon } from "../MonsterIcon";
import { SEVERITY_INFO } from "../monsterText";
import { githubLineUrl } from "../codexData";
import { TraitLine } from "./TraitLine";

const DETAIL_ICON_BOX = 64;

interface FindingDetailProps {
  finding: Finding;
  analysis: RepoAnalysis;
  done: boolean;
}

export function FindingDetail({ finding, analysis, done }: FindingDetailProps) {
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

      <p className={done ? "font-bold text-leaf-deep" : "font-bold text-berry"}>
        {done ? "Monster squashed! Now fix it in the code." : "Still lurking in the code."}
      </p>

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

      {!analysis.demo && (
        <a
          href={githubLineUrl(analysis, finding)}
          target="_blank"
          rel="noreferrer noopener"
          className="self-start font-bold text-[#3b6fd1] underline underline-offset-4 hover:text-grape"
        >
          View on GitHub (line {finding.line})
        </a>
      )}
    </article>
  );
}
