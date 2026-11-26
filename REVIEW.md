# Lintlands — Independent Code Review

| | |
|---|---|
| **Project** | Lintlands (Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Ruff WebAssembly) |
| **Commit reviewed** | `f48ee79` ("Playtest fixes: legible HUD text, honest chest counts, dev play-test handle"). The review started on `83fa9fc` with those changes still uncommitted in the working tree; they were committed at 20:00 during the review and nothing else changed. |
| **Date** | 2026-11-25 |
| **Reviewer** | Claude Opus 5.5, acting as an independent reviewer. I did not write any of this code and changed none of it; this file is the only file I created in the repository (plus screenshots in the git-ignored `.shots/review/`). |

**What I ran**

- `npx vitest run`: 27 files, 400 tests, all passing (about 6 s). `npx tsc --noEmit` and `npx eslint .`: both clean.
- The same three commands on a clean `git archive` export of `f48ee79` with no `.next/` folder and no `next-env.d.ts`, which is what CI sees after checkout: all three pass. I did **not** run `npm run build` (the brief forbids `next build` while the shared dev server is running).
- `curl` against `http://localhost:3100/api/repo` with empty input, a three-segment name, a `..` branch name, a GitLab URL, `karpathy/minGPT`, a missing repo, and the branch name `.` (8 GitHub calls in total, no `GITHUB_TOKEN` configured).
- Scratch Vitest files outside the repo that call the real modules: world generation on 150 root-level files, 150 top-level directories, 200-character and 40-level-deep paths, a dungeon with 10 bosses, and a dungeon whose 10 findings are all on line 1. Also the analysis pipeline (with Ruff's Node.js build) on hostile sources, the Markdown checklist with a backtick in a path, and same-line findings.
- A Node script that times Ruff WebAssembly on pathological Python (30,000 nested brackets, a 25,000-term sum, 400 nested `if`s) and checks that Ruff recovers after a crash.
- Headless-Chromium (Playwright) scripts that drive the real app: the Demo Kingdom flow, a real repo (`karpathy/minGPT`) from the title screen to the world, a bug card with a 3,000-character message, warping into a boss dungeon, a bot that clears `potions/cauldron.py` with the starter weapon and opens its chest, two tabs sharing one save, and `/dev/engine` writing to the real save. None of these runs logged a page error or a console error.

---

## Verdict

Lintlands does what the owner's request asks for and, with the documented changes in the SPEC addendum, what the spec describes. A pasted public repo becomes a deterministic pixel-art village. Files with Ruff findings are dungeons with one monster per finding, and clean files are treasure houses graded S/A/B/C. There is a Wishing Well gacha with pity, a layered hero creator, six scenery themes and a loading mini-game. The whole loop works in a real browser: I loaded minGPT (9 files, 12 bugs) and the offline demo (16 files, 22 bugs), cleared a boss dungeon and opened its chest, with no errors.

The code is unusually clean for a one-day multi-agent build: small, commented files; pure logic kept apart from React and the canvas; three clear contract files; no `any`, `@ts-ignore` or `eslint-disable`.

**Is it safe to deploy publicly?** Yes, with one condition: set `GITHUB_TOKEN`. The token never reaches the browser, all user input is validated before it reaches GitHub, and repo content is only ever rendered as text. Without a token, the whole deployment shares 60 GitHub calls per hour, which is about 20 world loads for everybody combined (finding 3).

**Findings:** I found no blockers, 4 *should fix* and 5 *minor*. The most important is that the "real to-do list" the spec promises silently drops findings (finding 1). The other notable one is that the good-code grade calls code with zero docstrings "Well documented" and grade S (finding 2). The original spec's Playwright end-to-end tests were not built.

---

## Spec conformance

"Met", "partly met" and "not met" compare against the original spec, but a change recorded in the SPEC addendum (§A) counts as met when the build matches the addendum.

| # | Requirement (source) | Status | Evidence | Note |
|---|---|---|---|---|
| 1 | Paste `owner/repo` or a GitHub URL, with inline validation (SPEC §2, §3) | Met | `src/lib/repo/parseRepoInput.ts:31-56`, `src/components/screens/title/RepoForm.tsx:39-40` | The same parser runs on the client and the server. A folder URL is misread (finding 7). |
| 2 | `/api/repo`: 3 GitHub calls, optional token, `s-maxage=300` (§4.1) | Met | `src/lib/repo/github.ts:60-84`, `src/lib/repo/repoEndpoint.ts:13,35` | It uses `/commits/{ref}` instead of `/branches/{ref}`, so tags and SHAs also work. |
| 3 | Python only, vendored dirs excluded, files ≤ 100 KB, cap of 150 (§4.3) | Met | `src/lib/repo/filterFiles.ts:8-27,50-64` | When over the cap it keeps the shallowest files first (better than plain path order). Symlinks are skipped. |
| 4 | Browser downloads from raw.githubusercontent pinned to the SHA, with a timeout (§4.2) | Met | `src/lib/analysis/analyzeRepo.ts:22-24,123-159` | Concurrency is 8, not 6. Each file has a 10 s timeout. |
| 5 | Ruff WASM, pinned, in a Web Worker; `normalizeDiagnostic` with a fixture test (§4.4) | Met | `public/lint-worker.js:14-66`, `src/lib/analysis/normalize.ts:50-61`, `tests/analysis/ruff.test.ts:18-45` | The worker is a static file (addendum §A). The workspace is rebuilt after a Ruff crash. |
| 6 | Rule → tier → monster table with a fallback (§4.5, addendum §B) | Met | `src/lib/analysis/rules.ts:209-364`, `src/lib/game/catalog.ts:227-239` | 11 species, mapped by kind of problem. |
| 7 | Deterministic world from `owner/repo@sha` (§5) | Met | `src/lib/worldgen/overworld.ts:70-81`, `src/lib/worldgen/dungeon.ts:55-66` | Retries use derived seeds, so they stay deterministic. Tested. |
| 8 | A region per top-level directory, Town Square for root files (§5) | Met | `src/lib/worldgen/regions.ts:90-116` | More than 10 directories are merged into "Outskirts". I checked 150 directories: 11 regions, generated in 243 ms. |
| 9 | Every door reachable (BFS invariant) (§5) | Met | `src/lib/worldgen/overworld.ts:174-182`, `src/lib/worldgen/dungeon.ts:124-134`, `tests/worldgen/fuzz.test.ts` | My stress shapes (150 root files, long and deep paths, 10 bosses, all findings on line 1) also passed `overworldProblems` / `dungeonProblems`. |
| 10 | A dungeon per cursed file, monsters in line order (§5) | Met | `src/lib/worldgen/dungeon.ts:156-172,268-304` | 1–4 rooms instead of one corridor (addendum §A). |
| 11 | Encounters (§2.4) | Met (changed) | `src/game/combat/`, `src/lib/game/catalog.ts:117-131` | Forgiving real-time combat replaces the quiz (addendum §A). Each monster wears its rule title as a name tag. |
| 12 | Hearts and fainting without frustration (§2.4, addendum) | Met | `src/lib/game/catalog.ts:15`, `src/game/scenes/world.ts:122-163`, `src/game/entities/monsters/monster.ts:277-290` | 5 hearts, no penalty for fainting, and monsters keep the damage you dealt. |
| 13 | Purify a cleared dungeon; Repo Health bar (§2.5) | Met (changed) | `src/game/scenes/dungeon.ts:183-198`, `src/lib/game/progress.ts:247-279` | Health counts findings rather than XP (addendum §A). |
| 14 | Bestiary / bug list (§2.6) | Met | `src/components/overlays/CodexOverlay.tsx:31` | It is called the Codex and opens with `C`. |
| 15 | Victory screen + "Copy as Markdown checklist" (§2.6) | Partly met | `src/game/scenes/overworld.ts:273-278`, `src/components/overlays/VictoryOverlay.tsx:106`, `src/lib/game/checklist.ts:64-92` | It works, but the list is incomplete (finding 1) and paths are not escaped (finding 6). |
| 16 | Progress in `localStorage` per commit (§6) | Met | `src/lib/game/store.ts:376-407`, `src/game/bridge.ts:170-173` | Plus one collection shared across repos (addendum). Two tabs overwrite each other (finding 4). |
| 17 | Error states: bad input, 404, no Python, rate limit, huge repo, failed files, WASM failure (§7) | Met | `src/lib/repo/github.ts:158-184`, `src/lib/analysis/analyzeRepo.ts:58-62,111-118,180-187`, `src/components/screens/title/ErrorPanel.tsx:23,57` | Failed downloads become tree stumps rather than "ruined houses". Warnings show on the ready card and the notice board, not as toasts. |
| 18 | Zero findings: "already pure" peaceful mode (§7) | Partly met | `src/game/index.ts:90`, `src/components/overlays/parts/codex/BugList.tsx:41` | The world is explorable with treasure only and no false victory, but no dedicated "already pure" message is shown on entry. |
| 19 | `GITHUB_TOKEN` server-only; snippets rendered as text (§8) | Met | `src/app/api/repo/route.ts:12`, `src/lib/repo/github.ts:145`, `src/components/overlays/parts/CodeSnippet.tsx:44` | See the security section. |
| 20 | Unit tests for the listed functions (§9) | Met | `tests/**` | 400 tests. The spec's quiz-specific `buildEncounter` test no longer applies. |
| 21 | Playwright e2e tests, and CI running them (§9, §1 deliverables) | Not met | `.github/workflows/ci.yml` | Dropped on purpose (addendum §A). CI runs lint, typecheck, unit tests and a build. |
| 22 | `README.md` (owner's part) and `REFLECTION.md` | Not met yet | `README.md:21`, `REFLECTION.md` | Both are placeholders the owner must write herself; this is not a code issue. |
| R1 | "cute 2d pixel art world … indie game style art" (request) | Met | `src/game/art/**`, screenshots in `.shots/review/` | All art is procedural. It looks polished at 3× scale. |
| R2 | "bad code and bugs are in like dungeons" (request) | Met | rows 10–13 | |
| R3 | "look into static bug catching analyzers and linters" (request) | Met | `SPEC.md:323-343` | Nine tools compared; the reason for choosing Ruff is stated. |
| R4 | "make the character customizable" (request) | Met | `src/components/character/LookEditor.tsx:58`, `src/lib/game/catalog.ts:270-282` | Skin, hair, outfit, eyes, accessory, name, and hats. |
| R5 | "different scenery options the user can choose" (request) | Met | `src/lib/game/catalog.ts:255-262`, `src/components/overlays/WardrobeOverlay.tsx:41` | Six themes, switchable at any time. |
| R6 | "make sure the game is not hard" (request) | Met (one bot run, not tuned by me) | `src/game/entities/monsters/director.ts:35-38`, `src/game/entities/monsters/skitter.ts:70-72` | With the starter weapon, a bot that never dodged killed the Glitch King in 39 swings (about 17 s) and lost 5 of 10 half-hearts. |
| R7 | "some sort of loading game while the dungeon generates" (request) | Met | `src/components/screens/LoadingScreen.tsx:75-83`, `src/components/loading/` | Its score becomes up to 40 bonus coins. The world-ready card waits, so nobody is pulled out mid-game. |
| R8 | "good code should be rewards … new weapons or powerups" (request) | Met, but the grade has a flaw | `src/lib/game/loot.ts:37-47,104-109`, `src/lib/analysis/quality.ts` | The first chest is always a weapon (seen in the bot run: an epic Debugger Wand). See finding 2. |
| R9 | "add some randomization/gacha" (request) | Met | `src/lib/game/gacha.ts:30-125` | The odds and pity rules match addendum §C exactly. |

---

## Findings

Severity labels: ***blocker*** = must be fixed before a public deploy or submission. ***should fix*** = a real defect a normal player or grader can hit, or a deployment risk. ***minor*** = low impact, cosmetic, or hardening. Findings tagged **[security]** are also discussed in the security section.

### 1. Findings on the same line silently vanish from the game, the Codex and the exported to-do list — *should fix*

- **Where:** `src/lib/analysis/normalize.ts:174-181` (`mergeSameProblem`), with `overflow` counted at `:165`.
- **What is wrong:** Findings with the same line and the same monster kind are merged into one, and the others are dropped without a trace. They do not become monsters, they are not counted in `overflow`, and they do not appear in the Codex, in `stats.findingCount` or in the Markdown checklist, which only prints "+N more" for `overflow` (`src/lib/game/checklist.ts:54`). This contradicts the spec's core promise that "the game ends with a real to-do list for the codebase" (`SPEC.md:13`).
- **Scenario:** a file with `import os, sys, json` (none used) and `def f(x=[], y={})`. Ruff reports 3 × F401 and 2 × B006. Lintlands shows 2 monsters with `overflow: 0`, and the checklist lists only "`json` imported but unused" and one B006. The `os` and `sys` imports and the `y={}` default are gone. The surviving F401 is also the *last* import, because Ruff does not report the hits in column order.
- **How I verified it:** a scratch Vitest file that runs Ruff's Node build through `analyzeSources` and `buildChecklist`, and prints the raw diagnostics next to the result.
- **Suggested fix:** keep the merge for monsters, but attach the merged findings to the surviving one (for example an `alsoHere: Finding[]` field on `Finding` in `types.ts`). Then list them in the Codex and the checklist, or at least add them to `overflow` so the "+N more" line counts them.

### 2. The quality grade counts private functions as documented, so code with no docstrings gets "Well documented" and grade S — *should fix*

- **Where:** `src/lib/analysis/quality.ts:148-151` (`docstringCoverage`) and `:182-183` (the "Well documented" highlight).
- **What is wrong:** Ruff's D1xx rules only flag *public* names, but the denominator counts every `def` (including `_private` ones and nested ones). Every undocumented private function therefore counts as documented. The comment admits this ("good enough for a game"), but the chest then shows the player a reason that is false. This is the "good code = rewards" mechanic the request emphasises, and it teaches the opposite lesson.
- **Scenario:** a file of ten functions like `def _h0(a: int) -> int: return a + 0`, with no docstrings and no comments, scores 87 → **grade S** with the highlights "Well documented, Fully type-hinted, Short, focused functions". The same file with public names (`h0` …) scores 60 → grade B. Renaming functions turns a B chest into an epic/legendary chest.
- **How I verified it:** a scratch Vitest file running Ruff through `analyzeSources` and printing `quality`.
- **Suggested fix:** count only public definitions in `documentable` (skip names starting with `_`), or detect docstrings directly in `readSourceFacts` (a `def`/`class` line followed by a string literal). Show "Well documented" only if at least one docstring exists.

### 3. [security] A public deploy has no protection for its GitHub quota — *should fix*

- **Where:** `src/lib/repo/repoEndpoint.ts:23-35` and `src/lib/repo/github.ts:139-149`.
- **What is wrong:** Each world load costs 3 GitHub calls. The only caching is the CDN header `s-maxage=300`. The route ignores unknown query parameters, so `?repo=a/b&x=1`, `&x=2`, … are all different CDN entries and all cache misses. The GitHub `fetch` calls set no `next: { revalidate }`, and Next 16 does not cache `fetch` in route handlers unless asked, so nothing is cached on the server either. `GITHUB_TOKEN` is documented as "optional"; without it the deployment gets 60 calls per hour, about 20 world loads shared by every visitor (on Vercel, possibly shared with other tenants of the same IP).
- **Scenario:** a class of graders loads more than 20 repos in an hour, or one person scripts requests with random parameters. Everyone then gets "GitHub needs a breather" until the quota resets. Only availability is affected; no data is exposed.
- **How I verified it:** by reading the code. A curl confirmed that the route answers normally regardless of its other parameters. I did not measure Vercel's cache key behaviour.
- **Suggested fix:** treat the token as required in production (say so in the README, and log a warning at startup when it is missing). Cache GitHub responses on the server by `owner/repo/ref`, for example `fetch(url, { headers, next: { revalidate: 300 } })`; the tree call is pinned to a SHA and can be cached far longer. Optionally reject or redirect unknown query parameters.

### 4. Two open tabs overwrite each other's save, losing items and coins — *should fix*

- **Where:** `src/lib/game/store.ts:376-407` (`createSaveStore`).
- **What is wrong:** each tab loads the save once and from then on writes its own in-memory copy. Nothing listens for the `storage` event (or uses a `BroadcastChannel`), so the last tab to write wins.
- **Scenario:** a player keeps two tabs open. In tab A they win a Wizard Hat and reach 500 coins; the save is written. Tab B, opened earlier, then picks up one coin and writes its stale copy. The hat and the 500 coins are gone.
- **How I verified it:** a Playwright script with two pages in one browser context, both in the Demo Kingdom, changing the save through the dev handle `window.__app.save`. After tab A: 500 coins and the hat. After tab B: 2 coins and no hat.
- **Suggested fix:** in `createSaveStore`, listen for `window`'s `storage` event on `SAVE_STORAGE_KEY` and adopt `sanitizeSave(JSON.parse(event.newValue))`. A simpler alternative is to detect a second tab with a `BroadcastChannel` and show "Lintlands is open in another tab".

### 5. [security] The developer pages ship to production, and `/dev/engine` writes to the player's real save — *minor*

- **Where:** `src/app/dev/*` (nothing excludes them from the build), and specifically `src/app/dev/engine/page.tsx:83,85,113-122`.
- **What is wrong:** `/dev/engine` uses `createSaveStore()` with the real `localStorage` key. It applies `?theme=` to the real save, records demo defeats there, and installs `window.__lintlands` (including `give(coins)`) with no `NODE_ENV` check. The page's own header says this happens "In development". By contrast, `GameScreen`'s `window.__app` *is* gated (`src/components/app/GameScreen.tsx:176`). Because everything is single-player and client-side, this is not a privilege problem, but it lets a stray visit change a real player's theme and progress, and it exposes debug UI publicly.
- **How I verified it:** a Playwright script seeded a save with theme `meadow` and 5 coins, opened `/dev/engine?theme=night` and called `__lintlands.give(1000)`. The real save then had theme `night` and 1005 coins. The production exposure itself is from reading the code (no `next build` was run).
- **Suggested fix:** add `src/app/dev/layout.tsx` that calls `notFound()` when `process.env.NODE_ENV === "production"`, and use `createSaveStore(null)` in `/dev/engine`, as `/dev/ui` already does (`src/app/dev/ui/fakeServices.ts:18`).

### 6. [security] The Markdown checklist does not escape backticks in file paths or branch names — *minor*

- **Where:** `src/lib/game/checklist.ts:46,52,79,83`.
- **What is wrong:** paths and the branch name are wrapped in single backticks, but a file name may itself contain a backtick (git allows it, and `REF_PATTERN` allows it in branch names). The code span then closes early, and the rest of the name becomes live Markdown in whatever issue or README the player pastes it into.
- **Scenario:** a repo containing ``evil`](https://example.com)`.py`` produces the heading ``## `evil`](https://example.com)`.py` (0/1)``, with broken formatting. A name such as ``x`[click](https://evil.example)`.py`` would render as a clickable link in the pasted issue.
- **How I verified it:** a scratch Vitest file calling `buildChecklist` on such a path.
- **Suggested fix:** add a `codeSpan(text)` helper that uses a fence one backtick longer than the longest run of backticks inside the text (the CommonMark rule), and use it for paths and the ref.

### 7. A pasted folder URL is read as a branch name and fails with "Couldn't find a branch" — *minor*

- **Where:** `src/lib/repo/parseRepoInput.ts:50-53`.
- **What is wrong:** everything after `/tree/` becomes the ref, so `https://github.com/psf/requests/tree/main/src` asks GitHub for the branch `main/src`. This is the URL a user gets by browsing into a folder and copying the address bar. (`/blob/...` URLs work, because only `tree` is treated specially.)
- **How I verified it:** I verified the parser output with a scratch test (`ref: "main/src"`). That the server then answers `not_found` is inferred from `github.ts:165`; I did not spend a GitHub call on it.
- **Suggested fix:** when `/commits/{ref}` returns 404/422 for a ref with slashes, retry with fewer path segments (at most two or three extra calls). Or treat only the first segment as the ref unless `?ref=` is given.

### 8. Level-up and purify sounds play twice, and milestone payouts are implemented twice — *minor*

- **Where:** `src/game/scenes/defeat.ts:26` and `src/components/app/gameEvents.ts:57` (`levelUp`); `src/game/scenes/dungeon.ts:187` and `src/components/app/gameEvents.ts:53` (`purify`). Milestones: `src/game/scenes/defeat.ts:30-37` and `src/components/app/useMilestones.ts:22-40`.
- **What is wrong:** the engine plays the sound *and* emits the event, and the UI plays the same sound again when it announces the event, so two copies start in the same instant and the sound is twice as loud. Milestones are claimed in the engine right after each defeat and again in a React effect. The reducer is idempotent, so nobody is paid twice, but the React path (with its nicer toast text, "Half the land is purified!") essentially never wins, because the engine path always runs first. That leaves two sources of truth for one rule.
- **How I verified it:** by tracing the code paths; I did not listen for it.
- **Suggested fix:** let exactly one side own each sound (the UI's `announceEvent` is the natural place). Keep one milestone path, either the engine's `recordFindingDefeated` or `useMilestones`, and delete the other.

### 9. There is no error boundary, so one render error blanks the whole app — *minor*

- **Where:** `src/app/` has no `error.tsx`, and `src/components/overlays/OverlayHost.tsx` is not wrapped in an error boundary.
- **What is wrong:** if any overlay or HUD component throws while rendering (for example on some unexpected analysis data), React unmounts the whole tree, and the player sees Next's generic "Application error" screen instead of the game. Their save survives, because it is flushed on `pagehide`.
- **How I verified it:** by reading the code. I did not find a concrete input that throws; this is hardening.
- **Suggested fix:** add `src/app/error.tsx` with a "Back to title" button, and wrap `OverlayHost` in a small error boundary that closes the overlay and calls `game.resume()`.

### Security review

**Checked and sound:**

- **The token never reaches the client.** `GITHUB_TOKEN` is read only in `src/app/api/repo/route.ts:12` and sent only in the `Authorization` header to `https://api.github.com` (`github.ts:140-149`). The only client import of `github.ts` is `import type` (`analyzeRepo.ts:14`), which is erased at compile time. There are no `NEXT_PUBLIC_` variables, error bodies use fixed messages that contain only the HTTP status, and nothing logs headers. `.env*` is git-ignored, and no `.env.local` exists.
- **Input validation.** The owner, repo and ref are validated with anchored, linear regular expressions (`parseRepoInput.ts:22-26,59-61`). Refs containing `..` are rejected, and each path segment is `encodeURIComponent`-ed. The host is fixed, so there is no SSRF route. I confirmed with curl that the empty, malformed, `..%2F..` and non-GitHub inputs all return 400 with `no-store`. The commit SHA is checked against `^[0-9a-f]{40}$` before it is used in a URL (`github.ts:135`).
- **Error mapping and caching.** Status codes are 400/404/422/429/502, `Retry-After` is set on rate limits, errors are never cached, and successes get `s-maxage=300` (`repoEndpoint.ts:13-50`).
- **Repo-controlled text.** File paths, messages, snippets and the repo description are rendered only as React text or with the bitmap font (unknown characters fall back to a placeholder glyph). There is no `dangerouslySetInnerHTML` or `innerHTML` anywhere in `src/` (`grep`). The only link built from repo data has a fixed `https://github.com/` prefix, encodes its segments, and uses `rel="noreferrer noopener"` (`codexData.ts:43-47`, `FindingDetail.tsx:58-66`). Long text is clipped, not overflowing: a 3,000-character message on the bug card stays inside the panel (screenshot `.shots/review/longmsg-4-bugcard.png`).
- **`localStorage` as untrusted input.** `sanitizeSave` (`store.ts:282-315`) never throws. It clamps numbers, drops unknown items, unequips items the player does not own, drops `__proto__` keys and caps the number of repos. Lookups use `Object.hasOwn`, so a `constructor` key is harmless (checked with a scratch test).
- **Worker and Ruff.** Source code never reaches the server. Ruff crashes on hostile input (for example `RangeError: Maximum call stack size exceeded` on a 3,000-term sum or 30,000 nested brackets) are caught per file: the file becomes a ruin, and in my Node runs Ruff kept working afterwards. The slowest case I found (82 KB of nested `if`s) took 0.85 s.

**Wrong:** findings 3 (quota exhaustion), 5 (dev pages in production) and 6 (Markdown injection into the exported checklist). None of them exposes data.

### Also checked and found sound (no finding)

- **Pause and resume with overlays.** The engine pauses itself before emitting a pausing event (`src/game/index.ts:94-97`). `setPaused` empties the time accumulator, so the current frame runs no further steps (`engine/loop.ts:67-71`). Input is disabled while paused, and the key that closes an overlay is ignored by its timestamp (`engine/input.ts:67-88`). Every overlay's `close` resumes the game (`GameScreen.tsx:164-167`).
- **Soft-locks.** A dungeon chest that appears on top of the hero is handled: the hero can walk out of a solid tile (`entities/player.ts:150-158`). Fainting on the exit doormat is cleared by `restore()` when the overworld is entered. A dungeon that fails to generate shows a toast instead of crashing (`index.ts:103-110`). An overworld that fails to generate shows the error panel (`useWorldLoader.ts:67-77`).
- **Frame-rate independence.** The engine and the mini-game both use fixed 60 Hz steps with a 0.1 s cap per frame.
- **Lifecycle.** `destroy()` stops the loop, removes every input listener, unsubscribes from the save and destroys the scenes. The engine has no timers of its own.
- **Gacha and loot maths.** These match the addendum. Pity correctly counts a legendary as epic-or-better, and duplicate items refund coins.

---

## Tests and CI

**What the suite really covers.** 400 Vitest tests in 27 files (about 4,100 lines):

- repo-input parsing, file filtering, and the GitHub client and `/api/repo` handler with a fake `fetch` (status mapping, `Retry-After`, the Bearer header, cache headers);
- real Ruff runs on fixtures, `normalizeDiagnostic`, the quality grade, and the demo kingdom;
- the `analyzeRepo` pipeline with a fake fetch and Ruff's Node build (warnings, progress, abort, linter failure);
- world generation, including a 60-seed fuzz across 10 repo shapes that checks reachability, overlaps, size and determinism, plus dungeon shape tests;
- every save reducer, `sanitizeSave`, gacha odds and pity, chest loot, health and milestones, and the checklist;
- collision, attack shapes and combo;
- a headless simulation of every monster archetype in a real dungeon (never inside a wall, at most 3 pursuers, one boss at a time, fainting resets);
- the Bug Catch rules and a few shell helpers.

The tests are behavioural, not snapshot-style, and most would catch a real regression.

**Important behaviour with no test:**

- The engine ↔ UI contract: that a pausing event opens the right overlay and that closing it resumes the game. No React component is rendered in any test, and `vitest.config.mts` uses the `node` environment.
- `public/lint-worker.js` and `lintClient.ts`: they are always replaced by a fake. The "rebuild the workspace after a crash" path and the 30 s initialisation timeout are untested.
- The "save before the animation" guarantees in `ChestOverlay.tsx:49-54` and `GachaOverlay.tsx` (paying exactly once, rolling exactly once).
- The behaviours behind findings 1, 2, 4 and 6. A test of the form "every Ruff diagnostic appears in the checklist or in the +N count" would have caught finding 1.
- The original spec's Playwright e2e paths (happy path, wrong answer, 404). `@playwright/test` is installed but used only by `scripts/shot.mjs`.

**Tests that assert too little:**

- `tests/analysis/ruff.test.ts:57-61` ("does not let a selected rule code go unrecognised") cannot fail on its own: the same `createNodeLint()` already runs at import time (`:14`), and its other two assertions (`length > 10`, contains `D103`) only check constants.
- `ruff.test.ts:53` checks only that 7 arguments do *not* trigger PLR0913. That assertion would also pass if PLR0913 were missing from the selection entirely, and no test shows that 9 arguments *do* trigger it.

**CI** (`.github/workflows/ci.yml`) runs `npm ci → lint → typecheck → test → build` on Node 22 for every push and pull request. Lint, typecheck and tests pass on a clean export of `f48ee79` (no `.next/`, no `next-env.d.ts`). The build step was not run here, so whether it passes is unverified; it needs network access for `next/font/google` and runs `scripts/copy-ruff.mjs` through `prebuild`. CI will catch type errors, lint errors and logic regressions in `src/lib/**`, the combat geometry and the monster AI. It will **not** catch a broken overlay, a broken engine ↔ React wiring, or a broken lint worker. For those the project relies on the `/dev/*` pages and manual screenshots.

---

## Maintainability for a student owner

**Overall.** Most files are under 300 lines and start with a plain-English header comment, often with an ASCII diagram. Pure logic (`src/lib/**`) is separated from React (`src/components/**`) and from the canvas engine (`src/game/**`), and all three meet only through `types.ts`, `catalog.ts` and `bridge.ts`. Tuning numbers are named constants. This is very explainable code. The cost is volume: roughly 34,000 lines in `src/` (7,400 of them procedural art, 4,600 in the game entities, 2,800 in world generation, 2,300 in dev pages), which is a lot to defend in an oral exam.

**Easiest to explain:** `src/lib/game/catalog.ts` and `src/lib/analysis/rules.ts` (pure data); `src/lib/repo/*` (about 400 lines in total); `src/lib/game/gacha.ts`, `loot.ts` and `checklist.ts`; `src/game/engine/loop.ts` and `collision.ts` (excellent comments); `src/components/app/App.tsx` with `flow.ts` (a five-state machine).

**Hardest to explain:**

- The monster AI: 28 files and about 3,300 lines in `src/game/entities/monsters/` (brains, engagement limits, boss shows, death slow-motion).
- World generation's layout pipeline: `layout.ts`, `packing.ts`, `paths.ts` (2-wide road search), `nature.ts`, `water.ts`, and the "repair until reachable" loop in `reachability.ts`.
- The audio sequencer's look-ahead scheduling (`src/game/audio/sequencer.ts`, 387 lines).
- The glyph-atlas font (`src/game/art/font.ts`).
- `createSelectionMemo` in `src/lib/game/useStore.ts`: correct, but subtle (`useSyncExternalStore` plus shallow-equality reuse).

**Too long or too clever:** the art data files (`src/game/art/ground.ts` at 729 lines, `buildings.ts` 579, `characterParts.ts` 554) are long but are mostly drawing data, so she can describe them by pattern rather than line by line. `src/lib/analysis/demo.ts` (511 lines) is mostly embedded Python, which is fine.

**Naming and comment problems:**

- Two module-private constants named `SEVERITY_RANK` have *opposite* orderings: `normalize.ts:138` uses boss = 0, while `loot.ts:65` uses minion = 0. This will confuse whoever edits one after reading the other.
- Stale comments: `src/game/services.ts:5` says `createGame` builds the services, but the app now calls `createEngine`. `src/game/debug.ts:3` says the helpers are "Not used by the real game UI", but `GameScreen.tsx:183-185` now exposes them. The `/dev/engine` header says "In development" for an ungated handle (finding 5).
- "Bestiary" (spec and `parts/codex/Bestiary.tsx`) and "Codex" (UI) name overlapping things.

**Dead code:**

- `createGame` (`src/game/index.ts:39-41`) has no callers.
- `resetRepo` and `resetAll` (`src/lib/game/actions.ts:260-269`), `wish` (`gacha.ts:186-189`) and `GACHA_ODDS_TEXT` (`gacha.ts:217-227`) are exported and tested but not used by the app. There is also no UI to reset progress, which `resetRepo` was clearly meant for.

**Duplicated logic:**

- Milestone payout (finding 8).
- Three copies of `isTypingTarget`: `GameScreen.tsx:61`, `engine/input.ts:55` and `loading/bugCatch/input.ts:28`.
- Three or four `plural` helpers: `analyzeSources.ts:129`, `checklist.ts:40`, `villagers.ts:137`, and `count` in `WorldReadyCard.tsx`.
- Code-point string comparison written three times: `regions.ts:154`, `filterFiles.ts:83`, and inline in `checklist.ts:68`.
- Two separate `Px.tsx` sprite-preview helpers doing the same job in `src/app/dev/art` and `art2` (they have diverged).

**The five files to read first, in order:**

1. `src/lib/types.ts`: every data shape and the pipeline diagram.
2. `src/lib/analysis/analyzeRepo.ts`: the browser pipeline from listing to download, lint and analysis. Read it with `src/lib/repo/repoEndpoint.ts` and `github.ts` for the server side.
3. `src/lib/worldgen/overworld.ts`: its 10-step header is the whole world generator in one page.
4. `src/game/index.ts`: how the engine is assembled, scene switching, and pause/resume/destroy.
5. `src/components/app/GameScreen.tsx`, read with `src/game/bridge.ts`: where React, the engine, the HUD and the overlays meet.

**Three places where she could most safely make a meaningful change of her own:**

1. **`src/lib/game/catalog.ts`.** Add a weapon, hat, charm or theme, or rebalance monster HP and speed. It is pure data. Unknown item art falls back to a placeholder icon (`src/game/art/items.ts:30`), and `npm test` checks the economy rules.
2. **`src/lib/analysis/rules.ts`.** Add a `RULE_TABLE` row (title, monster, tip) or move a rule between `MONSTER_RULES`, `PROBE_RULES` and `IGNORED_RULES`. `tests/analysis/ruff.test.ts` runs the real Ruff and would flag a bad selector.
3. **The tuning constants and pure functions in `src/lib/game/loot.ts`, `gacha.ts` and `src/lib/analysis/quality.ts`.** Chest tables, wish rates and grade thresholds all live here, each with unit tests. Fixing finding 2 inside `quality.ts` would be a good self-contained first change.

---

## Not reviewed / low confidence

- **Read closely:** the API route and `src/lib/repo/**`; the analysis pipeline and the worker; `src/lib/game/**`; `regions.ts`, `overworld.ts` and `dungeon.ts` in world generation; the engine's `index.ts`, loop, input, collision and transition; the dungeon and overworld scenes, `defeat.ts`, the monster director, `blinker.ts`, `skitter.ts` and `moves.ts`; and these React components: `GameScreen`, `App`, `useWorldLoader`, `LoadingScreen`, `RepoForm`, `ChestOverlay`, `GachaOverlay`, `CodeSnippet`, `FindingDetail` and `CopyChecklistButton`.
- **Skimmed:** the other overlays (Bag, Board, Pause, Wardrobe, Dialog, Victory, BugCard); the HUD; `src/game/combat/**`; the other monster brains and the boss files; `nature.ts`, `layout.ts`, `packing.ts`, `paths.ts`, `water.ts`, `placement.ts` and `reachability.ts` in world generation (I relied on my own stress tests and the existing fuzz instead); the Bug Catch internals beyond `loop.ts`; `src/game/art/**` (only caching, icon fallback and the font's missing glyph); `src/game/audio/**` (only unlock and the scheduler interval).
- **Not run or not verified:** `npm run build`; Vercel-specific behaviour (function time limits with up to three 10 s GitHub calls, CDN cache keys); the app with `GITHUB_TOKEN` set (none is configured here, so the token path is checked only by unit tests and reading); a Ruff crash inside the *browser* worker (only the Node build was tested); difficulty beyond one bot run and the simulation tests; mobile and touch (the main game has no touch controls, which the request did not ask for); accessibility (Tab is bound to the pause menu, so keyboard focus cannot reach the HUD buttons while playing).
- **Uncertain:** the exact GitHub response for a folder-style ref (finding 7) is inferred, not observed.
