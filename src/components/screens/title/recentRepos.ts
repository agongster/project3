/**
 * "Recent" chips on the title screen. Every repo the player has made
 * progress in is a key `owner/repo@sha` in `SaveData.repos`, kept in
 * least → most recently played order (see `withRepoProgress`).
 */
import { DEMO_REPO } from "@/lib/analysis/demo";
import type { WorldTarget } from "@/components/app/flow";

export const MAX_RECENT_REPOS = 3;

/** The repos suggested as one-click examples (all small-to-medium Python projects). */
export const EXAMPLE_REPOS: readonly string[] = ["karpathy/micrograd", "karpathy/nanoGPT", "psf/requests", "pallets/flask"];

/** "owner/repo@sha" → owner and repo, or null for anything else. */
const REPO_KEY_PATTERN = /^([^/@]+)\/([^/@]+)@/;

/** Up to MAX_RECENT_REPOS repos, newest first, without the demo and without repeats. */
export function recentTargets(repoKeys: readonly string[]): WorldTarget[] {
  const demoName = `${DEMO_REPO.owner}/${DEMO_REPO.repo}`;
  const seen = new Set<string>([demoName]);
  const targets: WorldTarget[] = [];
  for (const key of [...repoKeys].reverse()) {
    const match = REPO_KEY_PATTERN.exec(key);
    if (!match) continue;
    const name = `${match[1]}/${match[2]}`;
    if (seen.has(name)) continue;
    seen.add(name);
    targets.push({ kind: "repo", owner: match[1], repo: match[2] });
    if (targets.length === MAX_RECENT_REPOS) break;
  }
  return targets;
}
