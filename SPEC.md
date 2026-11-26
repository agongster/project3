# Lintlands — Spec (Idea 2: GitHub Repo Dungeon)

> **Feasibility: High (recommended of the three ideas).** Public repos need no user login, the GitHub API returns a whole repo's folder structure in one call, and the linter runs in the browser. The main scope decision is supporting **one language (Python)** for the MVP.

---

## 1. Idea & Architecture Overview

### Product Name & Core Concept

**Lintlands** turns a public GitHub repository into a 2D pixel-art world you can walk around in. The repo's folders become regions of an overworld, its files become buildings, and every file that a static analyzer flags becomes a **dungeon** full of monsters, one monster per finding.

The player enters a repo URL, explores the map, walks into dungeons, and defeats each monster by correctly diagnosing the bug it represents. Clearing every dungeon "purifies" the repo. The final screen gives the player a copyable checklist of every bug they found, so the game ends with a real to-do list for the codebase.

### Technical Integrations & Capstone 2 Alignment

Lintlands meets the **CMU 15-114 Capstone 2** requirement (~8 hours of focused development) with three distinct technical integrations:

1. **GitHub REST API:** fetches repo metadata and the full recursive file tree, then raw file contents for every Python file.
2. **Static analysis engine (Ruff, compiled to WebAssembly):** lints each Python file in the browser with a curated, bug-focused rule set and returns structured diagnostics (rule code, message, line/column).
3. **Interactive 2D canvas game (HTML5 Canvas 2D):** procedurally generates a deterministic tile-map world from the repo tree and lint results, with player movement, collision, scene switching (overworld ↔ dungeon), and encounter UI.

### Target Deployment & Stack

* **Frontend framework:** Next.js (App Router) + React 19 + Tailwind CSS
* **Canvas:** HTML5 Canvas 2D (no game-engine dependency), 16×16 px tiles rendered at 3×
* **Linter:** `@astral-sh/ruff-wasm-web`, pinned to an exact version (its API is marked experimental), run inside a Web Worker
* **Server:** one Next.js route handler (`/api/repo`) that calls GitHub with an optional server-side token
* **Deployment:** Vercel (public URL; `GITHUB_TOKEN` set as an environment secret)
* **Art:** original pixel art or CC0 tilesets (e.g., Kenney packs), credited in README
* **Deliverables:** `SPEC.md`, `REVIEW.md`, `README.md`, `prompt_log.md`, `REFLECTION.md`, unit + e2e test suite, GitHub Actions CI (same workflow as project3: lint → typecheck → Vitest → Playwright)

---

## 2. Core Gameplay Loop

1. **Summon:** the player pastes a repo (`owner/repo` or a GitHub URL). A loading screen shows progress: *Mapping tree… Fetching 42/120 files… Linting…*
2. **Explore:** the player spawns in **Town Square** (root-level files). Roads lead to one region per top-level directory. Clean files are houses; files with findings are **dungeon entrances** with a skull count showing how dangerous they are.
3. **Delve:** entering a dungeon loads a corridor scene for that file. Monsters stand at positions proportional to their line numbers, so the corridor reads like the file from top to bottom.
4. **Encounter:** bumping a monster opens the encounter card:
   * the code snippet (±3 lines) with the offending line highlighted
   * the prompt *"What's wrong here?"* with **3 options**: the correct rule title plus 2 distractors
   * **Correct:** the monster is defeated and the player gains XP by tier.
   * **Wrong:** the player loses 1 heart (3 hearts total). At 0 hearts the player is ejected to the overworld with hearts refilled, and the monsters stay.
5. **Purify:** a dungeon is cleared when all its monsters are defeated (its entrance turns into a house). The HUD shows **Repo Health** = defeated XP ÷ total XP.
6. **Victory / Bestiary:** at any time the player can open the Bestiary (all findings grouped by rule). At 100%, a victory screen offers **"Copy as Markdown checklist"** (`- [ ] path/to/file.py:42 — F821 Undefined name 'foo'`).

### Controls

| Key | Action |
|---|---|
| WASD / arrow keys | Move |
| E / Enter | Interact (enter dungeon, read signpost) |
| 1 / 2 / 3 | Pick an encounter answer |
| B | Toggle Bestiary |
| Esc | Close panel / leave dungeon |

---

## 3. Views & UI Components

### View 1: Landing (`src/app/page.tsx`)

* Repo input (`owner/repo` or full URL) with inline validation
* **Example repos:** buttons for 2–3 known repos, including a purpose-made **`lintlands-demo`** repo (create this yourself, seeded with one bug of each tier) so graders always have a reliable demo
* Note: "Python repos only (for now). Public repos only."
* Loading panel with staged progress and a cancel button
* Error states (see §7)

### View 2: World (`src/app/play/page.tsx?repo=owner/name`)

* **Canvas** (fills the viewport; camera follows the player)
* **HUD (top bar):** repo name + short SHA, hearts, XP, Repo Health bar, Bestiary button
* **Location label (bottom-left):** current region / hovered building's file path
* **Interaction prompt:** "Press E to enter `utils/parse.py` (3 monsters)"
* **Encounter modal:** snippet, monster sprite + name, 3 answer buttons, result feedback
* **Bestiary drawer:** findings grouped by rule title, with counts and defeated ✓ marks
* **Victory modal:** summary stats + copy-checklist button

### Shared engine components (`src/game/`)

* `TileMap` (tiles, collision layer), `Camera`, `Player` (grid movement with smooth interpolation), `SceneManager` (overworld ↔ dungeon), `InputController`, `Renderer` (draws layers + sprites, pixel-perfect scaling with `imageSmoothingEnabled = false`)

---

## 4. Data Pipeline

### 4.1 Repo fetch: `GET /api/repo?repo=owner/name[&ref=branch]`

Server route steps:
1. `GET https://api.github.com/repos/{owner}/{repo}` → `default_branch` (404 → not found or private)
2. `GET https://api.github.com/repos/{owner}/{repo}/branches/{ref}` → `commit.sha`
3. `GET https://api.github.com/repos/{owner}/{repo}/git/trees/{sha}?recursive=1` → `tree[]` entries (`path`, `type`, `size`) and a `truncated` flag
4. Filter to lintable files (§4.3) and return:

```json
{
  "owner": "octo", "repo": "demo", "ref": "main", "sha": "a1b2c3…",
  "truncated": false,
  "files": [{ "path": "app/main.py", "size": 2048 }],
  "skipped": { "vendored": 12, "tooLarge": 1, "overCap": 0 }
}
```

* Uses `Authorization: Bearer $GITHUB_TOKEN` when set (5,000 requests/hr). Without it, GitHub allows 60/hr per server IP. A token with **no scopes / public read only** is enough.
* Sets `Cache-Control: s-maxage=300` so repeat loads of the same repo don't spend rate limit.

### 4.2 File contents (browser)

* Fetch `https://raw.githubusercontent.com/{owner}/{repo}/{sha}/{path}` directly from the browser (CORS-enabled, and it doesn't count against the REST API rate limit). Pinning to `sha` guarantees all files come from one commit.
* Concurrency limit of 6, with a 10 s timeout per file. A failed file is shown as a "ruined house" (no findings) and counted in a warning toast.

### 4.3 File filtering rules

* Include: `*.py`
* Exclude any path with a segment in: `.git`, `venv`, `.venv`, `env`, `site-packages`, `node_modules`, `__pycache__`, `build`, `dist`, `.tox`, `migrations`
* Exclude files > 100 KB
* **Cap: 150 files.** If over the cap, keep files in path order and report `overCap`. (Lint results aren't known server-side, so the cap can't prefer buggy files.)

### 4.4 Linting (Web Worker, `src/workers/lint.worker.ts`)

* Initialize Ruff WASM once (`await init()`), then create a `Workspace` with these settings:

```ts
{
  lint: {
    select: ["F", "B", "S", "E722"],   // Pyflakes, Bugbear, Bandit (security), bare except
    ignore: ["S101"],                  // assert-used: pure noise in test files
  }
}
```

* `workspace.check(source)` returns diagnostics. Normalize them into `Finding` (§6). Diagnostics with no rule code are **syntax errors**.
* Field names in Ruff's WASM output can change between versions. Isolate them in a single `normalizeDiagnostic()` function and cover it with a fixture test.

### 4.5 Tier & monster table (`src/lib/bestiary.ts`)

| Tier | XP | Rules (examples) | Monsters |
|---|---|---|---|
| **Minion** | 10 | F401 unused import, F811 redefined unused name, F841 unused variable, F541 f-string without placeholders, B007 unused loop variable | Dust Bunny, Echo Bat, Hoarder Rat |
| **Elite** | 25 | F821 undefined name, F632 `is` with literal, B006 mutable default arg, B008 call in default arg, B023 closure over loop variable, B904 raise without `from`, E722 bare except, any other F/B rule | Phantom, Mimic, Gobbler, Loop Ghost |
| **Boss** | 50 | Any `S` rule (e.g., S105 hardcoded password, S307 `eval`, S608 SQL built from strings, S602 `shell=True`), syntax errors | Key Thief, Eval Serpent, Injector, Glitch King |

Each table entry has `{ code, title, monster, sprite, tier }`. The `title` is what the encounter shows as an answer option (e.g., "Mutable default argument"). Unknown codes fall back to `{ title: <message with quoted names masked>, monster: "Wild Bug", tier: "elite" }`.

---

## 5. World Generation (`src/lib/worldgen.ts`)

Generation is **deterministic**: seed = hash(`owner/repo@sha`), using a small seeded PRNG (e.g., mulberry32) for decoration placement. The same commit always produces the same world.

### Overworld

1. **Regions:** one per top-level directory, plus **Town Square** for root-level files. Files in nested subdirectories belong to their top-level region; their full path shows on hover.
2. **Region size:** `side = max(8, ceil(sqrt(fileCount)) * 3 + 4)` tiles.
3. **Biome:** `hash(dirName) % 5` → meadow, forest, desert, snow, swamp. This picks the ground tiles and decorations.
4. **Packing:** Town Square goes at the center. Other regions are sorted by size (descending) and shelf-packed around it with 3-tile gaps.
5. **Buildings:** placed on a 3-tile grid inside each region with a door facing south. Each file with findings gets a **dungeon entrance** sprite, plus skulls (1 for minions only, 2 if any elite, 3 if any boss).
6. **Roads:** an L-shaped path from each region's gate to Town Square.
7. **Decoration:** trees and rocks on empty tiles, with collision. They never go on roads or door tiles.
8. **Invariant:** every building door is reachable from spawn (a BFS check, enforced in tests and asserted in dev builds).

### Dungeon (one per file with findings)

* A horizontal corridor 7 tiles tall, `length = clamp(ceil(lines / 10), 12, 60)` tiles
* Each monster sits at `x = 2 + floor((line / totalLines) * (length - 4))`, alternating rows to avoid stacking. Monsters on the same tile are offset to neighboring tiles.
* The entrance/exit is on the left wall. A wall plaque shows the file path.
* MVP monsters are stationary with an idle bob animation. Patrolling is a stretch goal.

---

## 6. Data Model (`src/lib/types.ts`)

```ts
type RepoRef = { owner: string; repo: string; ref: string; sha: string };

type SourceFile = { path: string; size: number; lineCount: number; status: "ok" | "failed" };

type Tier = "minion" | "elite" | "boss";

type Finding = {
  id: string;            // `${path}:${line}:${col}:${code ?? "syntax"}`
  path: string;
  code: string | null;   // null = syntax error
  message: string;       // Ruff's message, e.g. "Undefined name `foo`"
  line: number; col: number; endLine: number; endCol: number;
  tier: Tier;
};

type Region = { name: string; dir: string; x: number; y: number; w: number; h: number; biome: Biome };
type Building = { path: string; x: number; y: number; door: { x: number; y: number }; findingIds: string[] };

type World = { seed: number; width: number; height: number; ground: Uint8Array; collision: Uint8Array;
               regions: Region[]; buildings: Building[]; spawn: { x: number; y: number } };

type Progress = { defeated: string[]; xp: number; hearts: number };   // persisted
```

**Persistence:** `localStorage["lintlands:" + owner/repo@sha] = Progress`. A new commit means a new world and fresh progress. There is no database in the MVP.

---

## 7. Error States & Limits

| Situation | Detection | What the user sees |
|---|---|---|
| Malformed input | client-side parser | Inline: "Try `owner/repo` or a github.com URL" |
| Repo not found / private | GitHub 404 | "Couldn't find that repo. Lintlands only works with public repos." |
| No Python files | 0 files after filter | "No Python found here. Try a Python repo." + example buttons |
| Rate limited | 403/429 with `x-ratelimit-remaining: 0` | "GitHub needs a breather; try again in N minutes" (from `x-ratelimit-reset`) |
| Huge repo | `truncated: true` or `overCap > 0` | Warning toast: "Showing the first 150 Python files" |
| Some files failed | per-file fetch error | Ruined-house sprite + toast with count |
| Zero findings | lint result | "This repo is already pure ✨" peaceful mode (explore only) |
| WASM fails to load | worker init error | Error panel with retry; logs to console |

---

## 8. Privacy & Security

* Public repos only. No GitHub login and no user data collected.
* Source code is fetched to and linted in the **user's browser**. The server only sees repo names and never stores code.
* `GITHUB_TOKEN` lives only in Vercel env vars and is never sent to the client.
* Snippets are rendered as text (never `dangerouslySetInnerHTML`) so repo content can't inject HTML.

---

## 9. Testing Plan

### Unit (Vitest)

* `parseRepoInput`: accepts `owner/repo`, `https://github.com/owner/repo`, trailing `.git`, `/tree/branch`; rejects garbage
* `filterFiles`: excludes vendored dirs, oversize files, non-Python; applies cap
* `tierFor` / bestiary lookup: table rows, unknown code fallback, `null` code → boss
* `normalizeDiagnostic` + **fixture lint**: run Ruff (`@astral-sh/ruff-wasm-nodejs`, same pinned version) on `tests/fixtures/buggy.py` (one known minion, elite, boss) → expected codes and lines
* `generateWorld`: deterministic for the same seed; no overlapping regions; one building per file; **all doors reachable (BFS)**
* `buildEncounter`: exactly 3 unique options, exactly one correct, deterministic per finding id
* `progressReducer`: correct answer → defeated + XP; wrong answer → hearts − 1; 0 hearts → ejected + refill

### End-to-end (Playwright)

* Intercept `/api/repo` and `raw.githubusercontent.com/**` with fixture responses (no network in CI)
* Happy path: enter repo → world renders → teleport to dungeon via test hook (`window.__lintlands.teleport(path)`, enabled only when `NEXT_PUBLIC_E2E=1`) → answer correctly → XP increases, monster gone
* Wrong answer path: hearts decrease; 3 wrong answers → back in overworld
* Error path: 404 repo shows the not-found message

### CI

Reuse project3's `.github/workflows/ci.yml` unchanged: `npm ci → lint → typecheck → test → playwright install → test:e2e`.

---

## 10. Build Plan (~8 hours)

| # | Block | Time | Done when |
|---|---|---|---|
| 1 | Scaffold Next.js + CI, `/api/repo` route, input parser, file filter + tests | 1.0 h | Route returns filtered files for a real repo |
| 2 | Ruff WASM in a Web Worker, normalize + tier table + fixture test | 1.0 h | Findings appear in the console for a real repo |
| 3 | Tile engine (map, camera, player, collision) + overworld generator + reachability test | 2.0 h | Walk around a generated world |
| 4 | Dungeon scene, encounter modal, progress reducer, hearts/XP HUD | 1.5 h | Can clear a dungeon |
| 5 | Landing page, loading progress, error states, Bestiary, victory + checklist copy | 1.0 h | Full flow works end to end |
| 6 | Create the `lintlands-demo` repo, deploy to Vercel, README, e2e tests green | 1.0 h | Public URL works for graders |
| | **Total** | **7.5 h** | |

---

## 11. Scope

### MVP (in scope)
Public repos, Python only, Ruff with the curated rule set, overworld + per-file dungeons, quiz encounters, hearts/XP/health, Bestiary, checklist export, localStorage progress.

### Stretch goals (in priority order)
1. **JS/TS support** with ESLint's `Linter` class (core "recommended" rules), run in a route handler
2. **Typo sprites:** run the Harper grammar checker (harper.js) on `README.md` and comments; typos become tiny critters in Town Square (combines with Idea 3)
3. **Sage NPC:** an LLM explains a defeated bug and suggests a fix (reuse project3's Gemini helper; snippet only, public code)
4. Patrolling monsters / simple real-time combat
5. Global leaderboard ("most purified repos") in Supabase

### Out of scope
Private repos / GitHub OAuth, writing fixes back (PRs), multi-language in one world, deep analyzers (CodeQL, Semgrep, type checkers).

---

## 12. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| WASM loading/bundling issues in Next.js | Medium | Load inside a Web Worker via dynamic import. **Fallback:** run `@astral-sh/ruff-wasm-nodejs` in an `/api/lint` route handler instead |
| Ruff WASM API changes (experimental) | Medium | Pin exact version; all field access goes through `normalizeDiagnostic()` + fixture test |
| GitHub rate limits during grading | Low | Server token + `s-maxage` caching; demo repo is small |
| Huge or noisy repos | Medium | 150-file cap, vendored-dir filter, curated rules, S101 ignored |
| Encounter quiz feels repetitive | Medium | Varied monster sprites per rule; boss gets a 2-question encounter (stretch) |
| Over-scoping the art | Medium | CC0 tilesets first; custom art only after MVP works |

---

# Addendum — what changed during the build (AI-written, 2026-11-25)

> Everything above this line is the original spec, kept unchanged. This addendum records where the build deliberately departs from it. The changes come from the build prompt (prompt 5 in `prompt_log.md`), which asked for a customizable hero, scenery choices, an easy and "very very fun" game, a loading mini-game, rewards for good code, and gacha.

## A. Spec vs. build

| Area | Original spec | What was built | Why |
|---|---|---|---|
| Encounters | Bump a monster → 3-option quiz, lose a heart on a wrong answer | Real-time, very forgiving action combat (swing / dash, 14 weapons with 6 attack styles). Each monster wears its finding as a name tag; defeating it shows the bug in a toast, bosses show a full bug card, and the Codex lists every finding with snippet and fix tip | The prompt asked for "not hard" and "very very fun"; a quiz punishes people who don't know the rule yet |
| Clean files | Plain houses | Treasure houses. Each clean file gets a quality grade (S/A/B/C) from docstring coverage, type hints, comments and complexity; a better grade means a better chest | "good code should be rewards for the user, new weapons or powerups" |
| Randomness | None | Wishing Well gacha (30 coins a wish, pity at 10 and 40), chest loot tables, 44 collectible items | "add some randomization/gacha" |
| Hero | Fixed sprite | Layered character creator (skin, hair, outfit, eyes, accessory, hats) | "make the character customizable" |
| Scenery | Biome picked per region by hashing the directory name | Six themes the player chooses and can switch at any time (meadow, sakura, autumn, snow, beach, night) | "have different scenery options the user can choose" |
| Loading | Progress text | "Bug Catch" mini-game with the player's own hero; the score becomes bonus coins | "have some sort of loading game while the dungeon generates" |
| Monsters | 3 tiers, ~11 named monsters chosen per rule | 11 species mapped by *kind of problem* (unused code, TODOs, traps, swallowed errors, complexity, secrets, injection, syntax errors) with 9 movement archetypes | Makes the monster you meet tell you what kind of bug it is |
| Hearts | 3 hearts, ejected from the dungeon at 0 | 5 hearts, fainting respawns you at the dungeon door with no penalty and monsters keep their damage | Not hard |
| Dungeon shape | One corridor, 7 tiles tall | 1–4 rooms left-to-right in file order; boss files end in a larger arena; at most 10 monsters per file | Rooms give combat space; the cap keeps noisy files fun |
| Lint rules | `F`, `B`, `S`, `E722` | Wider set (see B) plus "quality probe" rules that never become monsters and only feed the grade | "bad code and bugs" (not only bugs) and the good-code grade |
| Ruff loading | Bundled TypeScript Web Worker | A static module worker (`public/lint-worker.js`) plus the WASM copied to `public/ruff/` by `scripts/copy-ruff.mjs` | Avoids the bundler/WASM risk the spec itself listed in §12 |
| Art | CC0 tilesets first | 100% original pixel art generated by code (`src/game/art`), no image files; all sound synthesized with Web Audio | Consistent look across six themes, no licensing questions |
| Demo repo | A hand-made `lintlands-demo` GitHub repo | A built-in offline "Demo Kingdom" (16 embedded Python files covering every monster) | Works with no network and no GitHub rate limit |
| Pages | `/` landing and `/play?repo=…` | One page with a small state machine: title → hero creator → loading → playing | Simpler flow, no reload between screens |
| Persistence | Progress per repo commit | Progress per repo commit **plus** one collection (coins, items, look, theme) shared by every repo | The gacha collection should outlive a single repo |
| Repo Health | Defeated XP ÷ total XP | Defeated findings ÷ total findings | Easier to explain on the HUD |
| Tests / CI | Vitest + Playwright e2e in CI | Vitest unit tests + ESLint + typecheck + production build in CI; visual checks through `/dev/*` pages and `scripts/shot.mjs` | Canvas e2e tests are slow and flaky; the assignment asks for a small suite that is green on every push |
| Stretch goals | JS/TS support, typo sprites, Sage NPC, leaderboard | Not built | Out of time budget; still good next steps |

## B. Static analyzers considered

The prompt asked to look into static bug-catching analyzers and linters before building.

| Tool | What it catches | Can it run in a browser or a short serverless function? |
|---|---|---|
| **Ruff** (chosen) | Re-implements Pyflakes, pycodestyle, Bugbear, Bandit, McCabe, much of Pylint, pydocstyle and more — 800+ rules | **Yes.** Official WebAssembly builds for web and Node (~10 MB, cached after the first load) |
| Pyflakes | Unused / undefined names, redefinitions | Python only (would need Pyodide); Ruff's `F` rules cover it |
| Pylint | Very broad, some type inference; slow and noisy | Serverless Python yes; browser only through Pyodide |
| Bandit | Security: `eval`, shell injection, pickle, hardcoded secrets | Serverless Python; Ruff's `S` rules port most of it |
| mypy / Pyright | Type errors | Without the repo's dependencies installed most imports are unknown, so results are weak file-by-file |
| Vulture | Dead code across a whole project | Python; needs a cross-file view |
| Radon | Complexity and maintainability metrics | Python; Ruff's `C901` covers cyclomatic complexity |
| Semgrep | Pattern and taint rules | Native CLI / CI; not practical in a browser |
| CodeQL | Deep data-flow analysis | Builds a database, takes minutes per repo; CI only |

**Why Ruff-WASM:** one pinned dependency gives six analyzers' worth of rules; it lints 150 files in well under a second; and it runs in the player's browser, so source code never reaches our server and there are no serverless time limits. **What it cannot do:** type inference or cross-file analysis.

**Rule families that become monsters:** all of `F` (Pyflakes), `B` (Bugbear), `S` (Bandit) and `PLE`; pycodestyle `E711 E712 E721 E722 E731 E741`; `C901` (complexity > 10), `PLR0911`, `PLR0913` (> 8 arguments), `PLR0915`; a hand-picked set of `PLW` warnings; `BLE001`; `A001 A002`; `ERA001`; `FIX001–FIX004`; and a few `SIM` simplifications. **Ignored as too noisy:** `S101`, `S311`, `S603`, `S606`, `S607`, `B028`, `B905`, `F405` and others (see `src/lib/analysis/rules.ts`). **Quality probes (grading only):** `D100–D103`, `ANN001/201/202`, `E501`, `E701/702`, `N801–806`.

**Measured noise after tuning** (15 real packages, 637 files, 207k lines): about 5.4 monsters per 1,000 lines, 51% of files clean, bosses about 2% of monsters.

## C. Economy (all numbers live in `src/lib/game/`)

| | |
|---|---|
| Wish price | 30 coins, or 10 wishes for 270 |
| Wish rates | common 60% · rare 28% · epic 10% · legendary 2% |
| Pity | epic-or-better guaranteed by the 10th wish without one; legendary by the 40th |
| Duplicates | refunded as 8 / 20 / 50 / 120 coins |
| Clean-file chest | grade S: epic or legendary; A: rare or better; B: 70% chance of a common/rare item; C: mostly coins |
| Dungeon chest | by the worst monster in the file: boss → rare or better, elite → common/rare, minions → mostly coins |
| Health milestones | 25 / 50 / 75 / 100% purified pays 25 / 50 / 75 / 150 coins |

## D. Second round: more of the repo in the game (AI-written, 2026-11-26)

Added after the first review, at the owner's request ("repo should matter more in what the user sees"):

| Feature | What the player sees | Where |
|---|---|---|
| Code outline | (invisible) every file's functions, branches, docstrings, comments and imports | `src/lib/analysis/outline.ts` |
| Pick-the-fix finisher | A dazed elite or boss can be finished by choosing the real fix from three | `src/lib/game/finisher.ts`, `src/components/overlays/FinisherOverlay.tsx` |
| Code on the floor | Each monster's offending line carved where it starts; heals when it dies | `src/game/scenes/floorCode*.ts` |
| Monster traits | Behaviour mirrors the bug (invisible undefined name, growing mutable default, …) | `src/game/entities/monsters/traits/`, `src/lib/analysis/traits.ts` |
| The file shapes the place | A room per function, forks for branches, light for docstrings, a repo treemap | `src/lib/worldgen/roomPlan.ts`, `roomMaze.ts`, `dungeonDecor.ts`, `src/game/ui/treemap.ts` |
| The repo's own words | Villagers, loot engravings, bounties, README greeting, import merchants | `src/lib/worldgen/repoWords.ts`, `src/lib/game/engraving.ts`, `bounties.ts` |

## E. Third round: the Workshop, a gamified IDE (AI-written, 2026-11-26)

**Goal (owner's words):** "turn this into a full fledged gamified IDE. the user should be able to edit and view all code files but make it gamified."

**Decisions**

0. **Game first, editor second** (owner, 2026-11-26: "it is primarily a game, and secondarily an IDE, as opposed to the other way around"). The app opens into the game exactly as before and can be played to the victory screen without ever opening the editor. The Workshop is an optional room of the game: one ordinary HUD button and a key, secondary buttons beside the game's own actions, never opened automatically, never required.
1. **The world stays; the editor joins it.** The Workshop is a full-window code editor inside the game. It opens from the HUD, from a building, from a dungeon room, and from every place a bug is explained ("Fix it for real").
2. **Typing is free, saving is the game move.** While typing, the editor shows live Ruff findings as monster markers in the gutter, but nothing in the world changes. Pressing save ("Forge", Ctrl/Cmd+S) re-lints the file and applies the result: bugs that are gone are *fixed for real* (their monsters are banished and pay more than a fight would), new bugs become new monsters (no penalty), the file's grade and its dungeon update.
3. **All files can be viewed and edited, Python files are the game.** Non-Python text files open in the same editor with syntax highlighting but have no monsters.
4. **Edits stay in the browser.** Nothing is written to GitHub (the deployed site is static and holds no credentials). Saved edits persist in localStorage per commit and can be exported as a unified diff or a zip of the changed files.
5. **Fighting and fixing are two ways to the same goal.** Repo Health counts a finding as dealt with when its monster is defeated *or* its code is fixed. A file whose last bug is fixed in the editor turns from a dungeon into a treasure house.
6. **Gamification of the editing itself:** quests derived from the code (document this function, fix this bug by hand, raise this file's grade), a streak for forges that fix without breaking, achievements, and quick fixes offered by Ruff as one-click "scrolls".

**Architecture:** `src/lib/workspace/contract.ts` is the interface (`Workspace`: `read`, `check`, `forge`, `revert`, `changes`, `exportPatch`, `exportZip`, plus `analysis` as a live store). The game engine receives each new analysis without restarting. Editor: CodeMirror 6.

**Out of scope for now:** committing or opening pull requests on GitHub, creating / renaming / deleting files, running the code, multi-user editing.

## F. Fourth round: fight, then fix (AI-written, 2026-11-26)

Owner's requests, in her words: (1) "add a door at the end of the dungeon for player to exit when they're done"; (2) "the text right now is hard to read, please choose a more readable font. especially for character customization and numbers"; (3) "add more character customization options"; (4) "for the text on the ground after defeating the monster, player should be able to press E to open that line in the IDE"; (5) "player needs to fix the line to fully defeat the monster"; (6) "we haven't run into any bosses yet, where are they?"; (7) "add more variations to the monsters".

**F1. Two steps to beat a bug (requests 4 and 5).** This replaces rule 5 of section E ("fighting and fixing are two ways to the same goal") and the part of rule 0 that said the editor is never required.

| Word | Meaning |
|---|---|
| **Subdued** | The monster was beaten in a fight. It stops fighting for good (this is what `RepoProgress.defeated` records) and stays bound to its line of code, which glows on the floor. Fighting pays coins and XP as before. |
| **Fixed** | The monster's finding no longer exists in the saved code. Only now is the monster *fully defeated*: it dissolves, its line heals to gold, and the fix pays its own reward. |
| **Quiet dungeon** | Every monster in it is subdued or fixed: nothing is left to fight. The end door opens. |
| **Purified dungeon** | The file has no findings left. The prize chest appears and the building is restored. |

- Standing on a subdued monster's glowing line and pressing **E** opens the Workshop on exactly that line. Fixing a line without fighting its monster first is allowed and is enough.
- **Repo Health counts fixed findings.** Subdued-but-unfixed ones show as a lighter part of the bar. Victory comes when every finding is fixed.
- **Nobody may get stuck** (the game must stay easy): every finding can be dealt with in a click or two from its bug card in the Workshop — Ruff's own fix scroll when it has one, and always a **seal scroll**, which marks the line as accepted (`# noqa: CODE`). A sealed monster is gone for good and counts as dealt with, but it is shown as *sealed*, not fixed, and pays no fix reward.
- The game teaches the loop the first time it matters (fight → stand on the glowing line → E → fix → Forge) with ordinary in-game prompts.

**F2. End door (request 1).** The last room of every dungeon has a door that leaves the dungeon. It opens when the dungeon is quiet. The entrance stays usable at all times.

**F3. Bosses that can be found (request 6).** Bosses only exist where the code has a serious finding (a hardcoded secret, `eval`/shell/pickle/SQL built from strings, a syntax error), which is rare in real repos (about 2% of monsters). So: boss lairs are marked on buildings and maps and listed on the notice board, and every dungeon of a useful size that has no true boss gets a **champion** — its toughest monster, promoted to a crowned mini-boss.

**F4. Variety (requests 3 and 7).** Monsters of the same kind differ in look and, mildly, in behaviour, chosen deterministically from their finding. The hero creator gains more options and categories; old saves keep their hero.

**F5. Readability (request 2).** Fonts are chosen for legibility first (lowercase letters and digits must be unmistakable at the sizes the game uses, on a normal-density screen), pixel charm second. This covers the page fonts and the bitmap font drawn on the canvas.

**F6. As built (added after the round, 2026-11-26).**

- *F1.* A finding has four states, decided in `src/lib/game/progress.ts`: alive, subdued, fixed, sealed. Repo Health, milestones, purifying and the victory count fixed and sealed findings only. A seal is recognised after each forge by its `# noqa` on the finding's line (`src/lib/game/seal.ts`); it pays nothing, does not extend a streak and completes no fix quest. **A syntax error cannot be sealed** (Python cannot read the file, so `# noqa` has no effect): it is the one finding that has to be repaired by hand. A purified dungeon gives the dungeon-clear chest, one per file. An old save whose dungeons were cleared by fighting loads as quiet dungeons with subdued monsters; rewards already paid are never paid again.
- *F2.* The end door is in the east wall of the last room (`Dungeon.endDoor`; a one-room dungeon has it opposite the entrance). Floor carvings stay off the two tiles in front of it.
- *F3.* The "about 2% of monsters" above was wrong as a general figure. Measured: the demo has 4 bosses among 22 monsters, `karpathy/nanoGPT` 6 among 27, `psf/requests` 0 among 70. Bosses were present but unmarked. Added boss rules: code Python parses but refuses to compile (F622, F701, F702, F704, F706, F707, PLE0115, PLE0117, PLE0118, PLE1142 → Glitch King), the Flask debug console (S201 → Eval Serpent), certificate or host-key checks turned off (S501, S323, S507 → Key Thief). A champion is crowned in a dungeon with at least 4 monsters and no true boss: 2× health, 3× coins, a guaranteed heart, one sharpened move.
- *F4.* Monster looks: a colour family per lint rule, plus a feature, a marking and a small size step seeded by the finding id. About half of ordinary monsters get one modifier (Swift, Sturdy, Shy, Bold, Tiny, Giant); never bosses or champions. Hero: hair styles 8 → 19, outfits 5 → 13, eye styles 3 → 8, skin tones 6 → 12, and new groups for a second outfit colour, eye colour, mouth, skin details, eyewear, facial hair and a back item. Body build was left out (a taller hero would cut off tall hats in the 32-pixel frame).
- *F5.* Page text and all numbers use Nunito (tabular digits); Press Start 2P only at 16, 24 or 32 px. Minimum sizes: 14 px for sentences, 13 px for dense labels. The canvas bitmap font gained a footed lowercase `l`. Floor carvings use light letters with a dark outline.
