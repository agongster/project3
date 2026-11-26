/**
 * One-time lessons: the few moments the game explains a rule the first time
 * it matters, with its ordinary banner and toasts, and never again in this
 * save. Each lesson taught is remembered by its id in `SaveData.taught`.
 *
 *   subdued   the first monster beaten in a fight: "it is only subdued — stand
 *             on its glowing line, press E, fix the code and Forge"
 *
 * The words themselves live with the UI that shows them
 * (src/components/app/gameEvents.ts); this file only keeps the bookkeeping.
 */
import type { SaveData } from "@/lib/types";

export type LessonId = "subdued";

/** Every lesson the game knows (a loaded save keeps only these). */
export const LESSON_IDS: readonly LessonId[] = ["subdued"];

/** True once `lesson` has been taught in this save. */
export function wasTaught(save: SaveData, lesson: LessonId): boolean {
  return (save.taught ?? []).includes(lesson);
}

/** The save with `lesson` remembered as taught (the same save when it already was). */
export function markTaught(save: SaveData, lesson: LessonId): SaveData {
  if (wasTaught(save, lesson)) return save;
  return { ...save, taught: [...(save.taught ?? []), lesson] };
}

/** Known lesson ids only, without duplicates; undefined when there are none (so older saves come back unchanged). */
export function sanitizeTaught(raw: unknown): LessonId[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const taught = LESSON_IDS.filter((lesson) => raw.includes(lesson));
  return taught.length === 0 ? undefined : taught;
}
