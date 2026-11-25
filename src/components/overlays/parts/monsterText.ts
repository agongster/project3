/**
 * Display text and colours for monsters and severities, shared by the
 * codex, the notice board and the boss bug card.
 */
import type { MonsterKind, Severity } from "@/lib/types";

export const SEVERITIES: readonly Severity[] = ["minion", "elite", "boss"];

export const SEVERITY_INFO: Readonly<Record<Severity, { label: string; color: string; plural: string }>> = {
  minion: { label: "Minion", plural: "Minions", color: "#7ec850" },
  elite: { label: "Elite", plural: "Elites", color: "#ffa94d" },
  boss: { label: "Boss", plural: "Bosses", color: "#e5484d" },
};

/** What kind of real code problem each monster stands for (bestiary "Embodies:" line). */
export const MONSTER_EMBODIES: Readonly<Record<MonsterKind, string>> = {
  dustBunny: "Unused imports, variables and arguments",
  todoMite: "TODO / FIXME notes and commented-out code",
  echoBat: "Redundant code and small style slips",
  gremlin: "Likely bugs that break at runtime",
  phantom: "Names that were never defined",
  mimic: "Innocent-looking traps, like mutable default arguments",
  swallowToad: "Bare or overly broad excepts that hide errors",
  spaghetti: "Functions that are too long or too tangled",
  keyThief: "Passwords and secrets written into the code",
  evalSerpent: "eval / exec, shell injection and other security risks",
  glitchKing: "Syntax errors: code Python cannot even read",
};
