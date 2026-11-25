"use client";

/**
 * Small news toasts down the right side, under the minimap. Newest at the
 * bottom, at most four, each gone after ~3 s (see feed.ts).
 */
import { monsterSprite } from "@/game/art/monsters";
import { uiSprite } from "@/game/art/ui";
import { SpriteView } from "@/components/ui/kit";
import { MONSTERS } from "@/lib/game/catalog";
import { useStore } from "@/lib/game/useStore";
import type { Feed, Toast, ToastIcon } from "./feed";
import { HUD_FX } from "./fx";
import { ap } from "./units";

/** Leaves room for the engine's ~52 px tall minimap in the top-right corner. */
const STACK_TOP = 60;
const STACK_WIDTH = 104;
/** Toast icons are drawn about this many art pixels tall. */
const ICON_ART_PX = 16;

const TONE_EDGE: Record<Toast["tone"], string> = {
  good: "var(--color-leaf)",
  info: "var(--color-sky)",
  warn: "var(--color-gold)",
};

function IconView({ icon, scale }: { icon: ToastIcon; scale: number }) {
  if (icon.type === "monster") {
    // Bosses are 32 px; shrink them so every icon is about the same size.
    const size = MONSTERS[icon.kind].size;
    const iconScale = Math.max(1, Math.floor((scale * ICON_ART_PX) / size));
    return <SpriteView sprite={monsterSprite(icon.kind, 0)} scale={iconScale} />;
  }
  return <SpriteView sprite={uiSprite(icon.type === "coin" ? "coinBig" : "star")} scale={scale} />;
}

function ToastCard({ toast, scale }: { toast: Toast; scale: number }) {
  return (
    <div
      className={`flex items-center bg-cream text-ink ${toast.leaving ? HUD_FX.fadeOut : HUD_FX.toastIn}`}
      style={{ gap: ap(2), padding: `${ap(2)} ${ap(3)}`, boxShadow: `inset ${ap(2)} 0 0 0 ${TONE_EDGE[toast.tone]}, 0 ${ap(1)} 0 0 #2b1b3d, 0 ${ap(-1)} 0 0 #2b1b3d, ${ap(-1)} 0 0 0 #2b1b3d, ${ap(1)} 0 0 0 #2b1b3d` }}
    >
      {toast.icon && (
        <span className="flex shrink-0 items-center justify-center" style={{ width: ap(ICON_ART_PX), minHeight: ap(ICON_ART_PX), marginLeft: ap(1) }}>
          <IconView icon={toast.icon} scale={scale} />
        </span>
      )}
      <span className="min-w-0 flex-1 leading-tight" style={{ fontSize: "0.85em" }}>
        <span className="block font-bold">{toast.text}</span>
        {toast.detail && <span className="block text-ink-soft">{toast.detail}</span>}
      </span>
      {toast.coins !== undefined && toast.coins > 0 && <span className="shrink-0 font-bold text-wood-deep">+{toast.coins}</span>}
    </div>
  );
}

export function ToastStack({ feed, scale }: { feed: Feed; scale: number }) {
  const toasts = useStore(feed.store, (s) => s.toasts);
  return (
    <div className="absolute flex flex-col" style={{ top: ap(STACK_TOP), right: ap(4), width: ap(STACK_WIDTH), gap: ap(2) }} aria-live="polite">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} scale={scale} />
      ))}
    </div>
  );
}
