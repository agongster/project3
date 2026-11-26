"use client";

/**
 * Big celebration banners ("DUNGEON PURIFIED!", "LEVEL UP!"). They sit in
 * the upper middle of the screen, never over the hero in the centre, and
 * queue up if two arrive at once.
 */
import { useStore } from "@/lib/game/useStore";
import type { Feed } from "./feed";
import { HUD_FX } from "./fx";
import { ap, BOLD_OUTLINE, TEXT_OUTLINE } from "./units";

/** Big, but narrow enough to stay clear of the toast stack on the right. */
const BANNER_FONT_ART_PX = 9;

const TONE_COLORS = {
  purify: { title: "var(--color-leaf)", ribbon: "#2f6b3a" },
  level: { title: "var(--color-gold)", ribbon: "#5b3fa8" },
  forge: { title: "var(--color-sky)", ribbon: "#1f5f78" },
} as const;

export function BannerView({ feed }: { feed: Feed }) {
  const banner = useStore(feed.store, (s) => s.banners[0] ?? null);
  if (!banner) return null;
  const colors = TONE_COLORS[banner.tone];

  return (
    <div className="absolute inset-x-0 flex justify-center" style={{ top: ap(52) }} role="status">
      <div key={banner.id} className={`flex flex-col items-center ${HUD_FX.bannerIn}`} style={{ gap: ap(2) }}>
        <div
          className="font-title whitespace-nowrap"
          style={{ color: colors.title, fontSize: ap(BANNER_FONT_ART_PX), lineHeight: 1.2, textShadow: BOLD_OUTLINE }}
        >
          {banner.title}
        </div>
        {banner.subtitle && (
          <div className="font-bold text-cream" style={{ background: colors.ribbon, padding: `${ap(1)} ${ap(6)}`, textShadow: TEXT_OUTLINE }}>
            {banner.subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
