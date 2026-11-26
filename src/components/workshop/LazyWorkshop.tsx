"use client";

/**
 * Loads the Workshop on demand. The game's bundle only holds this file; the
 * Workshop's components and the editor library are two separate downloads
 * that start together the moment the Workshop is first shown (or earlier,
 * with `preloadWorkshop`, e.g. when the player hovers the button).
 *
 * If the download fails (offline, a deploy in between), the player gets a
 * message with "Try again" and "Back to the world" instead of a broken game.
 */
import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import { PixelButton } from "@/components/ui/kit";
import { loadEditorKit } from "./editor/loadKit";
import { useKeysStayHere } from "./hooks/useKeysStayHere";
import type { WorkshopProps } from "./types";

type WorkshopModule = typeof import("./Workshop");

let bodyPromise: Promise<WorkshopModule> | null = null;

/** Downloads the Workshop's components once; a failed download can be tried again. */
function loadBody(): Promise<WorkshopModule> {
  if (!bodyPromise) {
    bodyPromise = import("./Workshop").catch((error: unknown) => {
      bodyPromise = null;
      throw error;
    });
  }
  return bodyPromise;
}

/** Starts downloading the Workshop and the editor without showing anything. */
export function preloadWorkshop(): void {
  void loadBody().catch(() => undefined);
  void loadEditorKit().catch(() => undefined);
}

/** A fresh lazy component (React remembers a failed one forever, so each retry needs a new one). */
function lazyBody() {
  return lazy(() => {
    void loadEditorKit().catch(() => undefined);
    return loadBody();
  });
}

/** Full-window message while the Workshop downloads (or if it can't). */
function Curtain({ children }: { children: ReactNode }) {
  useKeysStayHere();
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-night p-6 text-center text-cream" role="status">
      {children}
    </div>
  );
}

interface CatcherProps {
  onRetry: () => void;
  onClose: () => void;
  children: ReactNode;
}

/** Catches a failed download of the Workshop (error boundaries must be classes). */
class DownloadCatcher extends Component<CatcherProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Curtain>
        <p>The Workshop could not be downloaded. Check your connection.</p>
        <div className="flex gap-2">
          <PixelButton tone="gold" onClick={this.props.onRetry} autoFocus>
            Try again
          </PixelButton>
          <PixelButton tone="rose" onClick={this.props.onClose}>
            Back to the world
          </PixelButton>
        </div>
      </Curtain>
    );
  }
}

export function Workshop(props: WorkshopProps) {
  const [attempt, setAttempt] = useState(0);
  const [Body, setBody] = useState(lazyBody);

  function retry() {
    setBody(lazyBody);
    setAttempt((n) => n + 1);
  }

  return (
    <DownloadCatcher key={attempt} onRetry={retry} onClose={props.onClose}>
      <Suspense
        fallback={
          <Curtain>
            <p className="font-title text-sm">Opening the Workshop…</p>
          </Curtain>
        }
      >
        <Body {...props} />
      </Suspense>
    </DownloadCatcher>
  );
}
