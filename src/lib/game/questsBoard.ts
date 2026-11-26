/**
 * The quest board of one repo: which quests are posted, and how it refills.
 *
 * The board holds QUEST_BOARD_SIZE quests: up to four that name one place in
 * the code, picked so the kinds stay varied (the kind with the fewest quests
 * on the board goes next, files not already on the board first), and one
 * tidy-up chore that always exists, even in a spotless repo.
 *
 * `updateBoard` is called after every change: it takes completed quests off
 * (the caller pays them), drops quests whose target vanished, and refills
 * from the candidates that are not done yet. Being deterministic, the same
 * code and the same save always give the same board.
 */
import { hashString } from "@/lib/rng";
import type { RepoAnalysis, RepoProgress } from "@/lib/types";
import { MAX_DONE_QUESTS, MAX_RECENT_QUESTS, QUEST_BOARD_SIZE, TIDY_GOALS, questId, repoSeed } from "./quests";
import type { Quest } from "./quests";
import { checkQuest, describeCompleted, describeQuest, tidyMeasure, tidyRoom } from "./questsCheck";
import { SPECIFIC_KINDS, findCandidates, questableFiles } from "./questsFind";
import type { Candidates, SpecificKind, SpecificQuestSpec } from "./questsFind";
import type { QuestSpec, RepoQuests, TidyQuestSpec, TidyTask } from "./questsTypes";

/** Board slots for quests that name one place in the code; the last slot is the tidy-up chore's. */
const SPECIFIC_SLOTS = QUEST_BOARD_SIZE - 1;

/** Tidy-up chores take turns in this order (a chore the code can't offer right now is skipped). */
export const TIDY_ROTATION: readonly TidyTask[] = ["fixAny", "documentAny", "squash", "comment"];

/** A repo's board before anything is posted. */
export function emptyQuests(): RepoQuests {
  return { active: [], done: [], recent: [], tidyRounds: 0 };
}

// ───────────────────────── Tidy-up chores ─────────────────────────

/** The file a "leave a note" chore asks about: a repo-specific pick among files with room for comments. */
function noteFile(round: number, analysis: RepoAnalysis, progress: RepoProgress): string | null {
  const seed = repoSeed(analysis);
  const order = (path: string) => hashString(`${seed}:tidy:${round}:${path}`);
  const roomy = questableFiles(analysis)
    .map((file) => file.path)
    .filter((path) => tidyRoom("comment", path, analysis, progress) > 0)
    .sort((a, b) => order(a) - order(b));
  return roomy[0] ?? null;
}

/** One tidy-up chore of the given task, or null when the code has nothing left for it. */
function tidySpec(task: TidyTask, round: number, analysis: RepoAnalysis, progress: RepoProgress): TidyQuestSpec | null {
  const path = task === "comment" ? noteFile(round, analysis, progress) : (questableFiles(analysis)[0]?.path ?? null);
  if (path === null) return null;
  const room = tidyRoom(task, path, analysis, progress);
  const baseline = tidyMeasure(task, path, analysis, progress);
  if (room === 0 || baseline === null) return null;
  const spec: TidyQuestSpec = { kind: "tidy", id: "", path, task, round, baseline, goal: Math.min(TIDY_GOALS[task], room) };
  return { ...spec, id: questId(spec) };
}

/** The tidy-up chore for `round`: its turn in TIDY_ROTATION, or the next task that is possible. */
function nextTidyQuest(round: number, analysis: RepoAnalysis, progress: RepoProgress): TidyQuestSpec | null {
  for (let step = 0; step < TIDY_ROTATION.length; step++) {
    const task = TIDY_ROTATION[(round - 1 + step) % TIDY_ROTATION.length];
    const spec = tidySpec(task, round, analysis, progress);
    if (spec) return spec;
  }
  return null;
}

// ─────────────────────────── Filling ───────────────────────────

/**
 * The next specific quest to post: from the kind with the fewest quests on
 * the board (ties go by SPECIFIC_KINDS order), preferring a file the board
 * does not mention yet. Null when no kind has an unused candidate.
 */
function pickNext(board: readonly SpecificQuestSpec[], candidates: Candidates, done: ReadonlySet<string>): SpecificQuestSpec | null {
  const onBoard = new Set(board.map((quest) => quest.id));
  const usable = (kind: SpecificKind): SpecificQuestSpec[] => candidates[kind].filter((spec) => !done.has(spec.id) && !onBoard.has(spec.id));
  const count = (kind: SpecificKind) => board.filter((quest) => quest.kind === kind).length;
  // Array.prototype.sort is stable, so kinds with equal counts keep the SPECIFIC_KINDS order.
  const kinds = SPECIFIC_KINDS.filter((kind) => usable(kind).length > 0).sort((a, b) => count(a) - count(b));
  if (kinds.length === 0) return null;
  const options = usable(kinds[0]);
  const usedPaths = new Set(board.map((quest) => quest.path));
  return options.find((spec) => !usedPaths.has(spec.path)) ?? options[0];
}

/** Adds specific quests until their slots are full, then makes sure the tidy-up chore is there (always last). */
function fillBoard(quests: RepoQuests, analysis: RepoAnalysis, progress: RepoProgress): RepoQuests {
  const specific = quests.active.filter((quest) => quest.kind !== "tidy");
  let tidy = quests.active.find((quest) => quest.kind === "tidy") ?? null;
  let tidyRounds = quests.tidyRounds;

  if (specific.length < SPECIFIC_SLOTS) {
    // Only look for candidates when a slot is empty: this runs after every change, even in big repos.
    const candidates = findCandidates(analysis);
    const done = new Set(quests.done);
    let next = pickNext(specific, candidates, done);
    while (next) {
      specific.push(next);
      next = specific.length < SPECIFIC_SLOTS ? pickNext(specific, candidates, done) : null;
    }
  }
  if (!tidy) {
    tidy = nextTidyQuest(tidyRounds + 1, analysis, progress);
    if (tidy) tidyRounds = tidy.round;
  }

  const active = tidy ? [...specific, tidy] : specific;
  const unchanged = active.length === quests.active.length && active.every((quest, i) => quest === quests.active[i]);
  return unchanged ? quests : { ...quests, active, tidyRounds };
}

// ─────────────────────────── Updating ───────────────────────────

export interface BoardUpdate {
  /** The new board (the very same object when nothing changed). */
  quests: RepoQuests;
  /** Quests that were completed just now, in board order (the caller pays them). */
  completed: QuestSpec[];
}

/**
 * Checks every posted quest against the code: completed ones move to `done`
 * and `recent`, vanished ones are dropped without a word, and the board is
 * refilled. With no board yet (`quests` undefined) it posts the first one.
 */
export function updateBoard(quests: RepoQuests | undefined, analysis: RepoAnalysis, progress: RepoProgress): BoardUpdate {
  const current = quests ?? emptyQuests();
  const checked = current.active.map((spec) => ({ spec, state: checkQuest(spec, analysis, progress).state }));
  const completed = checked.filter((entry) => entry.state === "done").map((entry) => entry.spec);
  const kept = checked.filter((entry) => entry.state === "open").map((entry) => entry.spec);

  const settled: RepoQuests =
    kept.length === current.active.length
      ? current
      : {
          ...current,
          active: kept,
          done: [...current.done, ...completed.map((spec) => spec.id)].slice(-MAX_DONE_QUESTS),
          recent: [...current.recent, ...completed].slice(-MAX_RECENT_QUESTS),
        };
  return { quests: fillBoard(settled, analysis, progress), completed };
}

// ───────────────────────────── Viewing ─────────────────────────────

export interface BoardView {
  /** The posted quests with their live progress (a quest whose target just vanished is left out). */
  active: Quest[];
  /** The last few completed quests, newest last. */
  recent: Quest[];
}

/**
 * What the quest panel shows for a repo, from its progress in the save
 * (`getProgress(save, key)`). Reads only: before the game has posted a board
 * (see `settleQuests`), it shows the board that would be posted for this
 * code, which is exactly the one that will be.
 */
export function questBoard(progress: RepoProgress, analysis: RepoAnalysis): BoardView {
  const quests = progress.quests ?? updateBoard(undefined, analysis, progress).quests;
  const active = quests.active
    .map((spec) => ({ spec, check: checkQuest(spec, analysis, progress) }))
    .filter((entry) => entry.check.state !== "gone")
    .map((entry) => describeQuest(entry.spec, entry.check));
  return { active, recent: quests.recent.map(describeCompleted) };
}
