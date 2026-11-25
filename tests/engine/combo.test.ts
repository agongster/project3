import { describe, expect, it } from "vitest";
import { Combo, COMBO_COIN_CAP, COMBO_WINDOW_SEC, comboCoinMultiplier } from "@/game/combat/combo";
import { quantizeDash } from "@/game/hud";

describe("comboCoinMultiplier", () => {
  it("is ×1 for no combo or a single hit", () => {
    expect(comboCoinMultiplier(0)).toBe(1);
    expect(comboCoinMultiplier(1)).toBe(1);
  });

  it("adds 10% per chained hit", () => {
    expect(comboCoinMultiplier(2)).toBeCloseTo(1.1);
    expect(comboCoinMultiplier(6)).toBeCloseTo(1.5);
  });

  it("is capped at ×2", () => {
    expect(comboCoinMultiplier(11)).toBeCloseTo(COMBO_COIN_CAP);
    expect(comboCoinMultiplier(500)).toBe(COMBO_COIN_CAP);
  });
});

describe("Combo", () => {
  it("counts hits landed within the window", () => {
    const c = new Combo();
    c.hit();
    c.update(1);
    c.hit();
    c.update(2);
    c.hit();
    expect(c.count).toBe(3);
    expect(c.coinMultiplier()).toBeCloseTo(1.2);
  });

  it("resets after waiting longer than the window", () => {
    const c = new Combo();
    c.hit();
    c.hit();
    c.update(COMBO_WINDOW_SEC + 0.01);
    expect(c.count).toBe(0);
    c.hit();
    expect(c.count).toBe(1);
  });
});

describe("quantizeDash", () => {
  it("rounds to 5% steps and clamps", () => {
    expect(quantizeDash(0.512)).toBe(0.5);
    expect(quantizeDash(0.53)).toBe(0.55);
    expect(quantizeDash(-1)).toBe(0);
    expect(quantizeDash(3)).toBe(1);
  });
});
