/**
 * Class names of the HUD animations defined in hud.css. Importing this
 * module also loads the stylesheet, so components only ever import `HUD_FX`.
 */
import "./hud.css";

export const HUD_FX = {
  /** A toast sliding in from the right. */
  toastIn: "hud-toast-in",
  /** A toast fading away at the end of its life. */
  fadeOut: "hud-fade-out",
  /** The combo counter fading after the combo ends. */
  fadeOutSlow: "hud-fade-out-slow",
  /** A banner slamming in. */
  bannerIn: "hud-banner-in",
  /** Hearts bouncing when healed / shaking when hurt. */
  heal: "hud-heal",
  hurt: "hud-hurt",
  /** The combo counter punching up. */
  comboPop: "hud-combo-pop",
  /** The interaction prompt floating (also centres it horizontally). */
  promptBob: "hud-prompt-bob",
  /** A gentle glow pulse for "ready" things. */
  readyPulse: "hud-ready-pulse",
} as const;
