"use client";

/**
 * The Grade tab: the live grade and score of the code being typed, the
 * concrete things that would raise it (from the grader's own numbers, see
 * logic/gradeTips.ts), and the file's functions as lanterns: lit when the
 * function has a docstring, with its branch count. Clicking one jumps there.
 */
import { GradeBadge } from "@/components/overlays/parts/GradeBadge";
import { PixelBar } from "@/components/ui/kit";
import type { FileOutline, FileQuality } from "@/lib/types";
import { countCodeLines, gradeTips, nextGrade } from "../../logic/gradeTips";
import { clip } from "../bits";

/** Longest function name shown. */
const MAX_NAME_LENGTH = 48;
/** At most this many names are listed under a tip. */
const MAX_TIP_NAMES = 4;
/** The outline list stops here. */
const MAX_DEFINITIONS = 200;

interface GradeTabProps {
  python: boolean;
  quality: FileQuality | null;
  outline: FileOutline | null;
  bugCount: number;
  text: string;
  onJump: (line: number) => void;
}

export function GradeTab({ python, quality, outline, bugCount, text, onJump }: GradeTabProps) {
  if (!python) return <p className="ws-sheet-note">Grades are for Python files.</p>;
  if (!quality || !outline) return <p className="ws-sheet-note">Weighing the code…</p>;

  const tips = gradeTips(quality, outline, bugCount, countCodeLines(text));
  const next = nextGrade(quality.score);
  const definitions = outline.definitions.slice(0, MAX_DEFINITIONS);

  return (
    <div className="ws-grade-tab">
      <div className="ws-grade-head">
        <GradeBadge grade={quality.grade} size="md" withWord />
        <div className="min-w-0 flex-1">
          <p>
            Score <strong>{quality.score}</strong> / 100
          </p>
          <PixelBar value={quality.score / 100} color="var(--color-gold)" label="Grade score" className="ws-score-bar" />
          <p className="ws-faint">{next ? `${next.needed} more for ${next.grade}` : "Top grade!"}</p>
        </div>
      </div>

      <h4 className="ws-sheet-heading">Raise it</h4>
      {tips.length === 0 ? (
        <p className="ws-sheet-note">Nothing left to add. Polished!</p>
      ) : (
        <ul className="ws-tips">
          {tips.map((tip) => (
            <li key={tip.label}>
              <span className="ws-tip-points">+{tip.points}</span>
              <span>
                {tip.label}
                {tip.names.length > 0 && (
                  <span className="ws-faint">
                    {" "}
                    ({tip.names.slice(0, MAX_TIP_NAMES).map((name) => clip(name, MAX_NAME_LENGTH)).join(", ")}
                    {tip.names.length > MAX_TIP_NAMES ? ", …" : ""})
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h4 className="ws-sheet-heading">Functions</h4>
      {definitions.length === 0 ? (
        <p className="ws-sheet-note">No functions or classes yet.</p>
      ) : (
        <ul className="ws-outline">
          {definitions.map((definition) => {
            const lit = definition.docstring !== null;
            return (
              <li key={`${definition.line}:${definition.name}`}>
                <button type="button" className="ws-outline-row" onClick={() => onJump(definition.line)} title={lit ? (definition.docstring ?? "") : "No docstring yet"}>
                  <span className={`ws-lantern${lit ? " ws-lantern-lit" : ""}`} aria-label={lit ? "documented" : "no docstring"} />
                  <span className="ws-outline-name">
                    {definition.kind === "class" ? "class " : "def "}
                    {clip(definition.name, MAX_NAME_LENGTH)}
                  </span>
                  {definition.kind !== "class" && (
                    <span className="ws-branches" title="Branches (if / for / while / except …)">
                      {definition.branches} {definition.branches === 1 ? "branch" : "branches"}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
