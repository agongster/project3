import { useEffect, useRef, useState } from "react";

/** How long the counter takes to reach a new value. */
const TWEEN_MS = 450;

/**
 * A number that counts smoothly towards `target` instead of jumping, so a
 * pile of coins visibly ticks up (or down after a wish).
 */
export function useTweenedNumber(target: number): number {
  const [shown, setShown] = useState(target);
  // The value currently on screen, so a new target tweens on from wherever we are.
  const shownRef = useRef(target);

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;
    const start = performance.now();
    let raf = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / TWEEN_MS);
      const value = Math.round(from + (target - from) * t);
      shownRef.current = value;
      setShown(value);
      if (t < 1) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return shown;
}
