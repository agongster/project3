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
