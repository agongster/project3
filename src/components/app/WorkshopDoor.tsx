"use client";

/**
 * Stepping into the Workshop feels like stepping through a door of the
 * game: the world irises shut around the middle of the screen before the
 * editor appears, and irises open again on the way out, while the world
 * (already running again) shows what the edit changed.
 *
 * It calls `onDone` once the wipe is over (a timer, so it also finishes
 * when animations are off).
 */
import { useEffect, useEffectEvent, type CSSProperties } from "react";
import "./workshopDoor.css";

/** How long the iris takes, each way. */
export const DOOR_MS = 320;

interface Props {
  /** "in": the curtain closes (going in); "out": it opens (coming back). */
  way: "in" | "out";
  onDone: () => void;
}

export function WorkshopDoor({ way, onDone }: Props) {
  const done = useEffectEvent(onDone);
  useEffect(() => {
    const timer = window.setTimeout(() => done(), DOOR_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className={`workshop-door workshop-door-${way}`} style={{ "--door-ms": `${DOOR_MS}ms` } as CSSProperties} aria-hidden="true">
      <div className="workshop-door-hole" />
    </div>
  );
}
