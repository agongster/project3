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
build a cute 2d pixel art world with github repo code. the user inputs their repo and we generate a world with the code, where bad code and bugs are in like dungeons or something. look into static bug catching analyzers and linters. limit to only python files. use as many subagents as you need (make them opus 5.5). make the character customizable and indie game style art. have different scenery options the user can choose. make sure the game is not hard, make it very very fun. add mechanics that you think would be fun. have some sort of loading game while the dungeon generates. good code should be rewards for the user, new weapons or powerups. add some randomization/gatcha. 
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

**Prompt 8 (21:57)**

```
keep brainstorming, use subagents (opus 5.5) to implement ideas 2 and 3
```

*Outcome: more ideas were listed, and two Opus 5.5 subagents built (a) the pick-the-fix finisher — a dazed elite or boss can be finished by choosing the real fix from three (`src/lib/game/finisher.ts`, `src/components/overlays/FinisherOverlay.tsx`, `src/game/entities/monsters/dazed.ts`) — and (b) each monster's offending source line carved into the dungeon floor, healing when the monster dies (`src/game/scenes/floorCode.ts`, `floorCodeLayout.ts`).*

**Prompt 9 (22:02)**

```
add extra subagents to implement monsters behaving like their bug, file shaping the place, and repo's own words in the game
```

*Outcome: the orchestrating model first wrote a shared per-file "code outline" (functions, branches, docstrings, comments, imports: `src/lib/analysis/outline.ts`). Then three more Opus 5.5 subagents built: monster traits that mirror the bug (`src/game/entities/monsters/traits/`, `src/lib/analysis/traits.ts`); dungeons shaped by the file — a room per function, forks for branchy functions, lit rooms for documented ones, a treemap on the big map (`src/lib/worldgen/roomPlan.ts`, `roomMaze.ts`, `dungeonDecor.ts`, `src/game/ui/treemap.ts`); and the repo's own words — villagers named after classes who quote comments, engraved loot, bounties quoting real lines, a README greeting, import merchants (`src/lib/worldgen/repoWords.ts`, `merchants.ts`, `src/lib/game/engraving.ts`, `bounties.ts`, `src/lib/analysis/readme.ts`). The computer went to sleep twice mid-run and two subagents had to be resumed. Integration by the orchestrator: room name in the HUD pill, a third-party import and an undocumented function in the demo so it shows merchants and a dim room. Not re-reviewed by a second agent.*

### 2026-11-26 — Session 3: the gamified IDE (Claude Code, Fable 5.2 orchestrating Opus 5.5 subagents)

**Prompt 10 (11:21)**

```
we want to turn this into a full fledged gamified IDE. the user should be able to edit and view all code files but make it gamified.
```

*Outcome: the orchestrating model designed "the Workshop" (SPEC.md section E) and wrote its interface (`src/lib/workspace/contract.ts`), choosing on its own that edits stay in the browser and export as a patch or zip rather than being pushed to GitHub. Four Opus 5.5 subagents then built it: the workspace core (`src/lib/workspace/`, `src/lib/game/forge.ts`: keep sources and the linter alive, save = "forge", match findings across edits so moved lines are not mistaken for fixes, quick fixes, formatting, export), the editor UI (`src/components/workshop/`, CodeMirror 6: explorer, monsters in the gutter, bug cards, the forge moment, grade and changes panels), quests and achievements for editing (`src/lib/game/quests*.ts`, `achievements.ts`, `src/components/workshop/quests/`), and the wiring into the game (`src/components/app/useWorkshop.ts`, `forgeFlow.ts`, `GameHandle.updateAnalysis`, the in-place dungeon rebuild in `src/game/scenes/dungeonReform.ts`).*

**Prompt 11 (12:58)**

```
the main UI should still be the game as you built before, and it should secondarily be an IDE. i.e. it is primarily a game, and secondarily an IDE, as opposed to the other way around. please make sure this is met.
```

*Outcome: sent to the wiring subagent as binding rules and added to SPEC.md section E as rule 0: the app opens into the game exactly as before; the Workshop is one ordinary HUD button and the F key, never opens by itself and is never required; game actions stay the primary buttons in every overlay and "Fix it for real" is a secondary link; the title screen keeps its tagline; nothing calls it an IDE. Checked by the orchestrator in screenshots and by the bot that never opens the Workshop.*

**Prompt 12 (13:49)**

```
a few things:

1. add a door at the end of the dungeon for player to exit when they're done
2. the text right now is hard to read, please choose a more readable font. especially for character customization and numbers.
3. add more character customization options. 
4. for the text on the grounf after defeating the monster, player should be able to press E to open that line in the IDE. 
5. player needs to fix the line to fully defeat the monster.
6. we haven't run into any bosses yet, where are they?
7. add more variations to the monsters.

use opus 5.5 subagents for all of these.
```

*Outcome: the orchestrating model first wrote the rules as SPEC.md section F (the words subdued / fixed / sealed / quiet / purified, and its own addition of a "seal scroll" so that nobody gets stuck), then five Opus 5.5 subagents built the seven points in parallel:*

- *Points 4 and 5, fight then fix (`src/lib/game/progress.ts`, `seal.ts`, `src/game/scenes/floorCode*.ts`, the Workshop bug card): winning a fight only subdues a monster; it dozes as a wisp over its glowing line; E on the line opens the Workshop there; Repo Health and the victory count fixed or sealed bugs only. A seal (`# noqa`) pays nothing. A syntax error cannot be sealed and has to be repaired by hand.*
- *Point 1, end door (`src/lib/worldgen/dungeonDoorSpot.ts`, `src/game/scenes/dungeonEndDoor.ts`): a door in the east wall of the last room that opens when nothing is left to fight.*
- *Points 6 and 7, bosses and variety (`src/lib/game/champions.ts`, `monsterLooks.ts`, `monsterModifiers.ts`, `src/game/ui/lairMarks.ts`): the subagent measured that bosses were present but unmarked (demo 4 of 22 monsters, `karpathy/nanoGPT` 6 of 27, `psf/requests` 0 of 70; the orchestrator's earlier "about 2%" was wrong). Boss buildings now carry a badge and a pennant and are listed on the maps and the notice board; a dungeon without a boss crowns a champion; more lint rules produce bosses; monsters get colour families, seeded looks and six modifiers.*
- *Point 2, fonts (`src/app/layout.tsx`, `globals.css`, `src/components/hud/units.ts`, `src/game/art/fontGlyphs.ts`): Pixelify Sans replaced by Nunito for all text and numbers; Press Start 2P kept only for large titles; a type scale with minimum sizes.*
- *Point 3, hero options (`src/game/art/character*.ts`, `src/components/character/`): more hair, outfits, eyes, skin tones and colours; new groups for a second outfit colour, eye colour, mouth, skin details, eyewear, facial hair and a back item; a tabbed creator with presets and undo. Body build was left out. Old saves draw exactly as before.*

*Integration by the orchestrator: three leftovers between subagents (a label colour for quiet buildings, one float text, one import), and one addition of its own: pressing E on a glowing line opens that line's bug card at once (`Workshop.tsx`). Checked with `tsc`, ESLint, 1,211 unit tests, a bot that plays the demo and `karpathy/nanoGPT` to the victory screen by fighting and then fixing or sealing every line, a second bot that never opens the Workshop (every dungeon quiet, none purified, no victory), and the static export. Not reviewed by a second agent. Consequence the owner was told about: the game can no longer be finished without the Workshop.*

**Prompt 13 (21:06)**

```
"seal scroll" and "forge" are kind of unclear. find better wording for these that make it clearer to the user what it does. also UI reloads after fixing a bug, which is disruptive.
```

*Outcome (done by the orchestrating model itself, no subagents): on screen "Forge" is now **Save**, "Seal scroll" is **Ignore this bug** (a sealed bug reads "ignored"), and, changed along with it, "Use the fix scroll" is **Auto-fix**; the code keeps the names `forge` and `seal`. The "reload" was reproduced with a script: after fixing one bug while other monsters were alive, the dungeon was rebuilt and the hero was put back at the entrance, 256 px away. Now the room stays as it is (`src/game/scenes/dungeonReform.ts`, `dungeon.ts`, `Director.follow` in `src/game/entities/monsters/director.ts`): the hero keeps their place, living monsters follow their bug to its new line, and a bug that is new to the room waits until the room is done. Checked with unit tests, a script that fixes each bug right after subduing its monster (two demo dungeons: hero moved 0 px every time, chest at the end), and the play-through bots.*

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
