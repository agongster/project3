"use client";

/**
 * /dev/ui?view=dialog|pause|wardrobe — one of the shell's overlays over the
 * still backdrop and an idle HUD, with a fake OverlayContext. Closing the
 * overlay leaves a "Reopen" button so it can be looked at again.
 */
import { useState } from "react";
import { Hud } from "@/components/hud/Hud";
import { createFeed } from "@/components/hud/feed";
import { OverlayHost } from "@/components/overlays/OverlayHost";
import type { OverlayContext, OverlayRequest } from "@/components/overlays/types";
import { PixelButton } from "@/components/ui/kit";
import type { AppServices } from "@/components/app/services";
import { repoKey } from "@/game/bridge";
import { useStore } from "@/lib/game/useStore";
import { DevStage } from "./DevStage";
import { createDevAnalysis, devHealth } from "./fakeServices";

interface Props {
  services: AppServices;
  request: OverlayRequest;
}

export function OverlayView({ services, request: initial }: Props) {
  const { save, audio, hud } = services;
  const theme = useStore(save, (s) => s.theme);
  const [request, setRequest] = useState<OverlayRequest | null>(initial);
  const [note, setNote] = useState("");
  const [feed] = useState(createFeed);
  const [analysis] = useState(createDevAnalysis);

  const ctx: OverlayContext = {
    analysis,
    repoKey: repoKey(analysis),
    save,
    audio,
    open: (next) => {
      setNote(`open(${next.kind})`);
      setRequest(next);
    },
    close: () => {
      setNote("close()");
      setRequest(null);
    },
    resolveFinisher: (_findingId, correct) => setNote(`resolveFinisher(${correct})`),
    spareFinisher: () => setNote("spareFinisher()"),
    openWorkshop: (target) => setNote(`openWorkshop(${target?.path ?? "here"})`),
    bounties: [],
    exitToTitle: () => {
      setNote("exitToTitle()");
      setRequest(null);
    },
  };

  return (
    <div className="relative h-full">
      <DevStage theme={theme}>
        {(scale) => (
          <>
            <Hud hud={hud} save={save} feed={feed} health={devHealth(0.4)} scale={scale} interactive={request === null} onOpen={setRequest} onWorkshop={() => setNote("openWorkshop()")} />
            <OverlayHost request={request} ctx={ctx} />
          </>
        )}
      </DevStage>
      {request === null && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 bg-night-soft px-3 py-1">
          <span className="text-cream">{note}</span>
          <PixelButton small onClick={() => setRequest(initial)}>
            Reopen
          </PixelButton>
        </div>
      )}
    </div>
  );
}
