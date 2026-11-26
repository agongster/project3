/**
 * MONSTER TRAITS: how a monster's fight shows the bug it stands for, and
 * the one plain-English line that says so (shown in the Codex, on the boss
 * bug card and in the Finisher).
 *
 * Like rules.ts next door, this file is deliberately DATA. A rule code gets
 * a row in TRAITS_BY_CODE; codes without a row get their monster's row in
 * TRAITS_BY_MONSTER, or no trait at all. Keying on the rule code matters:
 * one monster kind stands for several rules, and a behaviour only makes
 * sense for some of them (the Echo Bat only brings a twin for code that
 * really says something twice).
 *
 * `behaviour` picks what the engine does (src/game/entities/monsters/traits/);
 * null means the monster's usual way of fighting already fits, so it only
 * gets the line. In a line, {name} becomes a name read from the finding
 * (traitNames.ts) — the line is shown as plain text, never as HTML.
 */
import type { Finding, MonsterKind } from "@/lib/types";
import { firstName, undefinedName, unusedTag } from "./traitNames";

export type TraitBehaviour =
  /** Phantom: a shimmer until a rune with its name is stepped on (or it is hit a few times). */
  | "undefinedName"
  /** Grows bigger (and slower) with every hit: state kept between calls. */
  | "growsWhenHit"
  /** Swallow Toad: gulps the hero's projectiles, then burps them back up. */
  | "swallowsShots"
  /** Echo Bat: comes with an echo, a second body for the same finding. */
  | "echoTwin"
  /** Dust Bunny / Key Thief: leaves the name nobody used (or the leaked secret) behind. */
  | "leavesName"
  /** Todo Mite: squeaks its own note while it runs. */
  | "squeaksNote"
  /** Mimic: wears the builtin's name while it hides. */
  | "wearsName"
  /** Spaghetti Beast: one flailing noodle per branch (or argument). */
  | "noodles";

export interface TraitRow {
  behaviour: TraitBehaviour | null;
  /** May contain {name}. */
  line: string;
}

/** Every toad line ends the same way, so players learn the counter. */
const BURP = "Three gulps and it burps them back up, dazed.";
/** Every echo line ends the same way. */
const ECHO = "Beat both quickly for a bonus.";
const UNDEFINED = (bug: string): TraitRow => ({ behaviour: "undefinedName", line: `Only a shimmer until you step on the rune that spells {name}. ${bug}` });
const SWALLOW = (like: string): TraitRow => ({ behaviour: "swallowsShots", line: `Gulps down your shots, like ${like}. ${BURP}` });
const TWIN = (why: string): TraitRow => ({ behaviour: "echoTwin", line: `Comes with an echo: ${why}. ${ECHO}` });
const LEAVES = (what: string): TraitRow => ({ behaviour: "leavesName", line: `When beaten it drops {name}, ${what}, and the dust gets swept away.` });
const WEARS = (why: string): TraitRow => ({ behaviour: "wearsName", line: `Wears the name {name} until you come close: ${why}.` });
const NOODLES = (why: string): TraitRow => ({ behaviour: "noodles", line: `Flails one noodle ${why}.` });
const EAVESDROPS = (why: string): TraitRow => ({ behaviour: null, line: `Listens in on every secret you send: ${why}, so anyone on the network can read them.` });
const WONT_COMPILE: TraitRow = { behaviour: null, line: "Flickers and falls apart: Python refuses to compile this file, so none of it runs." };

export const TRAITS_BY_CODE: Readonly<Record<string, TraitRow>> = {
  // ── Phantom: names that do not exist ──
  F821: UNDEFINED("Python can't use a name nobody defined."),
  F822: UNDEFINED("`__all__` lists a name the module never defines."),
  F823: UNDEFINED("The variable is read before it is given a value."),

  // ── Mutable defaults: state that leaks from one call to the next ──
  B006: { behaviour: "growsWhenHit", line: "Grows with every hit and stays big: a mutable default keeps what it collected from one call to the next." },
  B039: { behaviour: "growsWhenHit", line: "Grows with every hit and stays big: a mutable ContextVar default is shared, so it keeps everything added to it." },

  // ── Swallow Toad: errors that vanish ──
  E722: SWALLOW("a bare `except:` swallowing every error"),
  BLE001: SWALLOW("`except Exception` catching every error, even real bugs"),
  S110: SWALLOW("`except: pass` making errors vanish without a trace"),
  S112: SWALLOW("`except: continue` skipping errors without a word"),
  B012: SWALLOW("a `return` in `finally` quietly throwing the error away"),
  B017: SWALLOW("a test that passes whatever error is raised"),
  B904: SWALLOW("re-raising without `from err`, which loses the original error"),

  // ── Echo Bat: code that says the same thing twice ──
  F811: TWIN("the same name is defined twice and only the last copy counts"),
  B033: TWIN("the same item is written twice in one set"),
  PLW0127: TWIN("`x = x` hands a name to itself"),
  PLW3301: TWIN("`max(a, max(b, c))` calls the same function twice where once is enough"),
  SIM101: TWIN("`isinstance` is called twice where one call with a tuple would do"),
  SIM102: TWIN("two nested `if`s could be a single `if a and b`"),
  SIM103: TWIN("`if x: return True else: return False` says the condition twice"),
  SIM110: TWIN("the loop rewrites what `any()` / `all()` already does"),
  SIM118: TWIN("`key in d.keys()` says keys twice, and `key in d` already checks them"),
  SIM210: TWIN("`True if x else False` says the bool twice, and `bool(x)` is enough"),
  E712: TWIN("`x == True` says True twice, and `if x:` is enough"),

  // ── Dust Bunny: things nobody used ──
  F401: LEAVES("the import nobody used"),
  F841: LEAVES("the variable nobody used"),
  F842: LEAVES("the annotated variable nobody used"),
  B007: LEAVES("the loop variable nobody used"),

  // ── Todo Mite: notes left for later ──
  FIX001: { behaviour: "squeaksNote", line: "Runs away squeaking its own FIXME: a known problem that keeps waiting to be fixed 'later'." },
  FIX002: { behaviour: "squeaksNote", line: "Runs away squeaking its own TODO: a job that keeps promising to get done 'later'." },
  ERA001: { behaviour: "squeaksNote", line: "Runs away mumbling old code: commented-out code that nobody runs any more." },

  // ── Mimic: names that hide builtins and imports ──
  A001: WEARS("a variable named like a builtin hides the real {name} for the rest of the code"),
  A002: WEARS("an argument named like a builtin hides the real {name} inside the function"),
  F402: WEARS("a loop variable reuses an import's name and hides the import"),

  // ── Spaghetti Beast: code with too many paths ──
  PLR0911: NOODLES("for every branch in its function: so many ways out that nobody can follow them all"),
  PLR0913: NOODLES("per argument: a function that takes this many is hard to call right"),
  PLR0915: NOODLES("for every branch in its function: too long and tangled to read in one go"),

  // ── Key Thief: secrets in plain sight ──
  S105: { behaviour: "leavesName", line: "Scatters keys everywhere and drops {name} when beaten: a password written in the code leaks to everyone who reads it." },
  S106: { behaviour: "leavesName", line: "Scatters keys everywhere and drops {name} when beaten: a password passed as a literal leaks to everyone who reads it." },
  S107: { behaviour: "leavesName", line: "Scatters keys everywhere and drops {name} when beaten: a default password leaks to everyone who reads the code." },
  S323: EAVESDROPS("an unverified SSL context never checks who it is talking to"),
  S501: EAVESDROPS("`verify=False` switches the certificate check off"),
  S507: EAVESDROPS("an SSH client that trusts any host key talks to impostors too"),

  // ── Eval Serpent: input that becomes code ──
  S102: { behaviour: null, line: "Spits back whatever it is fed: `exec` runs any text as code, even an attacker's." },
  S307: { behaviour: null, line: "Spits back whatever it is fed: `eval` runs any text as code, even an attacker's." },
  S602: { behaviour: null, line: "Spits back whatever it is fed: `shell=True` lets text become shell commands." },
  S604: { behaviour: null, line: "Spits back whatever it is fed: `shell=True` lets text become shell commands." },
  S605: { behaviour: null, line: "Spits back whatever it is fed: running text through a shell lets it become commands." },
  S608: { behaviour: null, line: "Spits back whatever it is fed: SQL glued together from strings lets input become commands." },
  S201: { behaviour: null, line: "Spits back whatever it is fed: Flask's debug console runs any Python a visitor types." },

  // ── Glitch King: code Python refuses to compile ──
  F622: WONT_COMPILE,
  F701: WONT_COMPILE,
  F702: WONT_COMPILE,
  F704: WONT_COMPILE,
  F706: WONT_COMPILE,
  F707: WONT_COMPILE,
  PLE0115: WONT_COMPILE,
  PLE0117: WONT_COMPILE,
  PLE0118: WONT_COMPILE,
  PLE1142: WONT_COMPILE,
};

/** The fallback for codes without a row: what the kind always does. */
export const TRAITS_BY_MONSTER: Readonly<Partial<Record<MonsterKind, TraitRow>>> = {
  phantom: UNDEFINED("Python can't use a name nobody defined."),
  swallowToad: SWALLOW("an `except` that hides errors"),
  dustBunny: LEAVES("the name nobody used"),
  todoMite: { behaviour: "squeaksNote", line: "Runs away squeaking its own note: a reminder left for 'later' that keeps on waiting." },
  mimic: { behaviour: null, line: "Sits still, looking like a harmless chest, until you come close: code that looks innocent but hides a trap." },
  spaghetti: NOODLES("for every branch in its function: too many paths to follow at once"),
  keyThief: { behaviour: "leavesName", line: "Scatters keys everywhere and drops {name} when beaten: a secret written in the code leaks to everyone who reads it." },
  evalSerpent: { behaviour: null, line: "Will run anything you feed it: input that becomes code or commands can be abused by an attacker." },
  glitchKing: { behaviour: null, line: "Flickers and falls apart: Python can't even read this file, so none of it runs." },
};

type TraitFinding = Pick<Finding, "code" | "monster" | "message" | "snippet">;

/** The trait row for a finding, or null when its monster fights the plain way. */
export function traitRow(finding: Pick<Finding, "code" | "monster">): TraitRow | null {
  return TRAITS_BY_CODE[finding.code] ?? TRAITS_BY_MONSTER[finding.monster] ?? null;
}

/** Which behaviour the engine gives this finding's monster (null = its usual fight). */
export function traitBehaviour(finding: Pick<Finding, "code" | "monster">): TraitBehaviour | null {
  return traitRow(finding)?.behaviour ?? null;
}

/** The name a line's {name} stands for, quoted like code: `cauldron`, `import os`, `list`. */
function lineName(finding: TraitFinding, behaviour: TraitBehaviour | null): string {
  const name = behaviour === "undefinedName" ? undefinedName(finding) : behaviour === "leavesName" ? (unusedTag(finding) ?? firstName(finding)) : firstName(finding);
  return `\`${name ?? "it"}\``;
}

/** The plain-English trait line for a finding (with its own names filled in), or null when it has none. */
export function traitLine(finding: TraitFinding): string | null {
  const row = traitRow(finding);
  if (!row) return null;
  return row.line.replaceAll("{name}", lineName(finding, row.behaviour));
}
