"use client";

/**
 * Shown instead of a blank page if a screen throws while it is being drawn
 * (Next.js wraps the app in an error boundary and renders this file).
 * The save lives in localStorage and is untouched, so the player can retry
 * or reload without losing anything.
 */
import { useEffect } from "react";
import { PixelButton, PixelPanel } from "@/components/ui/kit";

export default function ErrorScreen({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("Lintlands: a screen crashed while rendering.", error);
  }, [error]);

  return (
    <main className="flex h-full items-center justify-center p-6">
      <PixelPanel className="flex max-w-md flex-col items-center gap-4 p-6 text-center">
        <h1 className="font-title text-pixel-sm leading-relaxed text-berry">A wild bug appeared!</h1>
        <p>Something went wrong while drawing this screen. Your hero, coins and treasure are safe.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <PixelButton tone="gold" onClick={retry}>
            Try again
          </PixelButton>
          {/* A full reload on purpose: it restarts the app from the title screen with a clean slate. */}
          <PixelButton tone="cream" onClick={() => window.location.reload()}>
            Reload the game
          </PixelButton>
        </div>
      </PixelPanel>
    </main>
  );
}
