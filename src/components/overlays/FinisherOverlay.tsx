"use client";

/**
 * The PICK-THE-FIX FINISHER: a dazed elite or boss, the real code it came
 * from, and "Which fix really squashes this bug?" with three answers: the
 * finding's own fix tip and two tips of other rules (src/lib/game/finisher.ts).
 * Keys 1 / 2 / 3 or the mouse pick.
 *
 *   right → "CRITICAL FIX!" and confetti; the engine pays double coins and XP
 *   wrong → no penalty: the real fix lights up and the bug goes down anyway
 *   closed without a pick (Esc) → an ordinary defeat
 *
 * However it closes, it first tells the engine the result
 * (`ctx.resolveFinisher`), then resumes the game (`ctx.close`).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { KeyCap, Modal, PixelButton, cx } from "@/components/ui/kit";
import { MONSTERS } from "@/lib/game/catalog";
import { CRITICAL_FIX_COIN_MULTIPLIER, criticalFixBonusXp, finisherOptions } from "@/lib/game/finisher";
import { CodeSnippet } from "./parts/CodeSnippet";
import { TraitLine } from "./parts/codex/TraitLine";
import { Confetti } from "./parts/Confetti";
import { FinisherChoice, type ChoiceState } from "./parts/FinisherChoice";
import { FX } from "./parts/fx";
import { isConfirmKey, useKeyDown, useReady, useTicker, useTimeout } from "./parts/hooks";
import { MonsterIcon } from "./parts/MonsterIcon";
import { PixelSprite } from "./parts/PixelSprite";
import { uiIcon } from "./parts/sprites";
import type { OverlayProps } from "./types";

const MONSTER_BOX = 64;
const FRAME_MS = 200;
/** Picks are ignored this long after opening, so a click-attack still in progress can't answer by accident. */
const INPUT_GRACE_MS = 400;
/** After answering, Space / Enter wait this long, so a mashed key doesn't skip the result. */
const RESULT_GRACE_MS = 600;
/** Key i + 1 picks answer i (top row or number pad). */
const OPTION_KEYS = ["1", "2", "3"];
const GOLD_RAYS = { "--fx-color": "var(--color-gold)", "--rays-size": "120px" } as CSSProperties;
/** Dizzy stars twinkling around the monster while the question is open: [left, top, delay]. */
const STARS: readonly [string, string, string][] = [
  ["8%", "6%", "0s"],
  ["74%", "0%", "0.5s"],
  ["82%", "58%", "1s"],
];

type Phase = "asking" | "right" | "wrong";

const HEADER: Record<Phase, { title: string; className: string }> = {
  asking: { title: "FINISH IT WITH A FIX!", className: "bg-berry text-cream" },
  right: { title: "CRITICAL FIX!", className: "bg-gold text-ink" },
  wrong: { title: "IT GOES DOWN ANYWAY!", className: "bg-sky text-ink" },
};

export default function FinisherOverlay({ request, ctx }: OverlayProps<"finisher">) {
  const { finding } = request;
  const monster = MONSTERS[finding.monster];
  const options = useMemo(() => finisherOptions(finding), [finding]);
  const [picked, setPicked] = useState<number | null>(null);
  const [canDismiss, setCanDismiss] = useState(false);
  const ready = useReady(INPUT_GRACE_MS);
  const frame = useTicker(FRAME_MS);
  useTimeout(() => setCanDismiss(true), RESULT_GRACE_MS, picked !== null);
  const phase: Phase = picked === null ? "asking" : options[picked].correct ? "right" : "wrong";
  const bonus = `×${CRITICAL_FIX_COIN_MULTIPLIER} coins and +${criticalFixBonusXp(finding.monster)} XP`;

  // A sting when the question pops up (the ref stops React's dev-mode double effect from playing it twice).
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    ctx.audio.sfx("crit", { pitch: 1.2 });
  }, [ctx.audio]);

  function pick(index: number) {
    if (!ready || picked !== null) return;
    setPicked(index);
    ctx.audio.sfx(options[index].correct ? "revealEpic" : "talk");
  }

  function finish() {
    ctx.resolveFinisher(finding.id, phase === "right");
    ctx.close();
  }

  useKeyDown((event) => {
    const index = OPTION_KEYS.indexOf(event.key);
    if (phase === "asking" && index >= 0) {
      event.preventDefault();
      pick(index);
    } else if (phase !== "asking" && canDismiss && isConfirmKey(event)) {
      event.preventDefault();
      finish();
    }
  });

  function choiceState(index: number): ChoiceState {
    if (picked === null) return "open";
    if (options[index].correct) return "right";
    return index === picked ? "picked-wrong" : "other";
  }

  const verdict: Record<Phase, string> = {
    asking: `Pick the real fix for a critical hit: ${bonus}!`,
    right: `That's exactly how you'd fix it in the real code. Bonus: ${bonus}!`,
    wrong: `No harm done! The green one is the real fix. The ${monster.name} is beaten all the same.`,
  };

  return (
    <Modal label="Finish it with a fix" onClose={finish} className="flex w-full max-w-[920px] flex-col overflow-hidden p-0">
      {phase === "right" && <Confetti />}
      <header className={cx("flex items-center gap-3 px-4 py-2", HEADER[phase].className)}>
        <div className="relative flex shrink-0 items-center justify-center" style={{ width: MONSTER_BOX, height: MONSTER_BOX }}>
          {phase === "right" && <span aria-hidden="true" className={FX.rays} style={GOLD_RAYS} />}
          <MonsterIcon kind={finding.monster} box={MONSTER_BOX} frame={frame} className={cx("relative", phase === "asking" && FX.wobble)} />
          {phase === "asking" &&
            STARS.map(([left, top, delay]) => (
              <PixelSprite key={left} sprite={uiIcon("star")} scale={2} className={FX.twinkle} style={{ left, top, "--delay": delay } as CSSProperties} />
            ))}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-title text-xl tracking-wider">{HEADER[phase].title}</h2>
          <p className="truncate text-sm font-bold">
            {monster.name} = {finding.title} <code className="font-mono">{finding.code}</code> · {finding.path}:{finding.line}
          </p>
        </div>
      </header>

      <div className="px-scroll grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 p-4">
        <section className="flex min-w-0 flex-col gap-2">
          <p>
            <span className="text-xs font-bold uppercase opacity-70">Ruff says </span>
            {finding.message}
          </p>
          <TraitLine finding={finding} className="text-sm" />
          <CodeSnippet lines={finding.snippet} />
        </section>
        <section className="flex min-w-0 flex-col gap-1">
          <h3 className="font-bold">Which fix really squashes this bug?</h3>
          <ol className="flex flex-col">
            {options.map((option, index) => (
              <li key={option.text}>
                <FinisherChoice keyLabel={OPTION_KEYS[index]} text={option.text} state={choiceState(index)} onPick={() => pick(index)} />
              </li>
            ))}
          </ol>
        </section>
      </div>

      <footer className="flex items-center gap-3 px-4 pb-4">
        <p className="min-w-0 flex-1 text-sm font-bold">{verdict[phase]}</p>
        {phase === "asking" ? (
          <PixelButton tone="cream" small onClick={finish}>
            Just squash it <KeyCap>Esc</KeyCap>
          </PixelButton>
        ) : (
          <PixelButton tone="gold" onClick={finish}>
            Squash it! <KeyCap>Space</KeyCap>
          </PixelButton>
        )}
      </footer>
    </Modal>
  );
}
