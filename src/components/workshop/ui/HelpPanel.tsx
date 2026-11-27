"use client";

/**
 * "How this works": the four ideas of the Workshop in a few lines. Shown in
 * the editor area the first time the Workshop opens with no file, and from
 * the "?" button any time.
 */
import { PixelButton } from "@/components/ui/kit";
import { ShortcutKeys } from "./bits";

const STEPS = [
  { title: "Type freely", text: "Edit any file. Monsters appear in the gutter as you type, but nothing in the world changes yet." },
  { title: "Save to make it real", text: "Save stores the file and checks it again. Bugs you fixed are defeated for good; new ones just join the dungeon." },
  { title: "Fix to finish them", text: "A monster beaten in a fight is only subdued: fixing its line finishes it and pays a reward. Auto-fix on a bug card can even do it for you." },
  { title: "Stuck? Ignore it", text: "Every bug card also has Ignore this bug: it adds # noqa so the checker skips that line. The monster leaves, but ignoring pays nothing." },
];

export function HelpPanel({ onDismiss, dismissLabel }: { onDismiss: () => void; dismissLabel: string }) {
  return (
    <div className="ws-help">
      <h2 className="font-title ws-help-title">Welcome to the Workshop</h2>
      <ol className="ws-help-steps">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <span className="ws-help-num font-title">{i + 1}</span>
            <span>
              <strong>{step.title}.</strong> {step.text}
            </span>
          </li>
        ))}
      </ol>
      <p className="ws-help-keys">
        <span>
          <ShortcutKeys command="forge" /> Save
        </span>
        <span>
          <ShortcutKeys command="quickOpen" /> Open a file
        </span>
        <span>
          <ShortcutKeys command="bugCard" /> Bug card
        </span>
        <span>
          <ShortcutKeys command="nextRegion" /> Next panel
        </span>
        <span>
          <ShortcutKeys command="back" /> Back to the world
        </span>
      </p>
      <p className="ws-faint">Your edits stay in this browser. Download them as a patch or a zip from the Changes tab.</p>
      <PixelButton tone="gold" onClick={onDismiss} data-autofocus>
        {dismissLabel}
      </PixelButton>
    </div>
  );
}
