import { useEffect, useState } from "react";

/**
 * A counter that goes up by one every `intervalMs` while `running` is true.
 * Drives simple sprite animations (walk cycles, turning) in the menus.
 */
export function useTicker(intervalMs: number, running = true): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, running]);

  return tick;
}
