"use client";

/**
 * /dev/ui — every piece of the app shell on its own, with fake data, so each
 * can be screenshotted without playing:
 *
 *   ?view=title      (&error=rate_limited|no_python|not_found|network)
 *   ?view=creator
 *   ?view=loading    (runs the real demo analysis, then shows the ready card)
 *   ?view=hud        (&state=busy for everything at once, &dark=1 for a dungeon-dark backdrop)
 *   ?view=dialog     (&speaker=Sign for an object portrait)
 *   ?view=pause
 *   ?view=wardrobe
 *
 * Uses an in-memory save, so nothing here changes your real progress.
 * The HUD view exposes `window.__dev = { services, feed }` for scripted pokes.
 */
import { use, useState } from "react";
import { CreatorScreen } from "@/components/screens/CreatorScreen";
import { LoadingScreen } from "@/components/screens/LoadingScreen";
import { TitleScreen } from "@/components/screens/TitleScreen";
import { DEMO_TARGET, type FlowError } from "@/components/app/flow";
import { useIsClient } from "@/components/app/useIsClient";
import type { OverlayRequest } from "@/components/overlays/types";
import { BUSY_HUD, HudView } from "./HudView";
import { OverlayView } from "./OverlayView";
import { createDevServices } from "./fakeServices";

type Params = Record<string, string | string[] | undefined>;

const VIEWS = ["title", "creator", "loading", "hud", "dialog", "pause", "wardrobe"] as const;

const SAMPLE_ERRORS: Record<string, FlowError> = {
  rate_limited: { code: "rate_limited", message: "GitHub's rate limit was reached. It resets in a few minutes.", retryAfterSec: 95, target: { kind: "repo", owner: "psf", repo: "requests" } },
  no_python: { code: "no_python", message: "That repo has no Python files we can read.", target: { kind: "repo", owner: "torvalds", repo: "linux" } },
  not_found: { code: "not_found", message: "Couldn't find that repo. Is it public, and spelled right?", target: { kind: "repo", owner: "nobody", repo: "nothing" } },
  network: { code: "network", message: "Couldn't reach GitHub. Check your connection and try again.", target: { kind: "repo", owner: "pallets", repo: "flask" } },
};

function dialogRequest(speaker: string): OverlayRequest {
  return {
    kind: "dialog",
    speaker,
    lines: [
      "Welcome to the Crumbleton Bakery & Potion Shop! Mind the dust bunnies, they multiply when nobody cleans up the imports.",
      "Rumour has it the cauldron file doesn't even parse. Something royal and glitchy lives down there…",
      "Bring me good news, hero!",
    ],
  };
}

function one(params: Params, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default function DevUiPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = use(searchParams);
  const isClient = useIsClient();
  const view = one(params, "view") ?? "title";

  if (!isClient) return <main className="h-full bg-night" />;
  if (!(VIEWS as readonly string[]).includes(view)) {
    return (
      <main className="flex h-full flex-col gap-2 p-8">
        {VIEWS.map((name) => (
          <a key={name} href={`?view=${name}`} className="text-gold underline">
            {name}
          </a>
        ))}
      </main>
    );
  }
  return <DevView view={view} params={params} />;
}

function DevView({ view, params }: { view: string; params: Params }) {
  const busy = one(params, "state") === "busy";
  const [services] = useState(() => {
    const fresh = createDevServices();
    if (view === "hud" && busy) fresh.hud.set((h) => ({ ...h, ...BUSY_HUD }));
    return fresh;
  });
  const log = (what: string) => () => console.info(`[dev/ui] ${what}`);

  switch (view) {
    case "creator":
      return <CreatorScreen services={services} next={DEMO_TARGET} onDone={log("done")} onBack={log("back")} />;
    case "loading":
      return <LoadingScreen target={DEMO_TARGET} services={services} onEnter={log("enter")} onError={log("error")} onCancel={log("cancel")} />;
    case "hud":
      return <HudView services={services} busy={busy} dark={one(params, "dark") === "1"} />;
    case "dialog":
      return <OverlayView services={services} request={dialogRequest(one(params, "speaker") ?? "Juno")} />;
    case "pause":
      return <OverlayView services={services} request={{ kind: "pause" }} />;
    case "wardrobe":
      return <OverlayView services={services} request={{ kind: "wardrobe" }} />;
    default:
      return (
        <TitleScreen
          services={services}
          error={SAMPLE_ERRORS[one(params, "error") ?? ""] ?? null}
          onStart={log("start")}
          onEditHero={log("edit hero")}
          onDismissError={log("dismiss error")}
        />
      );
  }
}
