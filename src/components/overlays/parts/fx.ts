/**
 * Class names of the overlay animations in fx.css. Importing this module
 * also loads the stylesheet, so a component that uses `FX.rays` can never
 * forget to include the CSS.
 */
import "./fx.css";

export const FX = {
  /** Sealed chest rocking from side to side. */
  wobble: "fx-wobble",
  /** Chest hopping as it bursts open. */
  hop: "fx-hop",
  /** A flash of light that grows and fades (uses --fx-color or --rarity). */
  burst: "fx-burst",
  /** Slowly turning light rays (--fx-color / --rarity, size via --rays-size). */
  rays: "fx-rays",
  /** Soft pulsing glow (--fx-color / --rarity, size via --glow-size). */
  glow: "fx-glow",
  /** A twinkling sparkle (stagger with --delay). */
  twinkle: "fx-twinkle",
  /** Legendary: golden shimmer sweeping the screen. */
  shimmer: "fx-shimmer",
  /** Legendary: a star drifting down (--delay, --duration). */
  starfall: "fx-starfall",
  /** An item card bouncing into view. */
  cardPop: "fx-card-pop",
  /** A wish card turning face up. */
  flip: "fx-flip",
  /** The bouncing "NEW!" badge. */
  newBadge: "fx-new-badge",
  /** "+N coins" floating up. */
  floatUp: "fx-float-up",
  /** A coin tossed in an arc into the well. */
  coinArc: "fx-coin-arc",
  /** The well trembling while a wish is decided. */
  rumble: "fx-rumble",
  /** One falling confetti square (--delay, --duration, --drift, --turn). */
  confetti: "fx-confetti",
} as const;
