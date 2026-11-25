/**
 * The linter's rulebook: which Ruff rules Lintlands turns on, and which
 * monster each rule becomes.
 *
 * This file is deliberately *data*, not logic. To add a monster for a new rule:
 *   1. add its code (or its family prefix) to MONSTER_RULES,
 *   2. add a row to RULE_TABLE with a friendly title, a monster and a tip.
 * Rules without a row still work: they fall back to PREFIX_FALLBACKS.
 *
 * Rule codes are Ruff's: https://docs.astral.sh/ruff/rules/
 * The rule selection below was tuned by linting ~15 real Python packages
 * (click, attrs, boltons, conda, matplotlib, httpx, …) and dropping rules
 * that produced lots of hits nobody would call a bug.
 */
import { MONSTERS } from "@/lib/game/catalog";
import type { FileKind, FindingCategory, MonsterKind, Severity } from "@/lib/types";

// ───────────────────────── Rule selection ─────────────────────────

/** Rules whose hits become monsters. */
export const MONSTER_RULES: readonly string[] = [
  // Pyflakes: unused imports/variables, undefined names, broken format strings…
  // Almost never wrong, so we take the whole family.
  "F",
  // pycodestyle: only the rules that point at real mistakes, not whitespace.
  // (Syntax errors need no rule: Ruff always reports them as `invalid-syntax`.)
  "E711", // == None
  "E712", // == True
  "E721", // type(x) == y
  "E722", // bare except
  "E731", // lambda assigned to a name
  "E741", // variable called l / O / I
  // flake8-bugbear: classic Python gotchas (mutable defaults, loop closures…).
  "B",
  // flake8-bandit: security problems (eval, shell=True, hardcoded passwords…).
  "S",
  // McCabe complexity: functions with too many paths through them.
  "C901",
  // Pylint errors (code that will crash) and the "too many …" size checks.
  // PLR0912 (too many branches) is left out on purpose: C901 already counts
  // branches, and enabling both spawned two monsters for the same function.
  "PLE",
  "PLR0911", // too many return statements
  "PLR0913", // too many arguments
  "PLR0915", // too many statements
  // A few valuable Pylint warnings (each one is almost always a real slip).
  "PLW0120", // else on a loop without break
  "PLW0127", // x = x
  "PLW0128", // a, a = …
  "PLW0129", // assert "non-empty string" (always true)
  "PLW0131", // walrus used where it does nothing
  "PLW0133", // ValueError("…") without raise
  "PLW0177", // x == float("nan")
  "PLW0211", // @staticmethod with a `self` argument
  "PLW0602", // `global x` but x is never assigned
  "PLW0642", // reassigning self / cls
  "PLW0711", // except A or B
  "PLW1501", // open() with an invalid mode
  "PLW1508", // os.getenv default that is not a string
  "PLW2101", // `with threading.Lock():` that locks nothing
  "PLW3301", // max(a, max(b, c))
  // Catching every exception, shadowing builtins, leftover notes.
  "BLE001",
  "A001", // variable named like a builtin (list = …)
  "A002", // argument named like a builtin (def f(list): …)
  "ERA001", // commented-out code
  "FIX001", // FIXME
  "FIX002", // TODO
  "FIX003", // XXX
  "FIX004", // HACK
  // A *small* set of simplifications that make code clearly nicer.
  // SIM108 (ternary instead of if/else) was dropped: it is a matter of taste
  // and was the most frequent hit in matplotlib.
  "SIM101", // isinstance(x, A) or isinstance(x, B)
  "SIM102", // nested ifs that could be one
  "SIM103", // if cond: return True else: return False
  "SIM110", // a loop that re-implements any()/all()
  "SIM118", // key in d.keys()
  "SIM210", // True if cond else False
  "SIM300", // "yoda" comparisons: if 42 == answer
];

/**
 * "Quality probe" rules never become monsters. They are only counted to grade
 * how nice a file is (see quality.ts).
 */
export const PROBE_RULES: readonly string[] = [
  // Missing docstrings: module, class, method, function.
  "D100",
  "D101",
  "D102",
  "D103",
  // Missing type hints: argument, public return, private return.
  "ANN001",
  "ANN201",
  "ANN202",
  // Tidiness: very long lines, several statements on one line, odd names.
  "E501",
  "E701",
  "E702",
  "N801", // class names should be CapWords
  "N802", // function names should be snake_case
  "N803", // argument names should be snake_case
  "N806", // local variable names should be snake_case
];

/** Rules inside the selected families that we switch off again. */
export const IGNORED_RULES: readonly string[] = [
  "S101", // assert: pytest is built on it
  "S311", // random: games and simulations use it legitimately all the time
  "S603", // subprocess without shell=True: flags every subprocess call
  "S606", // starting a process without a shell: same
  "S607", // "partial executable path": flags `git`, `python`, …
  "B028", // warnings.warn without stacklevel: pedantic
  "B905", // zip() without strict=: style preference
  "B911", // itertools.batched() without strict=
  "B912", // map() without strict=
  "F405", // "may be undefined from star import": one hit per *use*, very noisy
];

/**
 * Ruff in the browser only sees source text, not file names, so it cannot
 * apply per-file ignores. We drop these codes ourselves in test files, where
 * fake passwords and many-argument fixtures are normal.
 */
export const IGNORED_IN_TESTS: ReadonlySet<string> = new Set([
  "S105", // TEST_PASSWORD = "hunter2"
  "S106",
  "S107",
  "S108", // "/tmp/…" paths
  "PLR0913", // pytest tests take one argument per fixture
]);

/**
 * Options for `new Workspace(RUFF_OPTIONS, PositionEncoding.Utf16)`.
 * Keys must be kebab-case exactly as in Ruff's docs: Ruff silently ignores
 * unknown keys, so a typo here would quietly do nothing (a test guards this).
 */
export const RUFF_OPTIONS = {
  // Newest Python, so modern syntax (match, type X = …) is never a "syntax error".
  "target-version": "py314",
  // Only used by the E501 probe; 100 is a common, forgiving limit.
  "line-length": 100,
  lint: {
    select: [...MONSTER_RULES, ...PROBE_RULES],
    ignore: [...IGNORED_RULES],
    mccabe: { "max-complexity": 10 },
    // 8+ arguments is a genuine smell; Pylint's default of 5 flagged half of httpx.
    pylint: { "max-args": 8, "max-returns": 6, "max-statements": 50 },
    // Parameter names like `id`, `type` and `format` are idiomatic in APIs.
    // Shadowing `list`, `dict`, `str`, … is still reported.
    "flake8-builtins": {
      ignorelist: ["id", "type", "format", "help", "dir", "input", "hash", "filter", "vars", "bin", "hex", "ascii", "license", "copyright", "credits", "exit", "quit"],
    },
  },
};

const PROBE_SET: ReadonlySet<string> = new Set(PROBE_RULES);

/** True for quality-probe rules (graded, never turned into monsters). */
export function isProbeRule(code: string): boolean {
  return PROBE_SET.has(code);
}

/** True when a monster rule should be skipped for this kind of file. */
export function isIgnoredForFile(code: string, kind: FileKind): boolean {
  return kind === "test" && IGNORED_IN_TESTS.has(code);
}

// ─────────────────────── Rule → monster table ───────────────────────

/** Everything a Finding needs to know about its rule. */
export interface RuleInfo {
  title: string;
  severity: Severity;
  category: FindingCategory;
  monster: MonsterKind;
  tip: string;
}

/** One row of the table. Severity always comes from the monster (catalog.ts). */
interface RuleRow {
  monster: MonsterKind;
  title: string;
  tip: string;
  /** Only needed when it differs from the monster's usual category. */
  category?: FindingCategory;
}

/** The code we give syntax errors (Ruff itself reports them without a rule code). */
export const SYNTAX_CODE = "SYNTAX";

/** What each monster usually stands for. */
const MONSTER_CATEGORY: Record<MonsterKind, FindingCategory> = {
  dustBunny: "unused",
  todoMite: "todo",
  echoBat: "style",
  gremlin: "bug",
  phantom: "bug",
  mimic: "trap",
  swallowToad: "error-handling",
  spaghetti: "complexity",
  keyThief: "security",
  evalSerpent: "security",
  glitchKing: "syntax",
};

/** Exact entries for common and important codes. */
const RULE_TABLE: Record<string, RuleRow> = {
  // ── Syntax ──
  [SYNTAX_CODE]: { monster: "glitchKing", title: "Syntax error", tip: "Python can't read this file at all — check the marked line for a missing bracket, colon or quote." },

  // ── Pyflakes ──
  F401: { monster: "dustBunny", title: "Unused import", tip: "Delete the import, or add the name to `__all__` if it is meant to be re-exported." },
  F402: { monster: "mimic", title: "Loop variable hides an import", tip: "Rename the loop variable so it doesn't replace the imported module." },
  F403: { monster: "echoBat", title: "Wildcard import", tip: "Import the names you need explicitly so readers know where they come from." },
  F541: { monster: "echoBat", title: "f-string without placeholders", tip: "Drop the `f` prefix — there is nothing to fill in." },
  F601: { monster: "gremlin", title: "Duplicate dictionary key", tip: "Only the last value survives; remove or rename the duplicate key." },
  F632: { monster: "gremlin", title: "`is` used with a literal", tip: "Use `==` to compare values; `is` checks identity and may randomly fail." },
  F811: { monster: "echoBat", title: "Redefined before use", tip: "Remove the earlier definition or give one of them a different name." },
  F821: { monster: "phantom", title: "Undefined name", tip: "Define or import the name before using it — or fix the typo." },
  F822: { monster: "phantom", title: "Undefined name in `__all__`", tip: "Only list names that the module actually defines." },
  F823: { monster: "phantom", title: "Variable used before assignment", tip: "Assign the variable before reading it, or mark it `global`/`nonlocal` if that was the intent." },
  F841: { monster: "dustBunny", title: "Unused variable", tip: "Delete the assignment, or use `_` if you only need the side effect." },
  F842: { monster: "dustBunny", title: "Unused annotated variable", tip: "Remove the annotation-only line if nothing uses it." },

  // ── pycodestyle ──
  E711: { monster: "echoBat", title: "Comparison to None with ==", tip: "Write `x is None` (or `is not None`)." },
  E712: { monster: "echoBat", title: "Comparison to True/False", tip: "Write `if x:` or `if not x:` instead of comparing to a boolean." },
  E721: { monster: "echoBat", title: "Type comparison with ==", tip: "Use `isinstance(x, Kind)`, which also accepts subclasses." },
  E722: { monster: "swallowToad", title: "Bare except", tip: "Catch the specific exception you expect, e.g. `except ValueError:`." },
  E731: { monster: "echoBat", title: "Lambda assigned to a name", tip: "Use a regular `def` — it gets a real name in tracebacks." },
  E741: { monster: "echoBat", title: "Ambiguous variable name", tip: "Avoid `l`, `O` and `I`; they look like 1 and 0. Pick a descriptive name." },

  // ── flake8-bugbear ──
  B002: { monster: "gremlin", title: "`++x` does nothing", tip: "Python has no `++` operator; write `x += 1`." },
  B004: { monster: "gremlin", title: "Unreliable callable check", tip: "Use `callable(x)` instead of `hasattr(x, \"__call__\")`." },
  B005: { monster: "mimic", title: "strip() with a multi-character string", tip: "strip() removes *characters*, not a suffix — use `removeprefix`/`removesuffix`." },
  B006: { monster: "mimic", title: "Mutable default argument", tip: "Default to `None` and create the list/dict inside the function." },
  B007: { monster: "dustBunny", title: "Unused loop variable", tip: "Rename it to `_` (or `_name`) to show it is intentionally unused." },
  B008: { monster: "mimic", title: "Function call in default argument", tip: "Defaults are evaluated once; default to `None` and call the function inside." },
  B009: { monster: "echoBat", title: "getattr with a constant", tip: "Just write `obj.name` — getattr only helps when the name is dynamic." },
  B010: { monster: "echoBat", title: "setattr with a constant", tip: "Just write `obj.name = value`." },
  B011: { monster: "gremlin", title: "assert False", tip: "`python -O` strips asserts; raise `AssertionError` (or a better exception) instead." },
  B012: { monster: "swallowToad", title: "return/break in finally", tip: "Jumping out of `finally` silently discards any exception — move it out of the block." },
  B015: { monster: "gremlin", title: "Comparison result unused", tip: "The result is thrown away — did you mean to `assert` it or assign with `=`?" },
  B016: { monster: "gremlin", title: "Raising a literal", tip: "Raise an exception object, e.g. `raise ValueError(\"…\")`." },
  B017: { monster: "swallowToad", title: "Test catches any exception", tip: "Assert the specific exception type, or the test passes for the wrong reason." },
  B018: { monster: "echoBat", title: "Useless expression", tip: "This line computes a value and throws it away — delete it or use the value." },
  B019: { monster: "mimic", title: "lru_cache on a method", tip: "The cache keeps `self` alive forever; cache a module-level function instead." },
  B020: { monster: "mimic", title: "Loop variable overwrites the iterable", tip: "Give the loop variable a different name than the thing you loop over." },
  B023: { monster: "mimic", title: "Closure captures a loop variable", tip: "Bind the current value with a default argument (`lambda x=x: …`)." },
  B024: { monster: "echoBat", title: "Abstract class without abstract methods", tip: "Mark at least one method `@abstractmethod`, or drop `ABC`." },
  B026: { monster: "mimic", title: "*args after a keyword argument", tip: "Put `*args` before keyword arguments; the current order is confusing." },
  B027: { monster: "echoBat", title: "Empty method in an abstract class", tip: "Decorate it with `@abstractmethod` if subclasses must override it." },
  B033: { monster: "echoBat", title: "Duplicate item in a set", tip: "Remove the repeated value." },
  B904: { monster: "swallowToad", title: "Exception context lost", tip: "Use `raise NewError(…) from err` so the original cause is kept." },
  B909: { monster: "mimic", title: "List modified while looping over it", tip: "Loop over a copy (`for x in items[:]`) or build a new list." },

  // ── flake8-bandit: bosses ──
  S102: { monster: "evalSerpent", title: "Use of exec()", tip: "Avoid running strings as code; call real functions or use a lookup table." },
  S105: { monster: "keyThief", title: "Hardcoded password", tip: "Read secrets from an environment variable or a secrets manager, never the source." },
  S106: { monster: "keyThief", title: "Hardcoded password argument", tip: "Pass the secret in from an environment variable instead of a string literal." },
  S107: { monster: "keyThief", title: "Hardcoded password default", tip: "Don't give passwords a default value; require the caller to provide one." },
  S301: { monster: "evalSerpent", title: "Unsafe pickle load", tip: "Unpickling untrusted data runs arbitrary code — use JSON for data you didn't create." },
  S307: { monster: "evalSerpent", title: "Use of eval()", tip: "Use `ast.literal_eval` for data, or parse the input explicitly." },
  S506: { monster: "evalSerpent", title: "Unsafe yaml.load", tip: "Use `yaml.safe_load`, which can't construct arbitrary objects." },
  S602: { monster: "evalSerpent", title: "Shell injection (shell=True)", tip: "Pass a list of arguments without `shell=True` so input can't become commands." },
  S604: { monster: "evalSerpent", title: "Call with shell=True", tip: "Avoid `shell=True`; pass arguments as a list." },
  S605: { monster: "evalSerpent", title: "Command run through a shell", tip: "Use `subprocess.run([...])` with an argument list instead of `os.system`." },
  S608: { monster: "evalSerpent", title: "SQL built from strings", tip: "Use query parameters (`?` / `%s` placeholders) instead of formatting SQL yourself." },

  // ── flake8-bandit: lower-danger traps (elites) ──
  S103: { monster: "mimic", category: "security", title: "Overly open file permissions", tip: "Grant only the permissions needed, e.g. `0o600` for private files." },
  S104: { monster: "mimic", category: "security", title: "Listening on all interfaces", tip: "Bind to `127.0.0.1` unless the service really must be public." },
  S108: { monster: "mimic", category: "security", title: "Hardcoded temp file", tip: "Use the `tempfile` module so other users can't hijack the path." },
  S110: { monster: "swallowToad", title: "try-except-pass", tip: "At least log the exception so failures don't vanish silently." },
  S112: { monster: "swallowToad", title: "try-except-continue", tip: "Log the exception before skipping, so you know what went wrong." },
  S113: { monster: "gremlin", category: "security", title: "Request without a timeout", tip: "Pass `timeout=…` so a slow server can't hang your program forever." },
  S201: { monster: "mimic", category: "security", title: "Flask debug mode", tip: "Never ship `debug=True`; it lets visitors run code on your server." },
  S202: { monster: "mimic", category: "security", title: "Unsafe tar extraction", tip: "Pass `filter=\"data\"` to `extractall` so archives can't write outside the folder." },
  S306: { monster: "mimic", category: "security", title: "Insecure mktemp", tip: "Use `tempfile.mkstemp` or `NamedTemporaryFile` instead." },
  S310: { monster: "mimic", category: "security", title: "URL open with any scheme", tip: "Check that the URL starts with `http://` or `https://` before opening it." },
  S324: { monster: "mimic", category: "security", title: "Weak hash function", tip: "Use SHA-256 for security, or pass `usedforsecurity=False` for checksums." },
  S501: { monster: "mimic", category: "security", title: "TLS verification disabled", tip: "Remove `verify=False`; it lets anyone impersonate the server." },
  S701: { monster: "mimic", category: "security", title: "Template autoescape off", tip: "Turn autoescaping on so user input can't inject HTML." },

  // ── Complexity ──
  C901: { monster: "spaghetti", title: "Function too complex", tip: "Split it into smaller helper functions, each doing one thing." },
  PLR0911: { monster: "spaghetti", title: "Too many return statements", tip: "Simplify the branching, e.g. with a lookup table or early validation." },
  PLR0912: { monster: "spaghetti", title: "Too many branches", tip: "Extract groups of branches into helper functions." },
  PLR0913: { monster: "spaghetti", title: "Too many arguments", tip: "Group related arguments into a dataclass or split the function." },
  PLR0915: { monster: "spaghetti", title: "Function too long", tip: "Break the function into smaller, well-named steps." },

  // ── Pylint ──
  PLE0704: { monster: "gremlin", title: "Bare raise outside except", tip: "A lone `raise` only works inside an `except` block; raise a specific exception." },
  PLE1142: { monster: "gremlin", title: "await outside async function", tip: "Mark the function `async def`, or don't await here." },
  PLE1205: { monster: "gremlin", title: "Too many logging arguments", tip: "Make the number of `%s` placeholders match the arguments." },
  PLE1206: { monster: "gremlin", title: "Too few logging arguments", tip: "Make the number of `%s` placeholders match the arguments." },
  PLW0120: { monster: "echoBat", title: "Pointless else on a loop", tip: "Without a `break`, the `else` always runs — un-indent its body." },
  PLW0127: { monster: "echoBat", title: "Variable assigned to itself", tip: "`x = x` does nothing; remove it." },
  PLW0129: { monster: "gremlin", title: "Assert on a string (always true)", tip: "A non-empty string is always truthy; assert the actual condition." },
  PLW0133: { monster: "gremlin", title: "Exception created but not raised", tip: "Add `raise` in front — right now the error is silently ignored." },
  PLW0177: { monster: "gremlin", title: "Comparison with NaN", tip: "NaN never equals anything; use `math.isnan(x)`." },
  PLW0211: { monster: "gremlin", title: "Static method with `self`", tip: "Remove `@staticmethod` or the `self` parameter." },
  PLW0602: { monster: "echoBat", title: "Unneeded global statement", tip: "`global` is only needed when you assign to the name; delete it." },
  PLW0642: { monster: "mimic", title: "Reassigning self", tip: "Assigning to `self` only changes a local name; return a new object instead." },
  PLW0711: { monster: "mimic", title: "`except A or B`", tip: "This only catches A — write `except (A, B):`." },
  PLW1508: { monster: "gremlin", title: "Non-string env var default", tip: "Environment variables are strings; use a string default and convert it." },
  PLW3301: { monster: "echoBat", title: "Nested min/max", tip: "Flatten it: `max(a, b, c)`." },

  // ── Exceptions, builtins, leftovers, simplifications ──
  BLE001: { monster: "swallowToad", title: "Catching every exception", tip: "Catch the exceptions you expect; let real bugs surface." },
  A001: { monster: "mimic", title: "Variable shadows a builtin", tip: "Rename it — the builtin (like `list` or `str`) is hidden for the rest of the scope." },
  A002: { monster: "mimic", title: "Argument shadows a builtin", tip: "Rename the parameter so the builtin stays usable inside the function." },
  ERA001: { monster: "todoMite", title: "Commented-out code", tip: "Delete it — version control remembers old code for you." },
  FIX001: { monster: "todoMite", title: "FIXME comment", tip: "Fix it now, or turn it into an issue so it isn't forgotten." },
  FIX002: { monster: "todoMite", title: "TODO comment", tip: "Finish the TODO or move it to the issue tracker." },
  FIX003: { monster: "todoMite", title: "XXX comment", tip: "Resolve the note or turn it into an issue." },
  FIX004: { monster: "todoMite", title: "HACK comment", tip: "Replace the hack with a proper solution when you can." },
  SIM101: { monster: "echoBat", title: "Repeated isinstance calls", tip: "Merge them: `isinstance(x, (A, B))`." },
  SIM102: { monster: "echoBat", title: "Nested ifs", tip: "Combine them with `and` into a single `if`." },
  SIM103: { monster: "echoBat", title: "Needless if/return True", tip: "Return the condition directly: `return x > 0`." },
  SIM110: { monster: "echoBat", title: "Loop re-implements any()/all()", tip: "Use `any(...)` or `all(...)` — shorter and clearer." },
  SIM118: { monster: "echoBat", title: "`in dict.keys()`", tip: "Write `key in d`; `.keys()` is unnecessary." },
  SIM210: { monster: "echoBat", title: "`True if x else False`", tip: "Write `bool(x)`." },
  SIM300: { monster: "echoBat", title: "Yoda comparison", tip: "Put the variable first: `if answer == 42`." },
};

/**
 * Fallbacks for codes without a row, checked from top to bottom, so more
 * specific prefixes must come first ("SIM" before "S", "PLR" before "PL").
 */
const PREFIX_FALLBACKS: readonly { prefix: string; row: RuleRow }[] = [
  { prefix: "SIM", row: { monster: "echoBat", title: "Code that could be simpler", tip: "There is a shorter, clearer way to write this." } },
  { prefix: "PLR", row: { monster: "spaghetti", title: "Overgrown code", tip: "Split this into smaller pieces." } },
  { prefix: "PLW", row: { monster: "gremlin", title: "Suspicious code", tip: "This probably doesn't do what it looks like — double-check it." } },
  { prefix: "PLE", row: { monster: "gremlin", title: "Code that will crash", tip: "Python will raise an error here at runtime — fix the marked line." } },
  { prefix: "FIX", row: { monster: "todoMite", title: "Leftover note", tip: "Resolve the note or move it to the issue tracker." } },
  { prefix: "ERA", row: { monster: "todoMite", title: "Commented-out code", tip: "Delete it — version control remembers old code for you." } },
  { prefix: "BLE", row: { monster: "swallowToad", title: "Catching every exception", tip: "Catch only the exceptions you expect." } },
  { prefix: "C9", row: { monster: "spaghetti", title: "Function too complex", tip: "Split it into smaller helper functions." } },
  { prefix: "F5", row: { monster: "gremlin", title: "Broken string formatting", tip: "Make the placeholders match the arguments you pass." } },
  { prefix: "F", row: { monster: "gremlin", title: "Likely bug", tip: "Pyflakes is sure something is wrong here — read the message closely." } },
  { prefix: "E", row: { monster: "echoBat", title: "Style slip", tip: "Tidy up this line as the message suggests." } },
  { prefix: "A", row: { monster: "mimic", title: "Name shadows a builtin", tip: "Rename it so the builtin stays usable." } },
  { prefix: "B", row: { monster: "gremlin", title: "Python gotcha", tip: "This pattern often hides a bug — read the message and double-check." } },
  { prefix: "S", row: { monster: "evalSerpent", title: "Security risk", tip: "This can be abused by an attacker; follow the message to make it safe." } },
];

/** Used when not even a prefix matches (a rule family we never mapped). */
const UNKNOWN_RULE: RuleRow = { monster: "gremlin", title: "Suspicious code", tip: "The linter flagged this line — read the message and double-check it." };

/** Looks up everything Lintlands knows about a Ruff rule code. */
export function ruleInfo(code: string): RuleInfo {
  const row = RULE_TABLE[code] ?? PREFIX_FALLBACKS.find((entry) => code.startsWith(entry.prefix))?.row ?? UNKNOWN_RULE;
  return {
    title: row.title,
    tip: row.tip,
    monster: row.monster,
    severity: MONSTERS[row.monster].severity,
    category: row.category ?? MONSTER_CATEGORY[row.monster],
  };
}
