"use client";

/**
 * A treasure chest: the reward for well-kept code (a clean file) or for
 * purifying a dungeon. The emotional core of "good code = rewards".
 *
 * Stages:  sealed ──Space──► opening ──(burst)──► loot
 *   sealed   the chest wobbles; its glow hints at what's inside
 *   opening  chestOpen sound, flash of light, the lid flies open
 *   loot     item card with rarity effects, coins counting up, and
 *            "Why this code earned it" (the file's quality highlights)
 * Space/Enter moves to the next stage and finally closes.
 *
 * SAFETY: the loot is rolled once, when the overlay opens, and saved
 * immediately (before any animation), so closing early can neither lose the
 * reward nor open the same chest twice.
 */
import { useEffect, useRef, useState } from "react";
import { KeyCap, Modal, PixelButton } from "@/components/ui/kit";
import { equipItem, openChest } from "@/lib/game";
import type { ChestLoot as Loot } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import { ChestLoot } from "./parts/chest/ChestLoot";
import { ChestSealed } from "./parts/chest/ChestSealed";
import { prepareChest } from "./parts/chest/chestSetup";
import { GradeBadge } from "./parts/GradeBadge";
import { PANEL_MEDIUM } from "./parts/panelSizes";
import { isConfirmKey, useCountUp, useKeyDown, useReady, useTimeout } from "./parts/hooks";
import { charmSwapText } from "./parts/itemText";
import { playCoinTick, REVEAL_SFX } from "./parts/sounds";
import type { OverlayContext, OverlayProps } from "./types";

type Stage = "sealed" | "opening" | "loot";

/** Length of the burst between opening the lid and showing the loot. */
const OPENING_MS = 900;
const COIN_COUNT_MS = 1100;
/** Ignore Space/Enter briefly, so the key that opened the chest in the world doesn't also skip a stage. */
const INPUT_GRACE_MS = 350;
/** The loot stays up at least this long before Space/Enter can close it, so mashing can't skip the payoff. */
const LOOT_MIN_MS = 900;

export default function ChestOverlay({ request, ctx }: OverlayProps<"chest">) {
  // Rolled exactly once. (Nothing is saved here: React may run this twice in dev mode and keep one.)
  const [chest] = useState(() => prepareChest(request, ctx.analysis, ctx.save.get(), ctx.repoKey, Math.random));

  // Save the loot right away. The ref guards against React's dev-mode double effects;
  // `openChest` itself also ignores a second opening of the same path.
  const committed = useRef(false);
  useEffect(() => {
    if (chest.status !== "ready" || committed.current) return;
    committed.current = true;
    ctx.save.set((save) => openChest(save, ctx.repoKey, chest.loot, request.path));
  }, [chest, ctx.save, ctx.repoKey, request.path]);

  if (chest.status === "ready") return <ChestReveal loot={chest.loot} request={request} ctx={ctx} />;
  return <ChestNote opened={chest.status === "opened"} onClose={ctx.close} />;
}

interface ChestRevealProps {
  loot: Loot;
  request: OverlayProps<"chest">["request"];
  ctx: OverlayContext;
}

function ChestReveal({ loot, request, ctx }: ChestRevealProps) {
  const [stage, setStage] = useState<Stage>("sealed");
  const [equipped, setEquipped] = useState(false);
  const [lootSettled, setLootSettled] = useState(false);
  const ready = useReady(INPUT_GRACE_MS);
  const wornCharms = useStore(ctx.save, (save) => save.equipped.charms);
  const clean = request.source === "clean-file";

  const coins = useCountUp(loot.coins, {
    durationMs: COIN_COUNT_MS,
    running: stage === "loot",
    onTick: (progress) => playCoinTick(ctx.audio, progress),
  });

  function open() {
    ctx.audio.sfx("chestOpen");
    setStage("opening");
  }

  function reveal() {
    ctx.audio.sfx(REVEAL_SFX[loot.rarity ?? "common"]);
    setStage("loot");
  }
  useTimeout(reveal, OPENING_MS, stage === "opening");
  useTimeout(() => setLootSettled(true), LOOT_MIN_MS, stage === "loot");

  function equipNow() {
    if (!loot.item) return;
    const id = loot.item.id;
    ctx.save.set((save) => equipItem(save, id));
    ctx.audio.sfx("equip");
    setEquipped(true);
  }

  useKeyDown((event) => {
    if (!isConfirmKey(event)) return;
    event.preventDefault();
    if (stage === "sealed") open();
    else if (stage === "opening") reveal();
    else if (!coins.done) coins.finish();
    else if (lootSettled) ctx.close();
  }, ready);

  const canEquip = loot.item !== null && loot.isNew;
  const swapNote = loot.item?.slot === "charm" && !equipped ? charmSwapText(wornCharms, loot.item.id) : null;

  return (
    <Modal label="Treasure chest" onClose={ctx.close} className={PANEL_MEDIUM}>
      <header className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-title text-base leading-snug">{clean ? "You found well-kept code!" : "Dungeon purified!"}</h2>
          {/* Once open, clean files explain the reward here ("Grade S code! An epic reward for …"). */}
          <p className="truncate font-bold opacity-75">{stage === "loot" && clean ? loot.headline : request.path}</p>
        </div>
        {loot.grade && <GradeBadge grade={loot.grade} size="md" withWord />}
      </header>

      <div className="min-h-0 flex-1">
        {stage === "loot" ? (
          <ChestLoot loot={loot} coins={coins.value} clean={clean} />
        ) : (
          <ChestSealed opening={stage === "opening"} rarity={loot.rarity} onOpen={open} />
        )}
      </div>

      {stage === "loot" && (
        <footer className="anim-fade-in flex flex-wrap items-center justify-end gap-2">
          {swapNote && <p className="mr-auto max-w-sm text-sm">{swapNote}</p>}
          {canEquip && (
            <PixelButton tone="sky" onClick={equipNow} disabled={equipped}>
              {equipped ? "Equipped!" : "Equip now"}
            </PixelButton>
          )}
          <PixelButton tone="gold" onClick={ctx.close}>
            Awesome! <KeyCap>Space</KeyCap>
          </PixelButton>
        </footer>
      )}
    </Modal>
  );
}

/** Shown instead of a reveal when the chest is already open (or its file is unknown). */
function ChestNote({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  useKeyDown((event) => {
    if (isConfirmKey(event)) {
      event.preventDefault();
      onClose();
    }
  });
  return (
    <Modal label="Treasure chest" onClose={onClose} className="flex max-w-md flex-col items-center gap-4 p-6 text-center">
      <h2 className="font-title text-sm leading-relaxed">{opened ? "Already looted!" : "Hmm… nothing here."}</h2>
      <p>
        {opened
          ? "You already opened this chest. Every file has exactly one, so go find another!"
          : "This chest seems to have wandered off. Try another building!"}
      </p>
      <PixelButton tone="gold" onClick={onClose}>
        OK
      </PixelButton>
    </Modal>
  );
}
