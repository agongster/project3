/**
 * MONSTER LOOKS: which variant of its species a monster wears. It is decided
 * by the monster's finding alone, so the dungeon, the Codex, the bug cards,
 * the Workshop's gutter and the bounty posters all draw the same monster.
 *
 *   lookOf(finding) → { family, feature, marking, sizeStep }
 *
 *  - family    its colours. Picked by the RULE CODE, so the same kind of bug
 *              always wears the same colours and players learn them: the
 *              lilac Dust Bunny is an unused import, the sandy one an unused
 *              variable. Plain data in LOOK_FAMILIES.
 *  - feature   ears, horns, eyes, teeth… (incidental variety, seeded)
 *  - marking   plain, spotted, striped or patched (seeded; grid-drawn species only)
 *  - sizeStep  one step smaller or bigger (seeded; never for bosses)
 *
 * "Seeded" means drawn from a hash of the finding's id, so the same finding
 * always looks the same while two findings of one rule rarely look alike.
 * The pictures live in src/game/art/monsters*.ts, which paint exactly as
 * many families and features as these tables list (a test checks it).
 */
import { ruleInfo } from "@/lib/analysis/rules";
import { hashString, mulberry32 } from "@/lib/rng";
import type { Finding, MonsterKind, SaveData, Severity } from "@/lib/types";

/** One colour family of a species and the rules that wear it. */
export interface LookFamily {
  /** Shown in the Codex and on the dev page, e.g. "Import Bunny". */
  name: string;
  /** Exact rule codes. */
  codes?: readonly string[];
  /** Rule code prefixes ("SIM" = every simplification rule). The longest match wins. */
  prefixes?: readonly string[];
}

export interface MonsterLook {
  /** Index into LOOK_FAMILIES[kind]. */
  family: number;
  /** Index into LOOK_FEATURES[kind]. */
  feature: number;
  /** Index into LOOK_MARKINGS (0 = plain). */
  marking: number;
  /** -1, 0 or +1 size step (see SIZE_STEP_SCALE). */
  sizeStep: number;
}

/** The look of a monster nobody knows anything about (the species' first, classic picture). */
export const PLAIN_LOOK: MonsterLook = { family: 0, feature: 0, marking: 0, sizeStep: 0 };

/** Each species' colour families. The first is its classic look. */
export const LOOK_FAMILIES: Readonly<Record<MonsterKind, readonly LookFamily[]>> = {
  dustBunny: [
    { name: "Import Bunny", codes: ["F401"] },
    { name: "Variable Bunny", codes: ["F841", "F842"] },
    { name: "Loop Bunny", codes: ["B007"] },
  ],
  todoMite: [
    { name: "TODO Mite", codes: ["FIX002"] },
    { name: "FIXME Mite", codes: ["FIX001"] },
    { name: "Hack Mite", codes: ["FIX003", "FIX004"], prefixes: ["FIX"] },
    { name: "Fossil Mite", codes: ["ERA001"], prefixes: ["ERA"] },
  ],
  echoBat: [
    { name: "Simplify Bat", prefixes: ["SIM"] },
    { name: "Compare Bat", codes: ["E711", "E712", "E721"] },
    { name: "Twin Bat", codes: ["F811", "F403", "F541", "PLW0127"] },
    { name: "Idle Bat", codes: ["B009", "B010", "B018", "B024", "B027", "B033", "E731", "E741"], prefixes: ["PLW", "E"] },
  ],
  gremlin: [
    { name: "Pyflakes Gremlin", prefixes: ["F"] },
    { name: "Gotcha Gremlin", prefixes: ["B"] },
    { name: "Crash Gremlin", prefixes: ["PLE", "PLW", "PL"] },
    { name: "Network Gremlin", prefixes: ["S"] },
  ],
  phantom: [
    { name: "Nameless Phantom", codes: ["F821"] },
    { name: "Export Phantom", codes: ["F822"] },
    { name: "Early Phantom", codes: ["F823"] },
  ],
  mimic: [
    { name: "Default Mimic", codes: ["B006", "B008"] },
    { name: "Builtin Mimic", codes: ["A001", "A002", "F402"], prefixes: ["A"] },
    { name: "Loop Mimic", codes: ["B005", "B019", "B020", "B023", "B026", "B909", "PLW0642", "PLW0711"] },
    { name: "Vault Mimic", prefixes: ["S"] },
  ],
  swallowToad: [
    { name: "Bare Toad", codes: ["E722"] },
    { name: "Blind Toad", codes: ["BLE001"], prefixes: ["BLE"] },
    { name: "Silent Toad", codes: ["S110", "S112"] },
    { name: "Lost Toad", codes: ["B012", "B017", "B904"] },
  ],
  spaghetti: [
    { name: "Marinara Beast", codes: ["C901"], prefixes: ["C9"] },
    { name: "Pesto Beast", codes: ["PLR0913"] },
    { name: "Alfredo Beast", codes: ["PLR0911", "PLR0912"] },
    { name: "Squid Ink Beast", codes: ["PLR0915"], prefixes: ["PLR"] },
  ],
  keyThief: [
    { name: "Password Thief", codes: ["S105"] },
    { name: "Argument Thief", codes: ["S106"] },
    { name: "Default Thief", codes: ["S107"] },
    { name: "Eavesdropper", codes: ["S323", "S501", "S507"] },
  ],
  evalSerpent: [
    { name: "Eval Serpent", codes: ["S102", "S307"] },
    { name: "Shell Serpent", codes: ["S601", "S602", "S604", "S605", "S609"] },
    { name: "SQL Serpent", codes: ["S608", "S610", "S611"] },
    { name: "Pickle Serpent", codes: ["S201", "S301", "S302", "S506", "S612"] },
  ],
  glitchKing: [
    { name: "Glitch King", codes: ["SYNTAX"] },
    { name: "Compile King", prefixes: ["F7", "F6", "PLE"] },
  ],
};

/** Each species' feature variants (ears, horns, eyes…), in the order the art paints them. */
export const LOOK_FEATURES: Readonly<Record<MonsterKind, readonly string[]>> = {
  dustBunny: ["perky ears", "floppy ear", "stubby ears"],
  todoMite: ["straight antennae", "curly antennae"],
  echoBat: ["pointy ears", "round ears", "big fangs"],
  gremlin: ["pointy ears", "little horns"],
  phantom: ["wide eyes", "sleepy eyes"],
  mimic: ["white teeth", "gold tooth"],
  swallowToad: ["smooth", "warty"],
  spaghetti: ["two eyes", "meatball hat"],
  keyThief: ["classic"],
  evalSerpent: ["classic"],
  glitchKing: ["classic"],
};

/** Fur patterns. Only species drawn from a grid with a body colour can wear them (see MARKED_KINDS). */
export const LOOK_MARKINGS: readonly string[] = ["plain", "spotted", "striped", "patched"];

/** Species whose sprite is a palette grid with a body tone the markings can paint on. */
export const MARKED_KINDS: ReadonlySet<MonsterKind> = new Set<MonsterKind>(["dustBunny", "todoMite", "echoBat", "gremlin", "phantom", "mimic", "swallowToad"]);

/** Size steps a monster may get; 0 twice so most monsters keep the usual size. */
const SIZE_STEPS: readonly number[] = [-1, 0, 0, 1];
/** One size step scales the body by this much (1/8: a 16 px sprite becomes 14 or 18 px). */
export const SIZE_STEP_SCALE = 0.125;
/** Bosses always keep their size: their arenas and moves are tuned to it. */
const FIXED_SIZE: ReadonlySet<Severity> = new Set<Severity>(["boss"]);

/** The rule code inside a finding id (`path:line:col:CODE`). */
export function codeFromId(id: string): string {
  return id.slice(id.lastIndexOf(":") + 1);
}

/** Which colour family a rule code wears for this species: exact code, then the longest prefix, then a hash of the code. */
export function familyFor(kind: MonsterKind, code: string): number {
  const families = LOOK_FAMILIES[kind];
  const exact = families.findIndex((f) => f.codes?.includes(code));
  if (exact >= 0) return exact;
  let best = -1;
  let bestLength = 0;
  families.forEach((f, i) => {
    for (const prefix of f.prefixes ?? []) {
      if (code.startsWith(prefix) && prefix.length > bestLength) {
        best = i;
        bestLength = prefix.length;
      }
    }
  });
  return best >= 0 ? best : hashString(code) % families.length;
}

/** A whole number in [0, count) from the seeded generator. */
function pickIndex(random: () => number, count: number): number {
  return Math.min(count - 1, Math.floor(random() * count));
}

/** The look of a finding's monster (see the file comment). Same finding, same look. */
export function lookOf(finding: Pick<Finding, "id" | "code" | "monster" | "severity">): MonsterLook {
  const kind = finding.monster;
  const random = mulberry32(hashString(finding.id));
  const feature = pickIndex(random, LOOK_FEATURES[kind].length);
  const marking = MARKED_KINDS.has(kind) ? pickIndex(random, LOOK_MARKINGS.length) : 0;
  const sizeStep = SIZE_STEPS[pickIndex(random, SIZE_STEPS.length)];
  return { family: familyFor(kind, finding.code), feature, marking, sizeStep: FIXED_SIZE.has(finding.severity) ? 0 : sizeStep };
}

/** How much bigger (or smaller) a look draws the body. */
export function lookScale(look: MonsterLook): number {
  return 1 + look.sizeStep * SIZE_STEP_SCALE;
}

/** "Import Bunny": the name of a look's colour family. */
export function familyName(kind: MonsterKind, family: number): string {
  const families = LOOK_FAMILIES[kind];
  return families[Math.max(0, Math.min(families.length - 1, family))].name;
}

/**
 * Which colour families of each species the player has met in this save,
 * in any repo: read from the ids of every subdued and every fixed finding
 * (an id ends with its rule code, and the code says the species and family).
 */
export function familiesMet(save: Pick<SaveData, "repos">): Map<MonsterKind, Set<number>> {
  const met = new Map<MonsterKind, Set<number>>();
  for (const progress of Object.values(save.repos)) {
    for (const id of [...progress.defeated, ...(progress.fixes ?? [])]) {
      const code = codeFromId(id);
      const kind = ruleInfo(code).monster;
      const families = met.get(kind) ?? new Set<number>();
      families.add(familyFor(kind, code));
      met.set(kind, families);
    }
  }
  return met;
}
