/**
 * What a forge (saving code in the Workshop) does to the player's save.
 *
 *   const { save: next, paid } = applyForge(save, repoKey, report, sealedIds);
 *
 * `report` comes from `Workspace.forge` / `revert` (src/lib/workspace);
 * `sealedIds` says which of the file's original findings gone from the
 * code are only SEALED with `# noqa` (seal.ts, `splitSealed`). Five rules,
 * all pure:
 *
 * 1. **Real fixes pay, once.** Every finding of the repo's ORIGINAL code that
 *    is gone from the saved text (`report.file.fixedFindings`) and NOT
 *    sealed pays FIX_COIN_MULTIPLIER × the most coins and FIX_XP_MULTIPLIER
 *    × the XP its monster gives in a fight, the first time it is fixed. It
 *    is remembered by its id in the original text, which never changes, so
 *    a fix that is reverted and redone does not pay again, and a bug the
 *    player wrote themselves pays nothing when they remove it (no farming).
 * 2. **Seals pay nothing** and are remembered in `RepoProgress.sealed`, so
 *    the game can show them as sealed. That list is rebuilt for the forged
 *    file at every forge: removing a seal (or turning it into a real fix)
 *    takes the file's old entries away.
 * 3. **Progress follows the code.** Monster ids contain line numbers, so after
 *    a forge every subdued (or bounty-settled) id of a finding that merely
 *    moved is renamed to its new id; ids of findings gone from the code are
 *    dropped, so an unrelated bug that later lands on the same spot is not
 *    "already subdued".
 * 4. **New bugs wake the dungeon.** If the file now has monsters that are not
 *    subdued, it is no longer recorded as quiet (`cleared`). Its chest is not
 *    refilled (`opened` is kept): one chest per building, ever.
 * 5. **No penalty.** New bugs cost nothing; coins already paid stay paid.
 */
import { MONSTERS } from "@/lib/game/catalog";
import { aliveFindings, getProgress, levelForXp, withRepoProgress } from "@/lib/game/progress";
import { MAX_COINS, MAX_PAID_FIXES, MAX_XP } from "@/lib/game/store";
import type { Finding, RepoProgress, SaveData } from "@/lib/types";
import type { ForgeReport } from "@/lib/workspace/contract";

/** A real fix pays this many times the most coins its monster can drop in a fight. */
export const FIX_COIN_MULTIPLIER = 2;
/** A real fix pays this many times the XP its monster gives in a fight. */
export const FIX_XP_MULTIPLIER = 2;

/** What one forge paid (all zero / empty when it paid nothing). */
export interface ForgePayout {
  coins: number;
  xp: number;
  /** The original findings paid for this time. */
  fixes: Finding[];
  /** Set when the XP pushed the player to a new level. */
  leveledUp: { level: number; title: string } | null;
}

export interface ForgeResult {
  /** The same save object when nothing changed. */
  save: SaveData;
  paid: ForgePayout;
}

const NOTHING_PAID: ForgePayout = { coins: 0, xp: 0, fixes: [], leveledUp: null };

/** Coins one real fix of `finding` pays. */
export function fixCoins(finding: Pick<Finding, "monster">): number {
  return FIX_COIN_MULTIPLIER * (MONSTERS[finding.monster]?.coins[1] ?? 0);
}

/** XP one real fix of `finding` pays. */
export function fixXp(finding: Pick<Finding, "monster">): number {
  return FIX_XP_MULTIPLIER * (MONSTERS[finding.monster]?.xp ?? 0);
}

/** Applies a forge report to the save (see the rules at the top of this file). Pure. */
export function applyForge(save: SaveData, repoKey: string, report: ForgeReport, sealedIds: readonly string[] = []): ForgeResult {
  if (!report.linted || report.file === null) return { save, paid: NOTHING_PAID };
  const before = getProgress(save, repoKey);
  const sealedNow = new Set(sealedIds);
  const gone = report.file.fixedFindings ?? [];

  const rename = renamer(report);
  const defeated = rename(before.defeated);
  const bounties = before.bounties && rename(before.bounties);
  const awake = aliveFindings(report.file, { ...before, defeated }).length > 0;
  const cleared = awake ? before.cleared.filter((path) => path !== report.path) : before.cleared;
  const sealed = sealedList(before.sealed, report.path, gone.filter((finding) => sealedNow.has(finding.id)));

  const paidIds = new Set(before.fixes ?? []);
  const newFixes = gone.filter((finding) => !paidIds.has(finding.id) && !sealedNow.has(finding.id));
  const fixes = newFixes.length > 0 ? [...(before.fixes ?? []), ...newFixes.map((finding) => finding.id)].slice(-MAX_PAID_FIXES) : before.fixes;

  const progress: RepoProgress = { ...before, defeated, cleared, ...(bounties && { bounties }), ...(fixes && { fixes }) };
  // A repo with nothing sealed keeps no `sealed` list at all (like a save from before seals existed).
  if (sealed) progress.sealed = sealed;
  else delete progress.sealed;
  if (sameProgress(before, progress)) return { save, paid: NOTHING_PAID };
  return pay(withRepoProgress(save, repoKey, progress), newFixes);
}

/**
 * The repo's sealed ids after a forge of `path`: the file's earlier entries
 * are replaced by its findings sealed now. Ids are `path:line:col:code`, so
 * a file's entries are the ones that start with its path and a colon.
 * Undefined when nothing in the repo is sealed.
 */
function sealedList(before: readonly string[] | undefined, path: string, sealedHere: readonly Finding[]): string[] | undefined {
  const others = (before ?? []).filter((id) => !id.startsWith(`${path}:`));
  const list = [...others, ...sealedHere.map((finding) => finding.id)].slice(-MAX_PAID_FIXES);
  return list.length === 0 ? undefined : list;
}

/**
 * A function that brings a list of finding ids up to date with the forge:
 * kept findings get their new id, fixed findings are dropped, every other id
 * (other files, or ids the report doesn't mention) is left alone. Order is
 * kept, duplicates removed.
 */
function renamer(report: ForgeReport): (ids: readonly string[]) => string[] {
  const newId = new Map(report.kept.map((pair) => [pair.before.id, pair.after.id]));
  const gone = new Set(report.fixed.map((finding) => finding.id));
  return (ids) => [...new Set(ids.filter((id) => !gone.has(id)).map((id) => newId.get(id) ?? id))];
}

function sameList<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((value, i) => value === b[i]);
}

function sameProgress(a: RepoProgress, b: RepoProgress): boolean {
  return (
    sameList(a.defeated, b.defeated) &&
    sameList(a.cleared, b.cleared) &&
    sameList(a.bounties, b.bounties) &&
    sameList(a.fixes, b.fixes) &&
    sameList(a.sealed, b.sealed)
  );
}

/** Pays coins and XP for `fixes` and counts them in the lifetime stats. */
function pay(save: SaveData, fixes: readonly Finding[]): ForgeResult {
  if (fixes.length === 0) return { save, paid: NOTHING_PAID };
  const coins = fixes.reduce((sum, finding) => sum + fixCoins(finding), 0);
  const xp = fixes.reduce((sum, finding) => sum + fixXp(finding), 0);
  const levelBefore = levelForXp(save.xp);
  const next: SaveData = {
    ...save,
    coins: Math.min(MAX_COINS, save.coins + coins),
    xp: Math.min(MAX_XP, save.xp + xp),
    stats: { ...save.stats, realFixes: (save.stats.realFixes ?? 0) + fixes.length },
  };
  const levelAfter = levelForXp(next.xp);
  const leveledUp = levelAfter.level > levelBefore.level ? { level: levelAfter.level, title: levelAfter.title } : null;
  return { save: next, paid: { coins, xp, fixes: [...fixes], leveledUp } };
}
