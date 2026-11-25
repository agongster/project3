"use client";

/** One loading tip at a time, swapping every few seconds with a little slide-in. */
import { useEffect, useState } from "react";
import { LOADING_TIPS, TIP_INTERVAL_MS } from "./tips";

/** Start on a random tip so repeat visits don't always open with the same one. */
function randomTipIndex(): number {
  return Math.floor(Math.random() * LOADING_TIPS.length);
}

export function TipLine() {
  const [index, setIndex] = useState(randomTipIndex);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % LOADING_TIPS.length), TIP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <p className="min-h-[2.6em] text-center text-cream/90" aria-live="polite">
      <span className="mr-2 font-bold text-gold">TIP</span>
      {/* `key` remounts the span so the slide-in animation replays for each new tip. */}
      <span key={index} className="anim-slide-up inline-block">
        {LOADING_TIPS[index]}
      </span>
    </p>
  );
}
