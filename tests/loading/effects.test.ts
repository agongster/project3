import { describe, expect, it } from "vitest";
import { createAmbient, updateAmbient } from "@/components/loading/bugCatch/ambient";
import { createEffects, effectsForEvent, updateEffects } from "@/components/loading/bugCatch/effects";
import { GAME_H, GAME_W } from "@/components/loading/bugCatch/tuning";

const catchEvent = (overrides: Partial<{ golden: boolean; points: number; streak: number }> = {}) => ({
  type: "catch" as const,
  kind: "dustBunny" as const,
  golden: false,
  x: 100,
  y: 100,
  points: 1,
  streak: 1,
  ...overrides,
});

describe("catch effects", () => {
  it("shows the points as a floating text, bigger for golden bugs", () => {
    const fx = createEffects(1);
    effectsForEvent(fx, catchEvent({ golden: true, points: 5 }));
    expect(fx.texts[0]).toMatchObject({ text: "+5", scale: 2 });
    expect(fx.particles.length).toBeGreaterThan(5);
  });

  it("adds a streak text from the third catch in a row", () => {
    const fx = createEffects(1);
    effectsForEvent(fx, catchEvent({ streak: 2 }));
    expect(fx.texts.map((t) => t.text)).toEqual(["+1"]);
    effectsForEvent(fx, catchEvent({ streak: 3 }));
    expect(fx.texts.map((t) => t.text)).toContain("x3!");
  });

  it("everything fades away after a few seconds", () => {
    const fx = createEffects(1);
    effectsForEvent(fx, catchEvent());
    effectsForEvent(fx, { type: "bonus", bonus: "coinShower" });
    for (let i = 0; i < 180; i++) updateEffects(fx, 1 / 60);
    expect(fx.particles).toHaveLength(0);
    expect(fx.texts).toHaveLength(0);
    expect(fx.banner).toBeNull();
  });
});

describe("ambient motes", () => {
  it("keeps the same number of motes, all near the screen, for every style", () => {
    for (const style of ["pollen", "petals", "leaves", "snow", "bubbles", "fireflies"] as const) {
      const amb = createAmbient(style, 3);
      const count = amb.motes.length;
      for (let i = 0; i < 60 * 60; i++) updateAmbient(amb, 1 / 60);
      expect(amb.motes).toHaveLength(count);
      for (const m of amb.motes) {
        expect(m.x).toBeGreaterThan(-20);
        expect(m.x).toBeLessThan(GAME_W + 20);
        expect(m.y).toBeGreaterThan(-20);
        expect(m.y).toBeLessThan(GAME_H + 20);
      }
    }
  });
});
