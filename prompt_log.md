# Prompt log — Lintlands (15-113 Project 3)

Prompts are copied **verbatim** from my Claude Code session transcripts (typos included).
The short notes in *italics* under each prompt say what came out of it; those notes are AI-written summaries, the prompts are not.

## Tools and models

| Job | Tool | Model |
|---|---|---|
| Brainstorming, feasibility check of three ideas, writing three candidate specs | Claude Code desktop app (Code tab) | Claude Fable 5.2 (`claude-fable-5-2`) |
| Orchestrating the build: architecture, shared type contracts, item/monster catalog, integration, playtesting in the built-in browser, commits | Claude Code desktop app (Code tab) | Claude Fable 5.2 (`claude-fable-5-2`) |
| Building individual modules in parallel as subagents (see "How the build was split up") | Claude Code subagents (Agent tool) | Claude Opus 5.5 (`claude-opus-5-5`) |
| Independent second-agent review of the build against the spec (`REVIEW.md`) | Claude Code subagent | Claude Opus 5.5 (`claude-opus-5-5`) |
| Static analysis inside the game itself (not an AI model) | Ruff 0.17.6 compiled to WebAssembly | — |

## Parts of the code I wrote or substantially modified myself

> **TODO (April):** list the files/functions you wrote or reworked by hand, with commit hashes. Nothing is listed yet because everything so far came out of the session logged below.

## Timeline

### 2026-11-25 — Session 1: picking an idea (Claude Code, Fable 5.2)

**Prompt 1 (16:39)**

```
can you access any user's google drive content directly?
```

**Prompt 2 (16:41)**

```
i want to build a program that uses people's google drive is there any api we can use to enable this
```

**Prompt 3 (16:47)**

```
a couple possible directions, which is most feasible?
- access all of someone's google drive files and create a cute 2d pixel art world where the user can walk around and explore them. 
- a similar thing, but with github repo code. the user inputs their repo and we generate a world with the code, where bad code and bugs are in like dungeons or something. look into static bug catching analyzers and linters
- above but with a google doc and catching grammar or writing mistakes
```

**Prompt 4 (16:50)**

```
can you create specs for these ideas? and put them into project3_2 folder
```

*Outcome: three candidate specs were written (Drive world, repo dungeon, doc dungeon). The repo-dungeon spec ("Lintlands") was rated the most feasible: public repos need no login, GitHub returns the whole file tree in one call, and the Ruff linter can run in the browser as WebAssembly. That spec is `SPEC.md` in this repo.*

### 2026-11-25 — Session 2: the first full build (Claude Code, Fable 5.2 orchestrating Opus 5.5 subagents)

**Prompt 5 (17:02)**

```
build a cute 2d pixel art world with github repo code. the user inputs their repo and we generate a world with the code, where bad code and bugs are in like dungeons or something. look into static bug catching analyzers and linters. limit to only python files. use as many subagents as you need (make them opus 5.5). make the character customizable and indie game style art. have different scenery options the user can choose. make sure the game is not hard, make it very very fun. add mechanics that you think would be fun. have some sort of loading game while the dungeon generates. good code should be rewards for the user, new weapons or powerups. add some randomization/gacha. 
please reference https://www.cs.cmu.edu/~113/project3.html for what files to create and update, and outline which parts i should write.

commit to https://github.com/agongster/project3
```

*Outcome: see "How the build was split up" below. The orchestrating model read the assignment page and the existing spec, noticed the old `project3/` folder held unrelated uncommitted work and built in `project3_2/` instead, wrote the shared contracts first, then fanned the work out to subagents and integrated the results.*

**Prompt 6 (21:38)**

```
push to my github pages and host it agongster.github.io
```

*Outcome: `agongster.github.io` itself is already my portfolio site, so the game is published next to it at `https://agongster.github.io/project3/` instead of replacing it. GitHub Pages has no server, so that build is a static export: the browser asks the GitHub API directly instead of going through `/api/repo` (`src/lib/hosting.ts`, `next.config.ts`, `.github/workflows/pages.yml`).*

**Prompt 7 (21:54)**

```
give me some ideas to keep this gameplay fun but add more code in the gameplay. repo should matter more in what the user sees.
```

*Outcome: a list of ideas only, no code changed (function-shaped dungeon rooms, an optional "pick the fix" finishing move, imports as roads, tests as watchtowers, names and docstrings from the repo, re-linting a newer commit).*

## How the build was split up

The orchestrating model (Fable 5.2) wrote these files itself before any subagent started, so that every subagent coded against the same contracts:

- `src/lib/types.ts` — data shapes shared by every module
- `src/lib/game/catalog.ts` — every item, monster, theme and character option (the game's design sheet)
- `src/game/bridge.ts` — the engine ↔ UI ↔ audio interfaces
- `src/lib/rng.ts`, `src/components/ui/kit.tsx`, `src/components/overlays/types.ts`, project scaffold and CI

Then one prompt from the orchestrator went to each subagent below (Claude Opus 5.5). Each subagent owned its own folders and was not allowed to edit anyone else's files or the shared contracts. The subagent briefs were written by the orchestrating model, not by me, so they are summarised here rather than quoted.

| # | Subagent's job | Files it owned | Commit |
|---|---|---|---|
| 1 | GitHub fetching and the Ruff lint pipeline: `/api/repo`, input parsing, file filtering, rule → monster table, quality grade, Web Worker, offline demo repo | `src/app/api/repo/`, `src/lib/repo/`, `src/lib/analysis/`, `public/lint-worker.js`, `tests/analysis/` | `663c3e2` |
| 2 | Game-state logic: save store, reducers, gacha odds and pity, chest loot, repo-health maths, Markdown checklist export | `src/lib/game/` (except `catalog.ts`), `tests/game/` | `2d48881` |
| 3 | Sound: 34 synthesized sound effects and 6 chiptune loops with the Web Audio API | `src/game/audio/` | `c7825a2` |
| 4 | Pixel art, part 1: ground tiles, props, buildings, six colour themes, the hero generator | `src/game/art/` (environment and character files) | `e9f2ce1` |
| 5 | World generation: overworld village layout and per-file dungeons, seeded and checked for reachability | `src/lib/worldgen/`, `tests/worldgen/` | `2db7802` |
| 6 | Pixel art, part 2: monsters, item icons, weapons, pets, UI sprites, bitmap font | `src/game/art/` (monster, item, weapon, pet, ui, font files) | `c038f51` |
| 7 | "Bug Catch", the loading-screen mini-game | `src/components/loading/`, `tests/loading/` | `5a5d4e6` |
| 8 | App shell: title screen, hero creator, loading screen, HUD, pause / wardrobe / dialog overlays | `src/components/app/`, `screens/`, `character/`, `hud/`, `src/app/page.tsx` | `626ee4d` |
| 9 | Canvas engine: game loop, input, camera, collision, hero, weapons, pets, overworld and dungeon scenes | `src/game/engine/`, `entities/`, `combat/`, `scenes/`, `tests/engine/` | `565714d` |
| 10 | Reward and information overlays: chest reveal, Wishing Well, bag, codex, notice board, bug card, victory | `src/components/overlays/` | `b595d58` |
| 11 | Dungeon monsters: 8 enemy behaviours, 3 bosses, the purify-and-chest flow | `src/game/entities/monsters/`, `src/game/scenes/dungeonCleanse.ts` | `83fa9fc` |
| 12 | Independent review of the finished build against `SPEC.md` (wrote `REVIEW.md`, changed no code) | `REVIEW.md` | see the last section |

### What the orchestrating model changed after the subagents finished

Found by play-testing the assembled game in the browser and with a scripted bot:

- World generator picked random variants for torches, cobwebs and fences, but the art gives those variants a meaning (wall sconce, left / right corner). Fixed in `src/lib/worldgen/dungeon.ts` and `nature.ts`.
- Villager portraits in dialogs did not match the villager on the map (`src/lib/worldgen/placement.ts`).
- After a ten-wish pull the Wishing Well said "Out of coins" even with enough for a single wish (`src/components/overlays/GachaOverlay.tsx`, commit `0556a2b`).
- The example repo `karpathy/micrograd` lints completely clean, which makes a dull first world; swapped for `karpathy/minGPT` (commit `060d6b2`).
- Balance: Spaghetti Beast HP 12 → 9 (commit `f773372`); the monsters subagent's play-tested HP values were moved into `catalog.ts`.
- HUD text was hard to read on a normal-density screen: the font's "fi" ligature turned `config.py` into something like "conAg.py", and the bold weight closed up "c" and "2". Ligatures are now off and only the two lightest weights are loaded (`src/app/layout.tsx`, `src/app/globals.css`).

### After the independent review

`REVIEW.md` was written by subagent 12 and is kept unedited. It reported no blockers, four "should fix" findings and five minor ones. The orchestrating model then fixed six of them (commit `5819115`):

| Review finding | What was done |
|---|---|
| 3. Nothing cached GitHub calls on the server, so a busy site would exhaust the rate limit | GitHub answers are now cached by Next.js for 5 minutes (repo, branch) or a day (a commit's file list). Measured: three loads of the same repo cost 3 GitHub calls instead of 9. |
| 4. Two open tabs overwrote each other's save | A tab now adopts the save another tab writes (`storage` event) instead of overwriting it. |
| 5. `/dev/*` pages shipped to production and `/dev/engine` used the real save | `/dev/*` returns 404 in a production build; the engine sandbox uses an in-memory save. |
| 6. Backticks in file or branch names broke the exported Markdown | Names are wrapped with a CommonMark-safe code span. |
| 8. Level-up and purify sounds played twice; milestone payout existed twice | Each sound and the payout now have one owner (the UI layer). |
| 9. One render error blanked the whole app | Added an error screen with "Try again" and "Reload the game". |

Also from the review's notes: a bug-free repo now gets an "already pure" message on entry, two opposite `SEVERITY_RANK` tables were renamed, an unused `createGame` wrapper was removed, and stale comments were corrected.

**Still open** (not fixed by AI): findings 1 (same-line findings are dropped from the to-do list), 2 (the quality grade treats private functions as documented) and 7 (folder URLs are misread). They are listed under "Review and known issues" in the README.
