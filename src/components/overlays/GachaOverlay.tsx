"use client";

/**
 * The Wishing Well (gacha): toss coins in, get a random item back.
 *
 * Phases:  idle ──wish──► tossing ──► spinning ──► revealing ──► done
 *   tossing    a coin arcs into the well (splash)
 *   spinning   the well glows in the colour of the best item coming, and rumbles
 *   revealing  ten-wish cards turn over one by one (epic+ pause longer);
 *              a single wish goes straight to its big card
 * Space/Enter (or Esc, or "Skip") jumps to the results; on the results,
 * Esc closes the well.
 *
 * SAFETY: wishes are paid for and saved the moment the button is pressed,
 * before any animation, exactly like chests. All odds and pity rules live
 * in src/lib/game/gacha.ts.
 */
import { useState } from "react";
import { KeyCap, Modal, PixelButton, cx } from "@/components/ui/kit";
import { WISH_BUNDLE_SIZE, WISH_COST, WISH_TEN_COST, canAfford, wishMany } from "@/lib/game";
import type { WishResult } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import type { SaveData } from "@/lib/types";
import { bestRarity, isBigRarity, pullSummary } from "./parts/gacha/gachaData";
import { OddsPanel } from "./parts/gacha/OddsPanel";
import { WellScene } from "./parts/gacha/WellScene";
import type { WellMood } from "./parts/gacha/WellScene";
import { WishResults } from "./parts/gacha/WishResults";
import { isConfirmKey, useKeyDown, useTimeout } from "./parts/hooks";
import { PanelHeader } from "./parts/PanelHeader";
import { PANEL_LARGE } from "./parts/panelSizes";
import { PixelSprite } from "./parts/PixelSprite";
import { REVEAL_SFX } from "./parts/sounds";
import { uiIcon } from "./parts/sprites";
import type { OverlayProps } from "./types";

/** The odds panel's numbers from just before the wish, so it can't spoil the surprise mid-animation. */
type PanelSnapshot = Pick<SaveData, "gacha" | "owned">;

type Phase =
  | { name: "idle" }
  | { name: "tossing"; results: WishResult[]; before: PanelSnapshot }
  | { name: "spinning"; results: WishResult[]; before: PanelSnapshot }
  | { name: "revealing"; results: WishResult[]; shown: number }
  | { name: "done"; results: WishResult[] };

/** Matches the coin-arc animation in fx.css. */
const TOSS_MS = 650;
const SPIN_MS = 1300;
/** Time between two cards turning over… */
const FLIP_MS = 320;
/** …and the longer, dramatic pause after an epic or legendary. */
const BIG_FLIP_MS = 950;

type WishCount = 1 | typeof WISH_BUNDLE_SIZE;

export default function GachaOverlay({ ctx }: OverlayProps<"gacha">) {
  const { audio } = ctx;
  const coins = useStore(ctx.save, (save) => save.coins);
  const gacha = useStore(ctx.save, (save) => save.gacha);
  const owned = useStore(ctx.save, (save) => save.owned);
  const theme = useStore(ctx.save, (save) => save.theme);
  const affordOne = useStore(ctx.save, (save) => canAfford(save, 1));
  const affordTen = useStore(ctx.save, (save) => canAfford(save, WISH_BUNDLE_SIZE));
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [refused, setRefused] = useState<WishCount | null>(null);
  const [showHint, setShowHint] = useState(false);
  const busy = phase.name === "tossing" || phase.name === "spinning" || phase.name === "revealing";

  function makeWishes(count: WishCount) {
    const before = ctx.save.get();
    const outcome = wishMany(before, count, Math.random);
    if (!outcome) {
      audio.sfx("error");
      setRefused(count);
      setShowHint(true);
      return;
    }
    ctx.save.set(outcome.save); // paid and saved before the show starts
    audio.sfx("uiSelect");
    setPhase({ name: "tossing", results: outcome.results, before: { gacha: before.gacha, owned: before.owned } });
  }

  function finish(results: WishResult[]) {
    audio.sfx(REVEAL_SFX[bestRarity(results)]);
    setPhase({ name: "done", results });
  }

  // tossing → spinning → (single: done | ten: revealing card by card) → done
  useTimeout(
    () => {
      if (phase.name !== "tossing") return;
      audio.sfx("splash");
      audio.sfx("gachaSpin");
      setPhase({ ...phase, name: "spinning" });
    },
    TOSS_MS,
    phase.name === "tossing",
  );
  useTimeout(
    () => {
      if (phase.name !== "spinning") return;
      if (phase.results.length === 1) finish(phase.results);
      else setPhase({ name: "revealing", results: phase.results, shown: 0 });
    },
    SPIN_MS,
    phase.name === "spinning",
  );
  const lastShown = phase.name === "revealing" && phase.shown > 0 ? phase.results[phase.shown - 1] : null;
  useTimeout(
    () => {
      if (phase.name !== "revealing") return;
      const next = phase.shown + 1;
      audio.sfx(REVEAL_SFX[phase.results[phase.shown].rarity]);
      if (next >= phase.results.length) setPhase({ name: "done", results: phase.results });
      else setPhase({ ...phase, shown: next });
    },
    lastShown && isBigRarity(lastShown.rarity) ? BIG_FLIP_MS : FLIP_MS,
    phase.name === "revealing" ? phase.shown : null,
  );

  function skip() {
    if (phase.name === "tossing" || phase.name === "spinning" || phase.name === "revealing") finish(phase.results);
  }

  function backToWell() {
    audio.sfx("uiBack");
    setPhase({ name: "idle" });
  }

  // Space/Enter only skip the animation. On the results they do nothing, so mashing
  // through the reveal can't also throw the results away (the buttons take Tab + Enter).
  useKeyDown((event) => {
    if (!busy || !isConfirmKey(event)) return;
    event.preventDefault();
    skip();
  });

  const showingResults = phase.name === "revealing" || phase.name === "done";
  const results = phase.name === "idle" ? [] : phase.results;
  const mood: WellMood = phase.name === "tossing" || phase.name === "spinning" ? phase.name : "idle";
  const panel: PanelSnapshot = phase.name === "tossing" || phase.name === "spinning" ? phase.before : { gacha, owned };
  const wasSingle = results.length === 1;

  return (
    <Modal label="The Wishing Well" onClose={busy ? skip : ctx.close} className={PANEL_LARGE}>
      <PanelHeader
        title="The Wishing Well"
        subtitle="Toss in a coin and make a wish!"
        actions={<CoinBalance coins={coins} />}
        onClose={busy ? skip : ctx.close}
      />

      {showingResults ? (
        <div className="min-h-0 flex-1">
          <WishResults results={results} shown={phase.name === "done" ? results.length : phase.shown} />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_280px] gap-4">
          <div className="flex min-h-0 flex-col gap-2">
            <div className="min-h-0 flex-1">
              <WellScene theme={theme} mood={mood} glowRarity={results.length > 0 ? bestRarity(results) : null} />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <WishButton count={1} disabled={busy} shaking={refused === 1} onWish={makeWishes} onShakeEnd={() => setRefused(null)} />
              <WishButton count={WISH_BUNDLE_SIZE} disabled={busy} shaking={refused === WISH_BUNDLE_SIZE} onWish={makeWishes} onShakeEnd={() => setRefused(null)} />
            </div>
            <p className={cx("text-center text-sm font-bold text-berry", !showHint && "invisible")}>Squash bugs or whack bushes to earn coins!</p>
          </div>
          <div className="px-scroll min-h-0 pr-1">
            <OddsPanel gacha={panel.gacha} owned={panel.owned} />
          </div>
        </div>
      )}

      {showingResults && (
        <footer className="flex flex-wrap items-center justify-end gap-2">
          <p className="mr-auto font-bold">{phase.name === "done" ? pullSummary(results) : "The well is answering…"}</p>
          {phase.name === "revealing" && (
            <PixelButton tone="cream" onClick={skip}>
              Skip <KeyCap>Space</KeyCap>
            </PixelButton>
          )}
          {phase.name === "done" && (
            <>
              {(wasSingle ? affordOne : affordTen) ? (
                <PixelButton tone="gold" onClick={() => makeWishes(wasSingle ? 1 : WISH_BUNDLE_SIZE)}>
                  {wasSingle ? `Wish again · ${WISH_COST}` : `10 more · ${WISH_TEN_COST}`}
                </PixelButton>
              ) : affordOne ? (
                // Not enough for another ten, but a single wish is still possible.
                <PixelButton tone="gold" onClick={() => makeWishes(1)}>
                  {`One more wish · ${WISH_COST}`}
                </PixelButton>
              ) : (
                <p className="text-sm">Out of coins for now. Squash bugs to earn more!</p>
              )}
              <PixelButton tone="cream" onClick={backToWell}>
                Back to the well
              </PixelButton>
              <PixelButton tone="leaf" onClick={ctx.close}>
                Done
              </PixelButton>
            </>
          )}
        </footer>
      )}
    </Modal>
  );
}

function CoinBalance({ coins }: { coins: number }) {
  return (
    <p className="flex items-center gap-2 bg-ink px-3 py-1 text-gold" aria-label={`${coins} coins`}>
      <PixelSprite sprite={uiIcon("coin")} scale={2} />
      <span className="text-lg font-extrabold">{coins.toLocaleString()}</span>
    </p>
  );
}

interface WishButtonProps {
  count: WishCount;
  disabled: boolean;
  /** Plays the "can't afford" shake. */
  shaking: boolean;
  onWish: (count: WishCount) => void;
  onShakeEnd: () => void;
}

function WishButton({ count, disabled, shaking, onWish, onShakeEnd }: WishButtonProps) {
  const single = count === 1;
  return (
    <PixelButton
      tone={single ? "gold" : "grape"}
      disabled={disabled}
      className={shaking ? "anim-shake" : undefined}
      onAnimationEnd={onShakeEnd}
      onClick={() => onWish(count)}
    >
      {single ? "Make a wish" : "10 wishes"} · <PixelSprite sprite={uiIcon("coin")} scale={2} /> {single ? WISH_COST : WISH_TEN_COST}
    </PixelButton>
  );
}
