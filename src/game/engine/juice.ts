/**
 * "Juice": the little touches that make actions feel good.
 *
 *  - HIT-STOP: the world freezes for ~50 ms when a hit lands. It sounds
 *    odd, but that tiny pause is what makes a hit feel heavy.
 *  - FLOATING TEXT: damage numbers and "+3" coin pops that drift up and fade.
 *  - SCREEN FLASHES: a red vignette when the hero is hurt, a white flash
 *    for big moments.
 *
 * (Screen shake lives in the camera.)
 */
import { drawText } from "@/game/art/font";

export type FloatStyle = "damage" | "crit" | "coin" | "heal" | "info" | "good";

const FLOAT_STYLES: Record<FloatStyle, { color: string; scale: number; life: number }> = {
  damage: { color: "#ffe066", scale: 1, life: 0.7 },
  crit: { color: "#ffb23f", scale: 2, life: 0.9 },
  coin: { color: "#ffd34d", scale: 1, life: 0.8 },
  heal: { color: "#ff7b93", scale: 1, life: 0.8 },
  info: { color: "#ffffff", scale: 1, life: 1.4 },
  good: { color: "#8dffa8", scale: 1, life: 1.4 },
};

/** How far floating text rises over its life, in pixels. */
const FLOAT_RISE_PX = 16;
/** Never freeze longer than this, even if many hits land at once. */
const MAX_HIT_STOP_SEC = 0.12;

interface FloatingText {
  x: number;
  y: number;
  text: string;
  style: FloatStyle;
  age: number;
}

interface Flash {
  color: string;
  alpha: number;
  duration: number;
  age: number;
  /** "vignette" darkens the edges only; "full" tints the whole screen. */
  shape: "vignette" | "full";
}

export class Juice {
  private stopLeft = 0;
  private texts: FloatingText[] = [];
  private flashes: Flash[] = [];

  hitStop(ms: number): void {
    this.stopLeft = Math.min(MAX_HIT_STOP_SEC, Math.max(this.stopLeft, ms / 1000));
  }

  /** Advances the hit-stop timer; returns true while the world should stay frozen. */
  consumeHitStop(dt: number): boolean {
    if (this.stopLeft <= 0) return false;
    this.stopLeft -= dt;
    return true;
  }

  floatText(x: number, y: number, text: string, style: FloatStyle = "info"): void {
    // Nudge texts spawned on the same spot so they don't print over each other.
    const stacked = this.texts.filter((t) => t.age < 0.2 && Math.abs(t.x - x) < 10 && Math.abs(t.y - y) < 8).length;
    this.texts.push({ x, y: y - stacked * 8, text, style, age: 0 });
  }

  /** Red edges when hurt, white for big moments. */
  flash(color: string, alpha: number, duration: number, shape: Flash["shape"] = "full"): void {
    this.flashes.push({ color, alpha, duration, age: 0, shape });
  }

  update(dt: number): void {
    for (const t of this.texts) t.age += dt;
    this.texts = this.texts.filter((t) => t.age < FLOAT_STYLES[t.style].life);
    for (const f of this.flashes) f.age += dt;
    this.flashes = this.flashes.filter((f) => f.age < f.duration);
  }

  /** Floating texts, in world space (call while the camera transform is applied). */
  drawWorld(g: CanvasRenderingContext2D): void {
    for (const t of this.texts) {
      const style = FLOAT_STYLES[t.style];
      const k = t.age / style.life;
      const rise = (1 - (1 - k) * (1 - k)) * FLOAT_RISE_PX; // ease-out: fast start, gentle stop
      const alpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      // A quick "pop": crits start one size bigger for a moment.
      const scale = style.scale + (t.style === "crit" && t.age < 0.08 ? 1 : 0);
      drawText(g, t.text, Math.round(t.x), Math.round(t.y - rise), { color: style.color, outline: "#2b1d34", align: "center", scale, alpha });
    }
  }

  /** Screen flashes, in screen space (after the camera transform is removed). */
  drawScreen(g: CanvasRenderingContext2D, w: number, h: number): void {
    for (const f of this.flashes) {
      const alpha = f.alpha * (1 - f.age / f.duration);
      g.save();
      g.globalAlpha = alpha;
      if (f.shape === "full") {
        g.fillStyle = f.color;
        g.fillRect(0, 0, w, h);
      } else {
        const grad = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, f.color);
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
      }
      g.restore();
    }
  }
}
