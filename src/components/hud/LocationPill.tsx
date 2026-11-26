"use client";

/**
 * Top-centre of the HUD: where you are (region name, or the dungeon's file
 * path), how many bugs are left in this dungeon, and the boss's health bar
 * while a boss is alive.
 */
import { uiSprite } from "@/game/art/ui";
import type { HudState } from "@/game/bridge";
import { useStore } from "@/lib/game/useStore";
import type { Store } from "@/lib/types";
import { ArtSprite } from "./ArtSprite";
import { HudBar } from "./HudBar";
import { ap, BOLD_OUTLINE, PLATE_STYLE } from "./units";

/** Boss bar width in art pixels (about a third of the screen). */
const BOSS_BAR_WIDTH = 130;

export function LocationPill({ hud }: { hud: Store<HudState> }) {
  const location = useStore(hud, (h) => h.location);
  const dungeon = useStore(hud, (h) => h.dungeon);
  const boss = useStore(hud, (h) => h.boss);

  return (
    <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ top: ap(4), gap: ap(3), maxWidth: ap(200) }}>
      <div className="flex max-w-full items-center whitespace-nowrap font-bold" style={{ ...PLATE_STYLE, gap: ap(3) }}>
        <span className="truncate text-cream">{location}</span>
        {dungeon && (
          <span className={`flex items-center ${dungeon.remaining === 0 ? "text-leaf" : "text-rose"}`} style={{ gap: ap(1) }}>
            <ArtSprite sprite={uiSprite(dungeon.remaining === 0 ? "checkmark" : "skull")} />
            {dungeon.remaining === 0 ? "all clear!" : `bugs left ${dungeon.remaining} / ${dungeon.total}`}
          </span>
        )}
      </div>

      {boss && (
        <div key={boss.name} className="anim-pop flex flex-col items-center" style={{ gap: ap(1) }}>
          <span className="font-title text-berry" style={{ fontSize: ap(5), textShadow: BOLD_OUTLINE }}>
            {boss.name}
          </span>
          <HudBar value={boss.hp / boss.maxHp} color="var(--color-berry)" width={BOSS_BAR_WIDTH} height={6} label={`${boss.name} health`} />
        </div>
      )}
    </div>
  );
}
