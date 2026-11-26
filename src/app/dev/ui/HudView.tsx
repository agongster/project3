"use client";

/**
 * /dev/ui?view=hud — the HUD over a still backdrop, with buttons that poke
 * the HUD store and the feed the way the engine would. `?state=busy` starts
 * with a boss, a prompt, a combo, toasts and a banner all at once;
 * `?dark=1` darkens the backdrop like a dungeon.
 */
import { useEffect, useState } from "react";
import type { HudState } from "@/game/bridge";
import { Hud } from "@/components/hud/Hud";
import { createFeed, type Feed } from "@/components/hud/feed";
import { PixelButton } from "@/components/ui/kit";
import { addCoins } from "@/lib/game";
import type { AppServices } from "@/components/app/services";
import { DevStage } from "./DevStage";
import { devHealth } from "./fakeServices";

const CONTROLS_HEIGHT = 96;

export const BUSY_HUD: Partial<HudState> = {
  scene: "dungeon",
  hp: 7,
  maxHp: 12,
  combo: 7,
  location: "bakery/orders.py",
  prompt: "Open the treasure of oven.py (grade S)",
  dungeon: { path: "bakery/orders.py", remaining: 2, total: 5 },
  boss: { name: "Eval Serpent", hp: 15, maxHp: 26 },
  dashReady: 0.6,
};

function fillBusyFeed(feed: Feed): void {
  feed.toast({ text: "Unused import squashed!", detail: "F401", tone: "good", icon: { type: "monster", kind: "dustBunny" }, coins: 3 });
  feed.toast({ text: "Bare except squashed!", detail: "E722", tone: "good", icon: { type: "monster", kind: "swallowToad" }, coins: 11 });
  feed.toast({ text: "Half the land is purified!", tone: "good", icon: { type: "star" }, coins: 50 });
  feed.banner({ title: "DUNGEON PURIFIED!", subtitle: "orders.py", tone: "purify" });
}

declare global {
  interface Window {
    __dev?: { services: AppServices; feed: Feed };
  }
}

export function HudView({ services, busy, dark }: { services: AppServices; busy: boolean; dark: boolean }) {
  const { hud, save } = services;
  // Filled once, when the view first appears (the busy HUD values come from the page, see BUSY_HUD).
  const [feed] = useState(() => {
    const fresh = createFeed();
    if (busy) fillBusyFeed(fresh);
    return fresh;
  });
  const [healthRatio, setHealthRatio] = useState(0.4);
  const theme = save.get().theme;

  useEffect(() => {
    window.__dev = { services, feed };
  }, [services, feed]);

  const poke = (patch: (h: HudState) => Partial<HudState>) => hud.set((h) => ({ ...h, ...patch(h) }));

  return (
    <div className="flex h-full flex-col">
      <DevStage theme={theme} dark={dark} reserveBottom={CONTROLS_HEIGHT}>
        {(scale) => <Hud hud={hud} save={save} feed={feed} health={devHealth(healthRatio)} scale={scale} interactive onOpen={(r) => feed.toast({ text: `open ${r.kind}`, tone: "info" })} onWorkshop={() => feed.toast({ text: "open the Workshop", tone: "info" })} />}
      </DevStage>
      <div className="flex flex-wrap content-start items-center justify-center bg-night-soft px-2 py-1" style={{ height: CONTROLS_HEIGHT }}>
        <PixelButton small tone="berry" onClick={() => poke((h) => ({ hp: Math.max(0, h.hp - 1) }))}>Hurt</PixelButton>
        <PixelButton small onClick={() => poke((h) => ({ hp: Math.min(h.maxHp, h.hp + 2) }))}>Heal</PixelButton>
        <PixelButton small tone="gold" onClick={() => save.set((s) => addCoins(s, 25))}>+25 coins</PixelButton>
        <PixelButton small tone="gold" onClick={() => save.set((s) => ({ ...s, xp: s.xp + 30 }))}>+30 XP</PixelButton>
        <PixelButton small tone="sky" onClick={() => poke((h) => ({ combo: h.combo + 1 }))}>Combo +1</PixelButton>
        <PixelButton small tone="cream" onClick={() => poke(() => ({ combo: 0 }))}>Combo reset</PixelButton>
        <PixelButton small tone="sky" onClick={() => poke((h) => ({ dashReady: h.dashReady >= 1 ? 0 : Math.min(1, h.dashReady + 0.25) }))}>Dash</PixelButton>
        <PixelButton small tone="grape" onClick={() => poke((h) => ({ prompt: h.prompt ? null : "Enter utils/parse.py — 3 bugs lurking" }))}>Prompt</PixelButton>
        <PixelButton small tone="grape" onClick={() => poke((h) => (h.dungeon ? { dungeon: null, scene: "overworld", location: "Town Square" } : { dungeon: BUSY_HUD.dungeon ?? null, scene: "dungeon" }))}>Dungeon</PixelButton>
        <PixelButton small tone="berry" onClick={() => poke((h) => ({ boss: h.boss ? null : BUSY_HUD.boss ?? null }))}>Boss</PixelButton>
        <PixelButton small tone="cream" onClick={() => feed.toast({ text: "TODO comment squashed!", detail: "FIX002", tone: "good", icon: { type: "monster", kind: "todoMite" }, coins: 4 })}>Toast</PixelButton>
        <PixelButton small tone="cream" onClick={() => feed.banner({ title: "LEVEL UP!", subtitle: "Level 3 — Junior Debugger", tone: "level" })}>Banner</PixelButton>
        <PixelButton small tone="cream" onClick={() => setHealthRatio((r) => (r >= 1 ? 0 : Math.min(1, r + 0.25)))}>Health</PixelButton>
      </div>
    </div>
  );
}
