import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { addCoins } from "@/lib/game/actions";
import { createSaveStore, createStore } from "@/lib/game/store";
import { createSelectionMemo, shallowEqual, useStore } from "@/lib/game/useStore";

describe("shallowEqual", () => {
  it("compares one level deep", () => {
    const shared = [1];
    expect(shallowEqual(1, 1)).toBe(true);
    expect(shallowEqual(Number.NaN, Number.NaN)).toBe(true);
    expect(shallowEqual({ a: 1, b: shared }, { a: 1, b: shared })).toBe(true);
    expect(shallowEqual({ a: 1, b: [1] }, { a: 1, b: [1] })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(shallowEqual([1, 2], [1, 2])).toBe(true);
    expect(shallowEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
    expect(shallowEqual(null, {})).toBe(false);
  });
});

describe("createSelectionMemo", () => {
  it("keeps the same reference for shallow-equal results, even with a new inline selector each time", () => {
    const select = createSelectionMemo<{ a: number; b: number }, { a: number }>();
    const state = { a: 1, b: 2 };
    const first = select(state, (s) => ({ a: s.a }));
    expect(select(state, (s) => ({ a: s.a }))).toBe(first);
    expect(select({ a: 1, b: 99 }, (s) => ({ a: s.a }))).toBe(first);

    const changed = select({ a: 5, b: 2 }, (s) => ({ a: s.a }));
    expect(changed).toEqual({ a: 5 });
    expect(changed).not.toBe(first);
  });
});

describe("useStore (server rendering)", () => {
  it("renders the save store's server snapshot, so hydration matches the server HTML", () => {
    const store = createSaveStore(null);
    store.set((save) => addCoins(save, 99));
    function Coins() {
      return createElement("span", null, useStore(store, (save) => save.coins));
    }
    expect(renderToString(createElement(Coins))).toBe("<span>0</span>");
  });

  it("works with plain stores and object-returning selectors", () => {
    const store = createStore({ hp: 6, maxHp: 10 });
    function Hearts() {
      const { hp, maxHp } = useStore(store, (s) => ({ hp: s.hp, maxHp: s.maxHp }));
      return createElement("span", null, `${hp}/${maxHp}`);
    }
    expect(renderToString(createElement(Hearts))).toBe("<span>6/10</span>");
  });
});
