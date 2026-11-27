# Lintlands

<!--
APRIL — this top part of the README has to be written by you (assignment rule:
"Write this yourself"). Replace this whole comment with your own words.

The assignment asks the README to explain:
  - what the project does
  - how to use it
  - which features you are most proud of
  - how to run it locally
  - how secrets (if any) are handled
  - a brief summary of how you used AI, with citations for anything that
    produced a substantial portion of the code

Facts you may need (commands, the env variable, the file map) are in the
AI-generated section below — describe them in your own words up here.
Also add: the deployed URL and the demo-video link once they exist.
-->

**TODO (April): write this section yourself.**

Lintlands is a 2D pixel art dungeon crawler integrated with a user-provided Github repo. 

---

## AI-generated documentation

> Everything below this heading was written by AI (Claude Code — Claude Fable 5.2 orchestrating Claude Opus 5.5 subagents). See `prompt_log.md` for the prompts.

### Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. Click **Play the Demo Kingdom** to try it without any network access, or paste a public Python repo such as `karpathy/nanoGPT`.

Requires Node 22. `npm run dev` and `npm run build` first run `scripts/copy-ruff.mjs`, which copies the Ruff WebAssembly files from `node_modules` into `public/ruff/` (that folder is git-ignored).

### Environment variables and secrets

| Variable | Required? | What it is |
|---|---|---|
| `GITHUB_TOKEN` | optional locally, **recommended when deployed** | A GitHub personal access token with **no scopes** (public read-only). Without it the server can make 60 GitHub API requests per hour, shared by every visitor (about 20 new repos per hour); with it, 5,000. |

- Local: copy `.env.example` to `.env.local` and paste the token. `.env*` files are git-ignored (only `.env.example` is committed).
- Deployed (Vercel): add `GITHUB_TOKEN` under Project → Settings → Environment Variables.
- The token is only read on the server, in `src/app/api/repo/route.ts`, and is only ever sent to `api.github.com` in an `Authorization` header. It is never sent to the browser and never logged.
- GitHub's answers are cached on the server (5 minutes for "which commit is this branch on", a day for a commit's file list), so loading the same repo again costs no GitHub requests.
- No user accounts, no database. Progress is saved in the browser's `localStorage`; if the game is open in two tabs, they share one save.
- Source code from the repo being explored is downloaded **by the player's browser** from `raw.githubusercontent.com` and linted there; it never passes through this app's server.

### How it works

```
 browser                              server                         GitHub
 ───────                              ──────                         ──────
 title screen ── GET /api/repo ─────► route.ts ── 3 REST calls ────► api.github.com
              ◄── list of .py files ─┘  (adds GITHUB_TOKEN)
 download each file ───────────────────────────────────────────────► raw.githubusercontent.com
 lint each file with Ruff (WebAssembly, in a Web Worker)
 findings ─► RepoAnalysis ─► generateOverworld() ─► canvas game
```

1. **`/api/repo`** resolves the repo to one commit and returns its Python files (filtered: no vendored folders, files ≤ 100 KB, at most 150 files).
2. The browser downloads the files and runs **Ruff** on each one inside a Web Worker (`public/lint-worker.js`).
3. Each diagnostic becomes a **Finding** → one monster. Files with no findings get a **quality grade** (S/A/B/C).
4. **World generation** turns the analysis into a tile map: one region per top-level folder, one building per file. It is seeded by `owner/repo@commit`, so the same commit always makes the same world.
5. The **engine** draws the world on a 400×225 canvas scaled up by a whole number. React draws the menus and HUD on top.

### Beating a bug: fight, then fix

A monster is one lint finding, and it takes two steps to beat it for good.

| State | What happened | What it counts for |
|---|---|---|
| **Alive** | The bug is in the code and its monster fights. | Nothing yet |
| **Subdued** | You won the fight. The monster dozes as a pale wisp over its line of code, which glows on the floor. | Coins and XP; the dungeon can go *quiet* |
| **Fixed** | The bug is gone from the saved code. The line turns gold. | Repo Health, the fix reward, the victory |
| **Ignored** | "Ignore this bug" added `# noqa: CODE` to the line, so the checker skips it: the bug is still in the code. | Repo Health and the victory, but no reward |

- Stand on a subdued monster's glowing line and press **E**: the Workshop opens on exactly that line. Fixing a line without fighting first is allowed.
- A dungeon is **quiet** when nothing in it is left to fight; its **end door** (in the last room) opens then, and the entrance works at all times. It is **purified** when its file has no bug left; only then does its chest appear.
- **Repo Health** counts fixed and ignored bugs; subdued ones show as a lighter part of the bar. The victory screen needs every bug fixed or ignored, so the game cannot be finished by fighting alone.
- **Nobody gets stuck:** every bug card in the Workshop has an **Auto-fix** button when Ruff offers a fix, and always **Ignore this bug**. The one exception is a syntax error, which cannot be ignored and has to be repaired by hand.
- **The room stays put.** After a saved fix the dungeon is not rebuilt: the hero keeps their place, the fixed monster dissolves, the others fight on. A bug that is new to the room (fixing one can let another in under the cap of 10 monsters per file) waits until the room is done.

The rules live in `src/lib/game/progress.ts` (`findingState`, `isDungeonQuiet`, `isDungeonPurified`), `src/lib/game/seal.ts` and `src/game/scenes/dungeonReform.ts`.

**Two words differ between the screen and the code.** The player sees **Save** and **Ignore**; the code calls them `forge` and `seal` (so `forge` is never confused with the game's own save file in `localStorage`).

**Bosses and champions.** A boss exists only where the code has a serious finding: a hardcoded secret, `eval`/`exec`/shell/pickle/SQL built from strings, a turned-off certificate check, or code Python cannot compile (`src/lib/analysis/rules.ts`). Some repos have several, some have none. A building that hides one carries a horned-skull badge and a pennant, and the maps and the notice board list them. A dungeon with at least four monsters and no boss crowns its toughest monster as a **champion** (`src/lib/game/champions.ts`). Ordinary monsters also vary: colour family by lint rule, small seeded differences in looks, and for about half of them one modifier such as Swift, Sturdy or Tiny (`monsterLooks.ts`, `monsterModifiers.ts`).

### The Workshop (editing the code)

Lintlands is a game first. The Workshop is a room inside it: press **E** on a glowing line, or **F** (or the Workshop button next to Bag and Codex) to open the file you are in or facing in a code editor.

- **Typing changes nothing.** While you type, live Ruff findings appear as monster sprites in the gutter.
- **Save (Ctrl/Cmd+S) is the game move** (`forge` in the code). The file is re-linted and the world follows: bugs that are gone are *fixed for real* (their monsters dissolve; each pays double, once), new bugs become new monsters with no penalty, and the file's grade and dungeon update. A file whose last bug is fixed turns into a treasure house.
- **All text files open**; only Python files have monsters.
- **Edits stay in the browser** (localStorage, per commit). Nothing is written to GitHub. The Changes tab downloads a patch (`git apply` accepts it) or a zip.
- **Quests** come from the repo's own code ("Document `take_order()`"), plus a streak for saves that fix without breaking, and achievements.

How it fits together: `src/lib/workspace/contract.ts` is the interface (`read`, `check`, `forge`, `revert`, `exportPatch`…), `src/lib/game/forge.ts` pays the rewards, and `GameHandle.updateAnalysis` in `src/game/bridge.ts` lets the running game follow the code without restarting.

### Controls

| Key | Action |
|---|---|
| WASD / arrow keys | Move |
| Space / J / click | Attack |
| Shift / K | Dash |
| E / Enter | Interact (doors, chests, villagers, the Wishing Well); on a glowing line in a dungeon, open that line in the Workshop |
| I or B | Bag |
| C | Codex (the bug list) |
| M | Big map (E switches to the repo treemap) |
| F | Open the Workshop (the code editor) at the file you are in or facing |
| Esc / Tab | Pause menu |

### Project map

| Path | What lives there |
|---|---|
| `src/lib/types.ts` | Every data shape shared between modules. **Start reading here.** |
| `src/lib/game/catalog.ts` | The design sheet: every item, monster, theme and character option as plain data |
| `src/app/api/repo/route.ts`, `src/lib/repo/` | The backend endpoint and GitHub client; input parsing; file filtering |
| `src/lib/analysis/` | Ruff rule → monster table (`rules.ts`), diagnostics → findings (`normalize.ts`), good-code grading (`quality.ts`), the per-file code outline (`outline.ts`), the offline demo (`demo.ts`) |
| `src/lib/workspace/` | The Workshop's engine room: opens a repo (list → download → lint), keeps every file's text and the live linter, and handles check / forge (save) / revert / export. `contract.ts` is the interface |
| `public/lint-worker.js` | The Web Worker that runs Ruff |
| `src/lib/worldgen/` | Overworld and dungeon generators (deterministic, validated for reachability) |
| `src/lib/game/` | Save store, reducers, gacha, chest loot, Markdown checklist; the fight-then-fix rules (`progress.ts`, `seal.ts`, `forge.ts`); champions, monster looks and modifiers |
| `src/game/bridge.ts` | The contract between engine, UI and audio |
| `src/game/engine/`, `entities/`, `combat/`, `scenes/` | The canvas engine: loop, input, camera, collision, hero, weapons, monsters, overworld and dungeon scenes |
| `src/game/art/` | All pixel art, generated by code (no image files). The hero is drawn in layers: `character.ts` composes `characterFace/Hair/Outfits/Back/Hats.ts`; `fontGlyphs.ts` is the canvas bitmap font |
| `src/game/audio/` | All sound, synthesized with the Web Audio API (no audio files) |
| `src/components/app/`, `screens/`, `hud/`, `character/` | React shell: title, hero creator (`character/LookEditor.tsx` with its tabs, presets and undo), loading screen, HUD |
| `src/components/overlays/` | Chest reveal, Wishing Well, bag, codex, notice board, pause, wardrobe, victory |
| `src/components/loading/` | "Bug Catch", the loading mini-game |
| `src/components/workshop/` | The Workshop: the in-game code editor (CodeMirror 6), its explorer, bug cards, the "Saved!" summary and side panel; `quests/` holds the quest board |
| `src/app/dev/*` | Developer pages, available only with `npm run dev` (a deployed site answers 404): `/dev/art`, `/dev/art2`, `/dev/audio`, `/dev/engine`, `/dev/ui`, `/dev/overlays`, `/dev/loading`, `/dev/analysis` |
| `tests/` | Vitest unit tests |

### Tests and CI

```bash
npm test          # Vitest unit tests
npm run lint      # ESLint
npm run typecheck # tsc --noEmit
npm run check     # all three
```

`.github/workflows/ci.yml` runs lint, typecheck, the unit tests and a production build on every push.

The tests cover the logic that can be checked without a screen: repo-input parsing, file filtering, the GitHub client (mocked `fetch`), real Ruff runs on fixture files, the rule → monster mapping, the quality grade, world and dungeon generation (determinism and reachability, fuzzed over hundreds of fake repos), gacha odds and pity, chest loot, save-file sanitising, collision and attack geometry, monster behaviour helpers, and the loading mini-game's rules.

### Review and known issues

`REVIEW.md` is an independent review of the build by a second AI agent that wrote none of the code. It is kept exactly as the reviewer wrote it. It reviewed the first build only: the later rounds (more code in the gameplay, the Workshop, fight-then-fix) have not been reviewed by a second agent. Six of its nine findings were fixed afterwards (3, 4, 5, 6, 8, 9; see `prompt_log.md`). Three are still open:

1. **Finding 1** — several problems of the same kind on one line (for example `import os, sys, json`, all unused) become a single monster, and the others are missing from the Codex and the exported to-do list (`src/lib/analysis/normalize.ts`, `mergeSameProblem`).
2. **Finding 2** — the quality grade counts private (`_name`) functions as documented, so a file with no docstrings can be graded S and called "Well documented" (`src/lib/analysis/quality.ts`, `docstringCoverage`).
3. **Finding 7** — pasting a GitHub *folder* URL (`…/tree/main/src`) fails, because `main/src` is read as the branch name (`src/lib/repo/parseRepoInput.ts`).

### Deploying (GitHub Pages)

Every push to `main` runs `.github/workflows/pages.yml`, which builds a static copy of the game and publishes it to the `gh-pages` branch, served at https://agongster.github.io/project3/.

GitHub Pages only serves files, so this build has no `/api/repo` and no `GITHUB_TOKEN`: the player's browser asks the GitHub API itself. Each visitor therefore gets their own 60 requests per hour (about 20 new repos), and no secret exists anywhere in the deployed site. The two switches are explained in `src/lib/hosting.ts`.

### Deploying (Vercel)

1. Import the GitHub repo in Vercel (framework preset: Next.js; no other settings needed).
2. Add the `GITHUB_TOKEN` environment variable (the site works without it, but all visitors then share 60 GitHub requests per hour).
3. Deploy. The build runs `scripts/copy-ruff.mjs` automatically.

### Credits

- [Ruff](https://github.com/astral-sh/ruff) by Astral (MIT) — the linter, used through its official WebAssembly build.
- Fonts: Nunito for text and numbers, Press Start 2P for large titles (both SIL Open Font License), loaded through `next/font`. The type scale is documented at the top of `src/app/globals.css`.
- All pixel art and all sound in the game are generated by code in this repository.
