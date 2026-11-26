/**
 * CHAMPIONS AND LAIRS: where the big fights are.
 *
 * A true BOSS only exists where the code has a boss-severity finding (a
 * leaked secret, input that becomes code, a file Python cannot compile),
 * which is rare in real repos. So every dungeon with at least
 * CHAMPION_MIN_MONSTERS monsters and no true boss promotes its toughest
 * monster to a CHAMPION: the same species and brain, bigger, crowned and
 * tougher (the fight itself: src/game/entities/monsters/champion.ts).
 *
 * A LAIR is a boss or a champion, with where it lives and how it is doing.
 * Buildings, the maps, the notice board, the town guide and the Codex all
 * show lairs. Everything here is derived from the analysis (plus the save
 * for "was it beaten?") and never stored, so every place asks the same
 * question and gets the same answer.
 */
import { definitionAt, type FileOutline } from "@/lib/analysis/outline";
import { MONSTERS } from "@/lib/game/catalog";
import { emptyProgress, findingState, type FindingState } from "@/lib/game/progress";
import type { AnalyzedFile, Finding, FindingCategory, RepoAnalysis, RepoProgress, Severity } from "@/lib/types";

/** A dungeon needs at least this many monsters (counting ones already fixed) before it gets a champion. */
export const CHAMPION_MIN_MONSTERS = 4;

/**
 * How a champion fights compared to its species: more HP (never below
 * `minHp`, so even a Dust Bunny champion is a real fight), a bigger body
 * (easier to hit; its contact reach stays the species' own) and better drops.
 */
export const CHAMPION_STATS = {
  hpMultiplier: 2,
  minHp: 10,
  sizeScale: 1.4,
  coinMultiplier: 3,
} as const;

/** Which kinds of bug make the most notable champion when severities tie, most notable first. */
export const CHAMPION_CATEGORY_ORDER: readonly FindingCategory[] = ["security", "syntax", "bug", "trap", "error-handling", "complexity", "unused", "style", "todo"];

const SEVERITY_ORDER: Readonly<Record<Severity, number>> = { boss: 0, elite: 1, minion: 2 };
/** The function name in a champion's title is clipped to this many characters. */
export const MAX_CHAMPION_OF_CHARS = 24;

export type LairKind = "boss" | "champion";

export interface Lair {
  kind: LairKind;
  path: string;
  finding: Finding;
  /** The SPEC's words (progress.ts): alive (still to fight), subdued, fixed or sealed. */
  state: FindingState;
}

type FileFindings = Pick<AnalyzedFile, "findings" | "fixedFindings">;

/** Every monster the dungeon has had: today's findings plus the ones already fixed in the Workshop. */
function bornFindings(file: FileFindings): Finding[] {
  return [...file.findings, ...(file.fixedFindings ?? [])];
}

/** Sorts findings toughest first: severity, then CHAMPION_CATEGORY_ORDER, then position in the file. */
function toughestFirst(a: Finding, b: Finding): number {
  return (
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    CHAMPION_CATEGORY_ORDER.indexOf(a.category) - CHAMPION_CATEGORY_ORDER.indexOf(b.category) ||
    a.line - b.line ||
    a.col - b.col ||
    (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)
  );
}

/** True when the dungeon has (or had, before a fix) a true boss. */
export function hasTrueBoss(file: FileFindings): boolean {
  return bornFindings(file).some((f) => f.severity === "boss");
}

/**
 * The dungeon's champion, or null: no champion when a true boss lives (or
 * lived) there, or when it has fewer than CHAMPION_MIN_MONSTERS monsters.
 * Fixed findings still count, so fixing the champion's bug does not crown
 * the next monster in line. Only the order of the findings matters, so an
 * edit that moves lines without changing the bugs keeps the same champion.
 */
export function championOf(file: FileFindings): Finding | null {
  const all = bornFindings(file);
  if (all.length < CHAMPION_MIN_MONSTERS || hasTrueBoss(file)) return null;
  return [...all].sort(toughestFirst)[0];
}

/** True when this finding is its dungeon's champion. */
export function isChampion(file: FileFindings, finding: Pick<Finding, "id">): boolean {
  return championOf(file)?.id === finding.id;
}

/** A champion's HP: its species' HP times CHAMPION_STATS.hpMultiplier, at least CHAMPION_STATS.minHp. */
export function championHp(speciesHp: number): number {
  return Math.max(CHAMPION_STATS.minHp, Math.round(speciesHp * CHAMPION_STATS.hpMultiplier));
}

/** Text clipped to `max` characters with "…", on one line (repo names are untrusted). */
function clipText(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

/** "Champion Gremlin" and, when the finding sits in a function, "take_order()" (else null). */
export function championTitle(finding: Pick<Finding, "monster" | "line">, outline: FileOutline): { title: string; of: string | null } {
  const definition = definitionAt(outline, finding.line);
  const of = definition ? clipText(definition.kind === "class" ? definition.name : `${definition.name}()`, MAX_CHAMPION_OF_CHARS) : null;
  return { title: `Champion ${MONSTERS[finding.monster].name}`, of };
}

/** "Champion Gremlin of take_order()" (or without "of …" outside a function). */
export function championName(finding: Pick<Finding, "monster" | "line">, outline: FileOutline): string {
  const { title, of } = championTitle(finding, outline);
  return of ? `${title} of ${of}` : title;
}

/** What a lair's monster is called: "Key Thief", or "Champion Gremlin of take_order()". */
export function lairName(lair: Lair, outline: FileOutline): string {
  return lair.kind === "boss" ? MONSTERS[lair.finding.monster].name : championName(lair.finding, outline);
}

/** A file's lairs: one per boss finding, or its champion, or none. */
export function fileLairs(file: AnalyzedFile, progress: RepoProgress): Lair[] {
  if (file.status !== "ok") return [];
  const lair = (kind: LairKind, finding: Finding): Lair => ({ kind, path: file.path, finding, state: findingState(file, finding, progress) });
  if (hasTrueBoss(file)) return bornFindings(file).filter((f) => f.severity === "boss").sort(toughestFirst).map((f) => lair("boss", f));
  const champion = championOf(file);
  return champion ? [lair("champion", champion)] : [];
}

/** Every lair of the repo: bosses first, then champions, each by path and line. */
export function repoLairs(analysis: RepoAnalysis, progress: RepoProgress): Lair[] {
  const lairs = analysis.files.flatMap((file) => fileLairs(file, progress));
  const kindOrder = (l: Lair) => (l.kind === "boss" ? 0 : 1);
  return lairs.sort((a, b) => kindOrder(a) - kindOrder(b) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0) || a.finding.line - b.finding.line);
}

/** How many lairs of each kind the repo has (whatever their state). */
export function lairCounts(analysis: RepoAnalysis): Record<LairKind, number> {
  const counts: Record<LairKind, number> = { boss: 0, champion: 0 };
  for (const lair of repoLairs(analysis, emptyProgress())) counts[lair.kind]++;
  return counts;
}

/** The lair a building shows while it still holds a boss or champion to fight, or null. */
export function aliveLair(file: AnalyzedFile | undefined, progress: RepoProgress): Lair | null {
  if (!file) return null;
  return fileLairs(file, progress).find((l) => l.state === "alive") ?? null;
}

/** Eight compass points, starting east and turning clockwise on screen (y grows southward). */
const COMPASS = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];

/** "north-east": the compass direction of a step (dx, dy) on the map. */
export function compassName(dx: number, dy: number): string {
  const eighth = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return COMPASS[(eighth + COMPASS.length) % COMPASS.length];
}
