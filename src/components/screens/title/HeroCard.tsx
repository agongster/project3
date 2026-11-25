"use client";

/** The saved hero on the title screen: walking in place, name, level, and an "Edit hero" button. */
import { uiSprite } from "@/game/art/ui";
import { CharacterPreview } from "@/components/character/CharacterPreview";
import { PixelButton, PixelPanel, SpriteView } from "@/components/ui/kit";
import type { AudioApi } from "@/game/bridge";
import { levelForXp } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import type { SaveData, Store } from "@/lib/types";

interface Props {
  save: Store<SaveData>;
  audio: AudioApi;
  onEdit: () => void;
}

export function HeroCard({ save, audio, onEdit }: Props) {
  const look = useStore(save, (s) => s.look);
  const hatId = useStore(save, (s) => s.equipped.hat);
  const xp = useStore(save, (s) => s.xp);
  const coins = useStore(save, (s) => s.coins);
  const created = useStore(save, (s) => s.created);
  const level = levelForXp(xp);

  return (
    <PixelPanel className="flex items-center gap-4 px-4 py-2">
      <div className="flex h-[104px] w-[72px] shrink-0 items-end justify-center bg-cream-deep pb-1">
        <CharacterPreview look={look} hatId={hatId} scale={3} turning />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate font-title text-[14px] leading-relaxed">{look.name}</p>
        <p className="text-[15px] font-semibold text-ink-soft">
          {created ? `Lv ${level.level} · ${level.title}` : "A brand-new adventurer"}
        </p>
        <p className="flex items-center gap-1.5 text-[15px] font-semibold text-wood-deep">
          <SpriteView sprite={uiSprite("coin")} scale={2} />
          {coins} coins
        </p>
        <div>
          <PixelButton
            tone="sky"
            small
            onClick={() => {
              audio.sfx("uiSelect");
              onEdit();
            }}
          >
            ✎ Edit hero
          </PixelButton>
        </div>
      </div>
    </PixelPanel>
  );
}
