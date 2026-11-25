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

## How the build was split up

The orchestrating model (Fable 5.2) wrote these files itself before any subagent started, so that every subagent coded against the same contracts:

- `src/lib/types.ts` — data shapes shared by every module
- `src/lib/game/catalog.ts` — every item, monster, theme and character option (the game's design sheet)
- `src/game/bridge.ts` — the engine ↔ UI ↔ audio interfaces
- `src/lib/rng.ts`, `src/components/ui/kit.tsx`, `src/components/overlays/types.ts`, project scaffold and CI

<!-- SUBAGENT-TABLE -->
