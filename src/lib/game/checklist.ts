/**
 * The real-world takeaway of the game: every finding in the repo as a
 * Markdown to-do list, grouped by file, ready to paste into an issue or a
 * README. A bug can be dealt with two ways, and the list tells them apart:
 * its monster SQUASHED in the game (ticked, but the bug is still in the
 * code), or the bug FIXED in the code in the Workshop (ticked and marked
 * "fixed in the code"; those edits can be exported as a patch).
 *
 * Example output:
 *
 *   # Bug checklist: octocat/potions
 *
 *   Commit `a1b2c3d` on `main` · **2 of 4** bugs dealt with in Lintlands (50%): 1 squashed in the game, 1 fixed in the code · 2 files
 *
 *   ## `potions/brew.py` (2/3)
 *
 *   - [x] `potions/brew.py:3` — **F401** Unused import — `os` imported but unused
 *   - [ ] `potions/brew.py:42` — **F821** Undefined name — Undefined name `cauldron`
 *   - [x] `potions/brew.py:7` — **E722** Bare except — Do not use bare `except` — _fixed in the code_
 *   - +2 more smaller findings not shown
 *   ...
 */
import type { AnalyzedFile, Finding, RepoAnalysis, RepoProgress } from "@/lib/types";

/** Git's usual short-SHA length. */
const SHORT_SHA_LENGTH = 7;

const FOOTER = "_Exported from Lintlands. A ticked box means you squashed that bug's monster in the game, or fixed the bug in the code where it says so. A squashed bug is still in the code: fix it for real!_";
/** Added when some bugs were fixed in the Workshop: where the fixes themselves are. */
const PATCH_NOTE = "Your fixes live in Lintlands' Workshop: download them as a patch (or a zip) from its Changes tab.";
const FIXED_MARK = " — _fixed in the code_";

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

/**
 * Wraps a file path or branch name in a Markdown code span.
 *
 * Such a name may itself contain backticks, which would end a one-backtick
 * span early and let the rest of the name be read as Markdown (a link, for
 * example) wherever the list is pasted. The CommonMark rule fixes that: fence
 * the span with one more backtick than the longest run inside it, and pad
 * with a space when the text touches the fence.
 */
export function codeSpan(text: string): string {
  const oneLine = text.replace(/\s+/g, " ");
  const longestRun = Math.max(0, ...(oneLine.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longestRun + 1);
  const pad = oneLine.startsWith("`") || oneLine.endsWith("`") ? " " : "";
  return `${fence}${pad}${oneLine}${pad}${fence}`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function findingLine(finding: Finding, done: boolean, fixed = false): string {
  const box = done ? "[x]" : "[ ]";
  const where = codeSpan(`${finding.path}:${finding.line}`);
  return `- ${box} ${where} — **${inlineMarkdown(finding.code)}** ${inlineMarkdown(finding.title)} — ${inlineMarkdown(finding.message)}${fixed ? FIXED_MARK : ""}`;
}

/** The bugs of the original code fixed in the Workshop (listed after the live ones, with their original line). */
function fixedIn(file: AnalyzedFile): Finding[] {
  return file.fixedFindings ?? [];
}

function fileSection(file: AnalyzedFile, defeated: ReadonlySet<string>): string[] {
  const squashed = file.findings.filter((finding) => defeated.has(finding.id)).length;
  const fixed = fixedIn(file);
  const lines = [`## ${codeSpan(file.path)} (${squashed + fixed.length}/${file.findings.length + fixed.length})`, ""];
  for (const finding of file.findings) lines.push(findingLine(finding, defeated.has(finding.id)));
  for (const finding of fixed) lines.push(findingLine(finding, true, true));
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
    .filter((file) => file.status === "ok" && (file.findings.length > 0 || file.overflow > 0 || fixedIn(file).length > 0))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const fixed = files.reduce((sum, file) => sum + fixedIn(file).length, 0);
  const total = files.reduce((sum, file) => sum + file.findings.length, 0) + fixed;
  const squashed = files.reduce((sum, file) => sum + file.findings.filter((f) => defeated.has(f.id)).length, 0);
  const hidden = files.reduce((sum, file) => sum + file.overflow, 0);
  const percent = total === 0 ? 100 : Math.round(((squashed + fixed) / total) * 100);

  const { owner, repo, ref, sha } = analysis.repo;
  const lines = [`# Bug checklist: ${owner}/${repo}`, ""];

  if (files.length === 0) {
    lines.push(`Commit \`${sha.slice(0, SHORT_SHA_LENGTH)}\` on ${codeSpan(ref)}`, "");
    lines.push("No findings: Ruff found nothing to fix in this repo. Spotless!", "");
  } else {
    const tally = fixed > 0 ? `bugs dealt with in Lintlands (${percent}%): ${squashed} squashed in the game, ${fixed} fixed in the code` : `bugs squashed in Lintlands (${percent}%)`;
    lines.push(`Commit \`${sha.slice(0, SHORT_SHA_LENGTH)}\` on ${codeSpan(ref)} · **${squashed + fixed} of ${total}** ${tally} · ${plural(files.length, "file")}`, "");
    if (hidden > 0) lines.push(`Plus ${plural(hidden, "smaller finding")} not listed below.`, "");
    if (fixed > 0) lines.push(PATCH_NOTE, "");
    for (const file of files) lines.push(...fileSection(file, defeated));
  }

  lines.push("---", "", FOOTER);
  return `${lines.join("\n")}\n`;
}
