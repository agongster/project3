/**
 * The real-world takeaway of the game: every finding in the repo as a
 * Markdown to-do list, grouped by file, ready to paste into an issue or a
 * README. Findings whose monster the player defeated are ticked.
 *
 * Example output:
 *
 *   # Bug checklist: octocat/potions
 *
 *   Commit `a1b2c3d` on `main` · **1 of 3** bugs squashed in Lintlands (33%) · 2 files
 *
 *   ## `potions/brew.py` (1/2)
 *
 *   - [x] `potions/brew.py:3` — **F401** Unused import — `os` imported but unused
 *   - [ ] `potions/brew.py:42` — **F821** Undefined name — Undefined name `cauldron`
 *   - +2 more smaller findings not shown
 *   ...
 */
import type { AnalyzedFile, Finding, RepoAnalysis, RepoProgress } from "@/lib/types";

/** Git's usual short-SHA length. */
const SHORT_SHA_LENGTH = 7;

const FOOTER = "_Exported from Lintlands. A ticked box means you squashed that bug's monster in the game; now fix it in the code for real!_";

/**
 * Makes text safe to put on one Markdown line: collapses newlines and escapes
 * Markdown punctuation outside `code spans`, so e.g. `__init__` in a message
 * stays literal instead of turning bold.
 */
function inlineMarkdown(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  // Splitting on a capturing group keeps the code spans at the odd indices.
  return oneLine
    .split(/(`[^`]*`)/)
    .map((part, index) => (index % 2 === 1 ? part : part.replace(/[\\*_[\]<>]/g, "\\$&")))
    .join("");
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function findingLine(finding: Finding, done: boolean): string {
  const box = done ? "[x]" : "[ ]";
  const where = `\`${finding.path}:${finding.line}\``;
  return `- ${box} ${where} — **${inlineMarkdown(finding.code)}** ${inlineMarkdown(finding.title)} — ${inlineMarkdown(finding.message)}`;
}

function fileSection(file: AnalyzedFile, defeated: ReadonlySet<string>): string[] {
  const squashed = file.findings.filter((finding) => defeated.has(finding.id)).length;
  const lines = [`## \`${file.path}\` (${squashed}/${file.findings.length})`, ""];
  for (const finding of file.findings) lines.push(findingLine(finding, defeated.has(finding.id)));
  if (file.overflow > 0) lines.push(`- +${file.overflow} more smaller finding${file.overflow === 1 ? "" : "s"} not shown`);
  lines.push("");
  return lines;
}

/**
 * Builds the Markdown checklist for one repo. Files are listed alphabetically
 * and only if they have findings; findings keep their line order. The output
 * always ends with a single newline.
 */
export function buildChecklist(analysis: RepoAnalysis, progress: RepoProgress): string {
  const defeated = new Set(progress.defeated);
  const files = analysis.files
    .filter((file) => file.status === "ok" && (file.findings.length > 0 || file.overflow > 0))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const total = files.reduce((sum, file) => sum + file.findings.length, 0);
  const squashed = files.reduce((sum, file) => sum + file.findings.filter((f) => defeated.has(f.id)).length, 0);
  const hidden = files.reduce((sum, file) => sum + file.overflow, 0);
  const percent = total === 0 ? 100 : Math.round((squashed / total) * 100);

  const { owner, repo, ref, sha } = analysis.repo;
  const lines = [`# Bug checklist: ${owner}/${repo}`, ""];

  if (files.length === 0) {
    lines.push(`Commit \`${sha.slice(0, SHORT_SHA_LENGTH)}\` on \`${ref}\``, "");
    lines.push("No findings: Ruff found nothing to fix in this repo. Spotless!", "");
  } else {
    lines.push(
      `Commit \`${sha.slice(0, SHORT_SHA_LENGTH)}\` on \`${ref}\` · **${squashed} of ${total}** bugs squashed in Lintlands (${percent}%) · ${plural(files.length, "file")}`,
      "",
    );
    if (hidden > 0) lines.push(`Plus ${plural(hidden, "smaller finding")} not listed below.`, "");
    for (const file of files) lines.push(...fileSection(file, defeated));
  }

  lines.push("---", "", FOOTER);
  return `${lines.join("\n")}\n`;
}
