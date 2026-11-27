/**
 * The bug card's two scrolls, as plain actions the Workshop hands the card:
 *
 *   fix scroll    Ruff's own fix (the celebrated path: a real fix pays)
 *   seal scroll   `# noqa: CODE` on the finding's line (src/lib/game/seal.ts):
 *                 always there, so nobody gets stuck; sealed bugs pay nothing
 *
 * Each one is applied as ONE undoable edit, and only when the editor still
 * shows exactly the text the live check looked at (positions in an older
 * check could point at the wrong place). Forging is what makes either count.
 */
import type { AudioApi } from "@/game/bridge";
import { CANT_SEAL_STALE, planSeal, type SealPlan } from "@/lib/game/seal";
import type { LiveFinding, QuickFix } from "@/lib/workspace/contract";
import type { EditorHandle } from "../editor/types";
import type { CheckedText } from "./useLiveCheck";

interface ScrollOptions {
  editor: EditorHandle | null;
  /** The file in front. */
  active: string | null;
  /** The newest live check of that file, or null. */
  live: CheckedText | null;
  audio: AudioApi;
  /** A line for the status bar. */
  say: (text: string, tone?: "good" | "warn") => void;
  /** Closes the bug card and gives the keyboard back to the editor. */
  done: () => void;
}

const STALE_TEXT = "The code just changed: wait a moment for a fresh check";

export function scrollActions({ editor, active, live, audio, say, done }: ScrollOptions) {
  /** The editor and the live check agree on the text: edits from the check can be applied. */
  const fresh = (): EditorHandle | null => (editor && active !== null && live && editor.textOf(active) === live.text ? editor : null);

  function applyFix(fix: QuickFix): void {
    const ready = fresh();
    if (!ready) return say(STALE_TEXT, "warn");
    ready.applyEdits(fix.edits);
    done();
    audio.sfx("equip");
    say("Auto-fix applied. Save to make it real");
  }

  function sealPlan(target: LiveFinding): SealPlan {
    return live ? planSeal(live.text, target.finding, target.range.line) : { ok: false, reason: CANT_SEAL_STALE };
  }

  function applySeal(target: LiveFinding): void {
    const ready = fresh();
    if (!ready) return say(STALE_TEXT, "warn");
    const plan = sealPlan(target);
    if (!plan.ok) return say(plan.reason, "warn");
    ready.applyEdits([plan.edit]);
    done();
    audio.sfx("uiSelect");
    say("Ignored with # noqa. Save to make it count (no reward: a real fix pays)");
  }

  return { applyFix, sealPlan, applySeal };
}
