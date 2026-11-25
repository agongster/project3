"use client";

/**
 * Top-left of the HUD: hearts, coins, level + XP, and the Repo Health bar
 * (the share of the repo's bugs squashed so far).
 */
import type { HudState } from "@/game/bridge";
import { levelForXp, type RepoHealth } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import type { SaveData, Store } from "@/lib/types";
import { CoinCounter } from "./CoinCounter";
import { Hearts } from "./Hearts";
import { HudBar } from "./HudBar";
import { ap, PLATE_STYLE, TEXT_OUTLINE } from "./units";

/** Width of the XP and health bars, in art pixels. */
const BAR_WIDTH = 64;

/** Repo Health goes from berry red through gold to leaf green. */
function healthColor(ratio: number): string {
  if (ratio >= 0.75) return "var(--color-leaf)";
  if (ratio >= 0.4) return "var(--color-gold)";
  return "var(--color-rose)";
}

function LevelRow({ save }: { save: Store<SaveData> }) {
  const xp = useStore(save, (s) => s.xp);
  const level = levelForXp(xp);
  return (
    <div className="flex items-center" style={{ gap: ap(2) }}>
      <span className="font-title bg-grape text-cream" style={{ fontSize: ap(4), padding: `${ap(1)} ${ap(2)}`, textShadow: TEXT_OUTLINE }}>
        Lv{level.level}
      </span>
      <div className="flex flex-col" style={{ gap: ap(1) }}>
        <span className="font-bold" style={{ fontSize: "0.8em", textShadow: TEXT_OUTLINE }}>
          {level.title}
        </span>
        <HudBar value={level.ratio} color="var(--color-grape)" width={BAR_WIDTH - 18} height={3} label="Experience" />
      </div>
    </div>
  );
}

function HealthRow({ health }: { health: RepoHealth }) {
  const percent = Math.round(health.ratio * 100);
  return (
    <div className="flex flex-col" style={{ gap: ap(1) }}>
      <span className="flex justify-between font-bold" style={{ fontSize: "0.8em", textShadow: TEXT_OUTLINE }}>
        <span>Repo Health</span>
        <span style={{ color: healthColor(health.ratio) }}>{percent}%</span>
      </span>
      <HudBar value={health.ratio} color={healthColor(health.ratio)} width={BAR_WIDTH} height={4} label="Repo health" />
    </div>
  );
}

interface Props {
  hud: Store<HudState>;
  save: Store<SaveData>;
  health: RepoHealth;
}

export function StatusPanel({ hud, save, health }: Props) {
  return (
    <div className="absolute flex flex-col" style={{ left: ap(4), top: ap(4), gap: ap(2) }}>
      <div className="flex flex-col" style={{ ...PLATE_STYLE, gap: ap(2) }}>
        <Hearts hud={hud} />
        <CoinCounter save={save} />
        <LevelRow save={save} />
        <HealthRow health={health} />
      </div>
    </div>
  );
}
