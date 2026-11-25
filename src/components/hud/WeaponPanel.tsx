"use client";

/**
 * Bottom-left of the HUD: the weapon in hand, the dash meter (fills up while
 * the dash recharges) and the combo counter above them.
 */
import { itemIcon } from "@/game/art/items";
import type { HudState } from "@/game/bridge";
import { getWeapon } from "@/lib/game/catalog";
import { useStore } from "@/lib/game/useStore";
import type { SaveData, Store } from "@/lib/types";
import { ArtSprite } from "./ArtSprite";
import { ComboCounter } from "./ComboCounter";
import { HudBar } from "./HudBar";
import { HUD_FX } from "./fx";
import { ap, PLATE_STYLE } from "./units";

const DASH_BAR_WIDTH = 40;

function DashMeter({ hud }: { hud: Store<HudState> }) {
  const ready = useStore(hud, (h) => h.dashReady);
  const full = ready >= 1;
  return (
    <div className="flex items-center" style={{ gap: ap(2), fontSize: "0.75em" }}>
      <span className={full ? "font-bold text-sky" : "text-cream/70"}>Dash</span>
      <HudBar value={ready} color={full ? "var(--color-sky)" : "#4f6f8f"} width={DASH_BAR_WIDTH} height={3} label="Dash recharge" className={full ? HUD_FX.readyPulse : undefined} />
    </div>
  );
}

interface Props {
  hud: Store<HudState>;
  save: Store<SaveData>;
}

export function WeaponPanel({ hud, save }: Props) {
  const weaponId = useStore(save, (s) => s.equipped.weapon);
  const weapon = getWeapon(weaponId);

  return (
    <div className="absolute flex flex-col items-start" style={{ left: ap(4), bottom: ap(4), gap: ap(2) }}>
      <ComboCounter hud={hud} />
      <div className="flex items-center" style={{ ...PLATE_STYLE, gap: ap(3) }}>
        {/* The icon sits in a little frame tinted with the weapon's rarity colour. */}
        <div data-rarity={weapon.rarity} style={{ padding: ap(1), background: "#3a3152", boxShadow: `0 0 0 ${ap(1)} var(--rarity)` }}>
          <ArtSprite sprite={itemIcon(weapon.id)} />
        </div>
        <div className="flex flex-col" style={{ gap: ap(1) }}>
          <span className="font-bold" data-rarity={weapon.rarity}>
            <span className="rarity-text">{weapon.name}</span>
          </span>
          <DashMeter hud={hud} />
        </div>
      </div>
    </div>
  );
}
