"use client";

/**
 * Boss subdued! A trophy card for the finding the boss embodied (it now
 * waits on its glowing line until its code is fixed): the
 * monster, the real code it came from, and how to fix it in real life.
 * "Fix it for real" opens the Workshop on that line; "View in Codex" swaps
 * to the codex with this finding selected.
 */
import type { CSSProperties } from "react";
import { KeyCap, Modal, PixelButton } from "@/components/ui/kit";
import { MONSTERS } from "@/lib/game/catalog";
import { lookOf } from "@/lib/game/monsterLooks";
import { CodeSnippet } from "./parts/CodeSnippet";
import { FX } from "./parts/fx";
import { isConfirmKey, useKeyDown, useReady, useTicker } from "./parts/hooks";
import { MonsterIcon } from "./parts/MonsterIcon";
import { SEVERITY_INFO } from "./parts/monsterText";
import { TraitLine } from "./parts/codex/TraitLine";
import { WorkshopLink } from "./parts/WorkshopLink";
import type { OverlayProps } from "./types";

const MONSTER_BOX = 128;
const FRAME_MS = 200;
/** Ignore Space/Enter briefly, so the attack button mashed to finish the boss doesn't skip the card. */
const INPUT_GRACE_MS = 700;

export default function BugCardOverlay({ request, ctx }: OverlayProps<"bugCard">) {
  const { finding } = request;
  const monster = MONSTERS[finding.monster];
  const frame = useTicker(FRAME_MS);
  const ready = useReady(INPUT_GRACE_MS);

  useKeyDown((event) => {
    if (isConfirmKey(event)) {
      event.preventDefault();
      ctx.close();
    }
  }, ready);

  function viewInCodex() {
    ctx.audio.sfx("uiSelect");
    ctx.open({ kind: "codex", focusFindingId: finding.id });
  }

  return (
    <Modal label="Boss subdued" onClose={ctx.close} className="flex h-full max-h-[560px] w-full max-w-[880px] flex-col overflow-hidden p-0">
      <div className="bg-berry px-4 py-2 text-center text-cream">
        <h2 className="font-title text-pixel-md">BOSS SUBDUED!</h2>
        <p className="text-sm font-bold">Fix its line in the code to defeat it for good.</p>
      </div>

      <div className="px-scroll grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)] gap-5 p-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="relative flex h-44 w-44 items-center justify-center">
            <span className={FX.rays} style={{ "--fx-color": "var(--color-gold)", "--rays-size": "220px" } as CSSProperties} />
            <MonsterIcon kind={finding.monster} box={MONSTER_BOX} frame={frame} look={lookOf(finding)} className="relative" />
          </div>
          <p className="text-lg font-extrabold leading-tight">{monster.name}</p>
          <p className="text-sm italic">{monster.blurb}</p>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <p className="text-sm font-bold uppercase" style={{ color: SEVERITY_INFO[finding.severity].color }}>
              It was really…
            </p>
            <h3 className="text-xl font-bold leading-tight">
              {finding.title} <code className="font-mono text-base">{finding.code}</code>
            </h3>
            <p className="truncate text-sm opacity-75">
              {finding.path}:{finding.line}
            </p>
          </div>
          <section>
            <h4 className="text-xs font-bold uppercase opacity-70">Ruff says</h4>
            <p>{finding.message}</p>
          </section>
          <TraitLine finding={finding} />
          <section className="bg-leaf/25 p-2">
            <h4 className="text-xs font-bold uppercase">How to fix it in real life</h4>
            <p>{finding.tip}</p>
          </section>
          <CodeSnippet lines={finding.snippet} />
        </div>
      </div>

      <footer className="flex items-center justify-end gap-2 px-4 pb-4">
        <WorkshopLink className="mr-auto" onClick={() => ctx.openWorkshop({ path: finding.path, line: finding.line })} />
        <PixelButton tone="sky" onClick={viewInCodex}>
          View in Codex
        </PixelButton>
        <PixelButton tone="gold" onClick={ctx.close}>
          Onward! <KeyCap>Space</KeyCap>
        </PixelButton>
      </footer>
    </Modal>
  );
}
