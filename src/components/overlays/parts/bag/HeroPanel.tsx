"use client";

/**
 * The bag's left column: the hero walking on the spot in their current hat
 * (with their pet), level and XP, the equipped loadout, and the stats all
 * that gear adds up to.
 */
import { MAX_CHARMS, getItem } from "@/lib/game/catalog";
import { levelForXp, playerStats } from "@/lib/game";
import type { SaveData } from "@/lib/types";
import { PixelBar } from "@/components/ui/kit";
import { useTicker } from "../hooks";
import { ItemIcon } from "../ItemIcon";
import { playerStatLines } from "../itemText";
import { PixelSprite } from "../PixelSprite";
import { heroSprite, petFrame } from "../sprites";
import { StatList } from "./StatList";

const WALK_FRAME_MS = 160;
const HERO_SCALE = 3;
const PET_SCALE = 2;
const LOADOUT_ICON_SCALE = 2;
/** Same size as a tight 2× item tile (16 × 2 + 2 × 2). */
const EMPTY_SLOT_PX = 36;

export function HeroPanel({ save }: { save: SaveData }) {
  const step = useTicker(WALK_FRAME_MS);
  const { look, equipped, xp } = save;
  const level = levelForXp(xp);
  // Every slot in a fixed order, so empty ones show as dashed boxes.
  const charmSlots = Array.from({ length: MAX_CHARMS }, (_, index) => equipped.charms[index] ?? null);
  const loadout: { label: string; id: string | null }[] = [
    { label: "Weapon", id: equipped.weapon },
    { label: "Hat", id: equipped.hat },
    { label: "Pet", id: equipped.pet },
    { label: "Trail", id: equipped.trail },
    ...charmSlots.map((id) => ({ label: "Charm", id })),
  ];

  return (
    <div className="px-scroll flex min-h-0 flex-col gap-3 pr-1">
      <div className="px-panel dark flex h-28 shrink-0 items-end justify-center gap-1 pb-2">
        <PixelSprite sprite={heroSprite(look, equipped.hat, "down", step)} scale={HERO_SCALE} label={`${look.name}, your hero`} />
        {equipped.pet && <PixelSprite sprite={petFrame(equipped.pet, step)} scale={PET_SCALE} label="Your pet" />}
      </div>

      <div>
        <p className="font-bold leading-tight">{look.name}</p>
        <p className="text-sm">
          Level {level.level} · {level.title}
        </p>
        <PixelBar value={level.ratio} color="var(--color-sky)" className="mt-2 h-3" label="Experience" />
        <p className="mt-1 text-sm opacity-75">{level.isMax ? "Max level!" : `${level.intoLevel} / ${level.forNext} XP to the next level`}</p>
      </div>

      <div>
        <h3 className="mb-2 font-label text-xs">Wearing</h3>
        <ul className="flex flex-wrap gap-3 p-1">
          {loadout.map((slot, index) => {
            const item = slot.id ? getItem(slot.id) : undefined;
            return (
              <li key={index} title={item ? `${slot.label}: ${item.name}` : `No ${slot.label.toLowerCase()}`}>
                {item ? (
                  <ItemIcon item={item} scale={LOADOUT_ICON_SCALE} tight />
                ) : (
                  <span className="block border-2 border-dashed border-ink/40" style={{ width: EMPTY_SLOT_PX, height: EMPTY_SLOT_PX }} />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="mb-1 font-label text-xs">Stats</h3>
        <StatList lines={playerStatLines(playerStats(save))} />
      </div>
    </div>
  );
}
