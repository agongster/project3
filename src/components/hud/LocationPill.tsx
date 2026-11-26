"use client";

/**
 * Top-centre of the HUD: where you are (region name, or the dungeon's file
 * path), how many monsters are left to fight and lines left to fix in this
 * dungeon (dungeonCounter.ts), and the boss's health bar while a boss is alive.
 */
import { uiSprite } from "@/game/art/ui";
import type { HudState } from "@/game/bridge";
import { useStore } from "@/lib/game/useStore";
import type { Store } from "@/lib/types";
import { ArtSprite } from "./ArtSprite";
import { dungeonCounter, type DungeonCounterTone } from "./dungeonCounter";
import { HudBar } from "./HudBar";
import { ap, BOLD_OUTLINE, HUD_TITLE_FONT_SIZE, PLATE_STYLE } from "./units";

/** Boss bar width in art pixels (about a third of the screen). */
const BOSS_BAR_WIDTH = 130;
/** The counter's colour: rose while monsters fight, a glowing line's cyan once quiet, green once purified. */
const COUNTER_CLASS: Record<DungeonCounterTone, string> = { fighting: "text-rose", quiet: "text-[#9ff4ff]", purified: "text-leaf" };

export function LocationPill({ hud }: { hud: Store<HudState> }) {
  const location = useStore(hud, (h) => h.location);
  const dungeon = useStore(hud, (h) => h.dungeon);
  const boss = useStore(hud, (h) => h.boss);
  const counter = dungeon ? dungeonCounter(dungeon) : null;

  return (
    <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ top: ap(4), gap: ap(3), maxWidth: ap(200) }}>
      <div className="flex max-w-full items-center whitespace-nowrap font-bold" style={{ ...PLATE_STYLE, gap: ap(3) }}>
        <span className="truncate text-cream">{location}</span>
        {counter && (
          <span className={`flex items-center ${COUNTER_CLASS[counter.tone]}`} style={{ gap: ap(1) }}>
            <ArtSprite sprite={uiSprite(counter.icon)} />
            {counter.text}
          </span>
        )}
      </div>

      {boss && (
        <div key={boss.name} className="anim-pop flex flex-col items-center" style={{ gap: ap(1) }}>
          <span className="font-title text-center text-berry" style={{ fontSize: HUD_TITLE_FONT_SIZE, textShadow: BOLD_OUTLINE }}>
            {boss.name}
          </span>
          <HudBar value={boss.hp / boss.maxHp} color="var(--color-berry)" width={BOSS_BAR_WIDTH} height={6} label={`${boss.name} health`} />
        </div>
      )}
    </div>
  );
}
