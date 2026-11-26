"use client";

/**
 * The well's transparency panel: the real odds, how close the pity
 * guarantees are, and how much of the collection the player has found.
 * (Players trust a gacha that shows its maths.)
 */
import type { ReactNode } from "react";
import { PixelBar } from "@/components/ui/kit";
import { EPIC_PITY, LEGENDARY_PITY, gachaOdds, pityStatus } from "@/lib/game";
import { RARITY_INFO } from "@/lib/game/catalog";
import type { SaveData } from "@/lib/types";
import { collectionProgress } from "./gachaData";

const ODDS = gachaOdds();

interface OddsPanelProps {
  gacha: SaveData["gacha"];
  owned: readonly string[];
}

export function OddsPanel({ gacha, owned }: OddsPanelProps) {
  const pity = pityStatus(gacha);
  const collection = collectionProgress(owned);

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section>
        <Heading>Odds per wish</Heading>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs uppercase opacity-70">
              <th className="font-bold">Rarity</th>
              <th className="text-right font-bold">Chance</th>
              <th className="text-right font-bold">If duplicate</th>
            </tr>
          </thead>
          <tbody>
            {ODDS.map((row) => (
              <tr key={row.rarity} data-rarity={row.rarity}>
                <td className="flex items-center gap-2 font-bold">
                  <span aria-hidden="true" className="h-3 w-3 bg-[var(--rarity)] shadow-[0_0_0_2px_var(--color-ink)]" />
                  {row.label}
                </td>
                <td className="text-right font-extrabold">{row.percent}%</td>
                <td className="text-right font-bold">+{row.dupeRefund} coins</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-1">
        <Heading>Guarantees</Heading>
        <p>
          Epic or better within <strong>{pity.epicIn}</strong> wish{pity.epicIn === 1 ? "" : "es"}
        </p>
        <PixelBar value={1 - (pity.epicIn - 1) / EPIC_PITY} color="var(--color-epic)" className="h-2" label="Epic guarantee progress" />
        <p className="mt-2">
          Legendary within <strong>{pity.legendaryIn}</strong> wish{pity.legendaryIn === 1 ? "" : "es"}
        </p>
        <PixelBar value={1 - (pity.legendaryIn - 1) / LEGENDARY_PITY} color="var(--color-legendary)" className="h-2" label="Legendary guarantee progress" />
      </section>

      <section className="flex flex-col gap-1">
        <Heading>
          Collection {collection.owned} / {collection.total}
        </Heading>
        {collection.byRarity.map((row) => (
          <div key={row.rarity} className="grid grid-cols-[80px_minmax(0,1fr)_44px] items-center gap-2">
            <span className="ink-outline font-bold" style={{ color: RARITY_INFO[row.rarity].color }}>
              {RARITY_INFO[row.rarity].label}
            </span>
            <PixelBar value={row.owned / row.total} color={RARITY_INFO[row.rarity].color} className="h-2" />
            <span className="text-right font-bold">
              {row.owned}/{row.total}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="mb-1 font-label text-xs leading-normal">{children}</h3>;
}
