"use client";

/**
 * "Which repo should become a world?" The box checks the text as the player
 * types (with the same parser the server uses) but never blocks typing.
 * Example and recent chips fill the box and go straight away; the big green
 * button plays the offline Demo Kingdom.
 */
import { useRef, useState, type FormEvent } from "react";
import type { AudioApi } from "@/game/bridge";
import { PixelButton } from "@/components/ui/kit";
import { BAD_INPUT_MESSAGE, parseRepoInput } from "@/lib/repo/parseRepoInput";
import { targetLabel, type WorldTarget } from "@/components/app/flow";
import { EXAMPLE_REPOS } from "./recentRepos";

/** A quick left-right wiggle (same feel as the kit's `anim-shake`), replayable on every bad submit. */
const SHAKE_KEYFRAMES: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-6px)" },
  { transform: "translateX(6px)" },
  { transform: "translateX(-3px)" },
  { transform: "translateX(0)" },
];
const SHAKE_OPTIONS: KeyframeAnimationOptions = { duration: 260, easing: "steps(5)" };

interface Props {
  audio: AudioApi;
  recent: readonly WorldTarget[];
  onSubmit: (target: WorldTarget) => void;
  onDemo: () => void;
}

export function RepoForm({ audio, recent, onSubmit, onDemo }: Props) {
  const [text, setText] = useState("");
  // Show "try owner/repo" for an empty box only after the player tried to submit it.
  const [triedEmpty, setTriedEmpty] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const parsed = text.trim() === "" ? null : parseRepoInput(text);
  const problem = parsed && !parsed.ok ? parsed.message : triedEmpty && parsed === null ? BAD_INPUT_MESSAGE : null;

  /** Validates `value` and starts the world, or shakes the box and explains what's wrong. */
  const go = (value: string) => {
    const result = parseRepoInput(value);
    if (!result.ok) {
      audio.sfx("error");
      setTriedEmpty(value.trim() === "");
      rowRef.current?.animate(SHAKE_KEYFRAMES, SHAKE_OPTIONS);
      return;
    }
    audio.sfx("uiSelect");
    onSubmit({ kind: "repo", owner: result.owner, repo: result.repo, ref: result.ref });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    go(text);
  };

  const pickChip = (value: string) => {
    setText(value);
    go(value);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
      <label htmlFor="repo-input" className="font-title text-pixel-sm leading-relaxed text-ink">
        Paste a Python repo
      </label>
      <div ref={rowRef} className="flex flex-wrap items-center gap-1">
        <input
          id="repo-input"
          className="px-input min-w-0 flex-1 text-[18px]"
          placeholder="owner/repo or https://github.com/owner/repo"
          value={text}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-invalid={problem !== null}
          aria-describedby="repo-problem"
          onChange={(event) => {
            setText(event.target.value);
            setTriedEmpty(false);
          }}
        />
        <PixelButton type="submit" tone="gold">
          Generate world ▶
        </PixelButton>
      </div>
      <p id="repo-problem" className="min-h-[1.3em] text-[15px] font-semibold text-berry" aria-live="polite">
        {problem}
      </p>

      <ChipRow label="Try" values={EXAMPLE_REPOS} onPick={pickChip} />
      {recent.length > 0 && <ChipRow label="Recent" values={recent.map(targetLabel)} onPick={pickChip} />}

      <div className="my-1 flex items-center gap-3 text-ink-soft" aria-hidden>
        <span className="h-1 flex-1 bg-cream-deep" />
        or
        <span className="h-1 flex-1 bg-cream-deep" />
      </div>
      <PixelButton
        className="text-[20px]"
        onClick={() => {
          audio.sfx("uiSelect");
          onDemo();
        }}
      >
        ✦ Play the Demo Kingdom ✦
      </PixelButton>
      <p className="text-center text-sm text-ink-soft">A tiny bakery & potion shop full of bugs. Works offline.</p>
    </form>
  );
}

function ChipRow({ label, values, onPick }: { label: string; values: readonly string[]; onPick: (value: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1">
      <span className="mr-1 text-[15px] font-bold text-ink-soft">{label}:</span>
      {values.map((value) => (
        <PixelButton key={value} tone="cream" small onClick={() => onPick(value)}>
          {value}
        </PixelButton>
      ))}
    </div>
  );
}
