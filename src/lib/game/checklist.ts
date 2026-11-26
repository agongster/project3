/**
 * The real-world takeaway of the game: every finding in the repo as a
 * Markdown to-do list, grouped by file, ready to paste into an issue or a
 * README. A box is ticked only when the bug is gone from the code: FIXED
 * in the Workshop, or SEALED there with `# noqa` (said so on the line). A
 * monster subdued in a fight is still a bug in the code, so its box stays
 * open with a reminder to fix it.
 *
 * Example output:
 *
 *   # Bug checklist: octocat/potions
 *
 *   Commit `a1b2c3d` on `main` · **2 of 4** bugs dealt with in Lintlands (50%): 1 fixed in the code, 1 sealed · 1 subdued in the game, waiting for a fix · 2 files
 *
 *   ## `potions/brew.py` (2/3)
 *
 *   - [ ] `potions/brew.py:3` — **F401** Unused import — `os` imported but unused — _subdued in the game: now fix it in the code_
 *   - [x] `potions/brew.py:7` — **E722** Bare except — Do not use bare `except` — _fixed in the code_
 *   - [x] `potions/brew.py:9` — **S105** Hardcoded password — … — _sealed with `# noqa`_
 *   - +2 more smaller findings not shown
 *   ...
 */
import { findingState, goneFindings, repoHealth } from "@/lib/game/progress";
import type { FindingState } from "@/lib/game/progress";
import type { AnalyzedFile, Finding, RepoAnalysis, RepoProgress } from "@/lib/types";

/** Git's usual short-SHA length. */
const SHORT_SHA_LENGTH = 7;

const FOOTER =
  "_Exported from Lintlands. A ticked box means the bug is gone from the code: fixed, or sealed with `# noqa` where it says so. A monster subdued in the game is still a bug in the code until you fix it for real!_";
/** Added when some bugs were fixed or sealed in the Workshop: where the edits themselves are. */
const PATCH_NOTE = "Your fixes live in Lintlands' Workshop: download them as a patch (or a zip) from its Changes tab.";

/** What follows a finding on its line, by state; alive bugs get nothing. */
const STATE_MARK: Readonly<Record<FindingState, string>> = {
  alive: "",
  subdued: " — _subdued in the game: now fix it in the code_",
  fixed: " — _fixed in the code_",
  sealed: " — _sealed with `# noqa`_",
};

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

function findingLine(finding: Finding, state: FindingState): string {
  const done = state === "fixed" || state === "sealed";
  const where = codeSpan(`${finding.path}:${finding.line}`);
  return `- ${done ? "[x]" : "[ ]"} ${where} — **${inlineMarkdown(finding.code)}** ${inlineMarkdown(finding.title)} — ${inlineMarkdown(finding.message)}${STATE_MARK[state]}`;
}

/** The bugs still in the code first, then the ones gone from it (with their original line). */
function fileSection(file: AnalyzedFile, progress: RepoProgress): string[] {
  const gone = goneFindings(file);
  const lines = [`## ${codeSpan(file.path)} (${gone.length}/${file.findings.length + gone.length})`, ""];
  for (const finding of [...file.findings, ...gone]) lines.push(findingLine(finding, findingState(file, finding, progress)));
  if (file.overflow > 0) lines.push(`- +${file.overflow} more smaller finding${file.overflow === 1 ? "" : "s"} not shown`);
  lines.push("");
  return lines;
}

/** "2 of 4 bugs dealt with in Lintlands (50%): 1 fixed in the code, 1 sealed · 1 subdued in the game, waiting for a fix". */
function tally(analysis: RepoAnalysis, progress: RepoProgress): string {
  const health = repoHealth(analysis, progress);
  const dealt = health.fixed + health.sealed;
  const how = [`${health.fixed} fixed in the code`, ...(health.sealed > 0 ? [`${health.sealed} sealed`] : [])].join(", ");
  const waiting = health.subdued > 0 ? ` · ${health.subdued} subdued in the game, waiting for a fix` : "";
  return `**${dealt} of ${health.total}** bugs dealt with in Lintlands (${Math.round(health.ratio * 100)}%): ${how}${waiting}`;
}

/**
 * Builds the Markdown checklist for one repo. Files are listed alphabetically
 * and only if they have findings; findings keep their line order. The output
 * always ends with a single newline.
 */
export function buildChecklist(analysis: RepoAnalysis, progress: RepoProgress): string {
  const files = analysis.files
    .filter((file) => file.status === "ok" && (file.findings.length > 0 || file.overflow > 0 || goneFindings(file).length > 0))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const hidden = files.reduce((sum, file) => sum + file.overflow, 0);
  const edited = files.some((file) => goneFindings(file).length > 0);

  const { owner, repo, ref, sha } = analysis.repo;
  const lines = [`# Bug checklist: ${owner}/${repo}`, ""];

  if (files.length === 0) {
    lines.push(`Commit \`${sha.slice(0, SHORT_SHA_LENGTH)}\` on ${codeSpan(ref)}`, "");
    lines.push("No findings: Ruff found nothing to fix in this repo. Spotless!", "");
  } else {
    lines.push(`Commit \`${sha.slice(0, SHORT_SHA_LENGTH)}\` on ${codeSpan(ref)} · ${tally(analysis, progress)} · ${plural(files.length, "file")}`, "");
    if (hidden > 0) lines.push(`Plus ${plural(hidden, "smaller finding")} not listed below.`, "");
    if (edited) lines.push(PATCH_NOTE, "");
    for (const file of files) lines.push(...fileSection(file, progress));
  }

  lines.push("---", "", FOOTER);
  return `${lines.join("\n")}\n`;
}
