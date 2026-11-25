import { afterEach, describe, expect, it, vi } from "vitest";
import { addCoins, equipItem, recordDefeat, setLook, setSettings } from "@/lib/game/actions";
import { MAX_CHARMS } from "@/lib/game/catalog";
import { wishMany } from "@/lib/game/gacha";
import { MAX_SAVED_REPOS, withRepoProgress } from "@/lib/game/progress";
import {
  MAX_COINS,
  MAX_NAME_LENGTH,
  SAVE_DEBOUNCE_MS,
  SAVE_STORAGE_KEY,
  createSaveStore,
  createStore,
  defaultSave,
  sanitizeSave,
} from "@/lib/game/store";
import { mulberry32 } from "@/lib/rng";
import type { Rng } from "@/lib/rng";
import type { SaveData } from "@/lib/types";
import { KEY, STARTER_IDS, expectValidSave, makeFinding } from "./helpers";

// ───────────────────────────── createStore ─────────────────────────────

describe("createStore", () => {
  it("holds a value and accepts a new value or an updater", () => {
    const store = createStore(1);
    expect(store.get()).toBe(1);
    store.set(5);
    expect(store.get()).toBe(5);
    store.set((prev) => prev * 2);
    expect(store.get()).toBe(10);
  });

  it("notifies subscribers on change, but not when the value is identical", () => {
    const state = { n: 1 };
    const store = createStore(state);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set(state);
    store.set((prev) => prev);
    expect(listener).not.toHaveBeenCalled();

    store.set({ n: 1 }); // equal contents but a new object: that IS a change
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops notifying after unsubscribe, without affecting other listeners", () => {
    const store = createStore(0);
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribeA = store.subscribe(a);
    store.subscribe(b);

    store.set(1);
    unsubscribeA();
    store.set(2);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it("lets a listener unsubscribe itself mid-notification without skipping the others", () => {
    const store = createStore(0);
    const calls: string[] = [];
    const unsubscribeFirst = store.subscribe(() => {
      calls.push("first");
      unsubscribeFirst();
    });
    store.subscribe(() => calls.push("second"));

    store.set(1);
    store.set(2);
    expect(calls).toEqual(["first", "second", "second"]);
  });
});

// ───────────────────────────── defaultSave ─────────────────────────────

describe("defaultSave", () => {
  it("is a valid, fresh save with the starter kit", () => {
    const save = defaultSave();
    expectValidSave(save);
    expect(save.created).toBe(false);
    expect(save.coins).toBe(0);
    expect(save.look.name).toBe("Hero");
    expect(save.theme).toBe("meadow");
    expect(save.owned.sort()).toEqual([...STARTER_IDS].sort());
    expect(save.equipped).toEqual({ weapon: "twig", hat: null, pet: null, trail: null, charms: [] });
    expect(save.settings).toEqual({ sfx: 0.7, music: 0.4, screenShake: true });
  });

  it("returns a new object every time (callers may build on it)", () => {
    const a = defaultSave();
    const b = defaultSave();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.owned).not.toBe(b.owned);
    expect(a.look).not.toBe(b.look);
  });
});

// ───────────────────────────── sanitizeSave ─────────────────────────────

/** A save that has been played a bit: wishes, equipment, defeats, custom look and volumes. */
function playedSave(): SaveData {
  let save = addCoins(defaultSave(), 2000);
  save = wishMany(save, 20, mulberry32(7))!.save;
  const charm = save.owned.find((id) => ["hotCoffee", "coinMagnet", "heartCookie", "luckyClover"].includes(id));
  if (charm) save = equipItem(save, charm);
  save = equipItem(save, "strawHat");
  save = recordDefeat(save, KEY, makeFinding("a.py", 3)).save;
  save = setLook(save, { name: "Ada", hairColor: 7, outfit: 3 });
  save = setSettings(save, { sfx: 0.35, music: 0.125, screenShake: false });
  return { ...save, created: true, theme: "sakura" };
}

/** Random JSON-ish junk: wrong types, huge numbers, item ids, prototype keys… */
function randomJunk(rng: Rng, depth = 0): unknown {
  const atoms: unknown[] = [
    null,
    undefined,
    0,
    -1,
    1.5,
    42,
    1e308,
    -1e308,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    "",
    "twig",
    "bugNet",
    "greenCheck",
    "halo",
    "not-an-item",
    "__proto__",
    "meadow",
    true,
    false,
  ];
  const roll = rng();
  if (depth > 3 || roll < 0.5) return atoms[Math.floor(rng() * atoms.length)];
  if (roll < 0.7) return Array.from({ length: Math.floor(rng() * 5) }, () => randomJunk(rng, depth + 1));
  const keys = ["version", "coins", "owned", "equipped", "weapon", "charms", "look", "name", "skin", "repos", "gacha", "stats", "settings", "sfx", "defeated", "milestones", "__proto__"];
  const object: Record<string, unknown> = {};
  for (let i = Math.floor(rng() * 6); i > 0; i--) {
    Object.defineProperty(object, keys[Math.floor(rng() * keys.length)], {
      value: randomJunk(rng, depth + 1),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return object;
}

/** Replaces one random (possibly nested) field of a JSON copy of `save` with junk. */
function corruptOneField(save: SaveData, rng: Rng): unknown {
  const copy = JSON.parse(JSON.stringify(save)) as Record<string, unknown>;
  let target: Record<string, unknown> = copy;
  for (;;) {
    const keys = Object.keys(target);
    if (keys.length === 0) return copy;
    const key = keys[Math.floor(rng() * keys.length)];
    const child = target[key];
    if (typeof child === "object" && child !== null && rng() < 0.6) {
      target = child as Record<string, unknown>;
    } else {
      target[key] = randomJunk(rng);
      return copy;
    }
  }
}

describe("sanitizeSave", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a number", 42],
    ["a string", "{not json"],
    ["an array", [1, 2, 3]],
    ["an empty object", {}],
  ])("turns %s into the default save", (_label, input) => {
    expect(sanitizeSave(input)).toEqual(defaultSave());
  });

  it("returns a valid save unchanged (also through a JSON round trip)", () => {
    const save = playedSave();
    expectValidSave(save);
    expect(sanitizeSave(save)).toEqual(save);
    expect(sanitizeSave(JSON.parse(JSON.stringify(save)))).toStrictEqual(save);
  });

  it("fills in the missing fields of an older, partial save", () => {
    const save = sanitizeSave({ coins: 120, owned: ["bugNet"], look: { name: "Old Timer" } });
    expectValidSave(save);
    expect(save.coins).toBe(120);
    expect(save.owned).toEqual(["bugNet", ...STARTER_IDS]);
    expect(save.look.name).toBe("Old Timer");
    expect(save.look.skin).toBe(defaultSave().look.skin);
    expect(save.settings).toEqual(defaultSave().settings);
  });

  it("drops unknown or duplicate item ids but always keeps the starter items", () => {
    const save = sanitizeSave({ owned: ["bugNet", "laserCannon", 7, "bugNet", null] });
    expect(save.owned).toEqual(["bugNet", ...STARTER_IDS]);
  });

  it("unequips items that are not owned or sit in the wrong slot", () => {
    const save = sanitizeSave({
      owned: ["bugNet", "catEars", "hotCoffee"],
      equipped: { weapon: "mergeSaber", hat: "bugNet", pet: "starSprite", trail: 5, charms: ["hotCoffee", "greenCheck", "catEars"] },
    });
    expect(save.equipped).toEqual({ weapon: "twig", hat: null, pet: null, trail: null, charms: ["hotCoffee"] });
  });

  it(`caps equipped charms at ${MAX_CHARMS}, keeping the most recently equipped`, () => {
    const charms = ["hotCoffee", "coinMagnet", "heartCookie", "luckyClover"];
    const save = sanitizeSave({ owned: charms, equipped: { weapon: "twig", charms } });
    expect(save.equipped.charms).toEqual(charms.slice(-MAX_CHARMS));
  });

  it("clamps numbers, volumes, look indices and names", () => {
    const save = sanitizeSave({
      coins: 1e308,
      xp: -50,
      look: { name: `  ${"x".repeat(40)}\u0000  `, skin: 999, hairStyle: -3, hairColor: 2.7, eyes: "big" },
      settings: { sfx: 5, music: -1, screenShake: "yes" },
      gacha: { totalPulls: Number.NaN, sinceEpic: 3.9, sinceLegendary: -2 },
      theme: "volcano",
    });
    expectValidSave(save);
    expect(save.coins).toBe(MAX_COINS);
    expect(save.xp).toBe(0);
    expect(save.look.name).toBe("x".repeat(MAX_NAME_LENGTH));
    expect(save.look.skin).toBe(5); // last skin tone
    expect(save.look.hairStyle).toBe(0);
    expect(save.look.hairColor).toBe(2);
    expect(save.look.eyes).toBe(defaultSave().look.eyes);
    expect(save.settings).toEqual({ sfx: 1, music: 0, screenShake: true });
    expect(save.gacha).toEqual({ totalPulls: 0, sinceEpic: 3, sinceLegendary: 0 });
    expect(save.theme).toBe("meadow");
  });

  it("falls back to 'Hero' for a blank name", () => {
    expect(sanitizeSave({ look: { name: "   " } }).look.name).toBe("Hero");
  });

  it(`keeps only the ${MAX_SAVED_REPOS} most recent repos and ignores a __proto__ key`, () => {
    const repos: Record<string, unknown> = {};
    for (let i = 0; i < 15; i++) repos[`o/r${i}@sha`] = { defeated: ["x"], milestones: [25, 33, "50", 50, 50] };
    const raw = JSON.parse(`{"repos": {"__proto__": {"defeated": ["evil"]}, ${JSON.stringify(repos).slice(1)}}`);

    const save = sanitizeSave(raw);
    const keys = Object.keys(save.repos);
    expect(keys).toHaveLength(MAX_SAVED_REPOS);
    expect(keys[0]).toBe("o/r3@sha");
    expect(keys.at(-1)).toBe("o/r14@sha");
    expect(Object.getPrototypeOf(save.repos)).toBe(Object.prototype);
    expect(save.repos["o/r14@sha"]).toEqual({ defeated: ["x"], cleared: [], opened: [], milestones: [25, 50] });
  });

  it("never throws, even on objects whose getters throw", () => {
    const hostile = {
      get coins(): number {
        throw new Error("boom");
      },
    };
    expect(sanitizeSave(hostile)).toEqual(defaultSave());
  });

  it("fuzz: random junk always becomes a valid save", () => {
    const rng = mulberry32(1234);
    for (let i = 0; i < 1500; i++) expectValidSave(sanitizeSave(randomJunk(rng)));
  });

  it("fuzz: a valid save with one corrupted field becomes a valid save again", () => {
    const rng = mulberry32(99);
    const save = playedSave();
    for (let i = 0; i < 1500; i++) {
      const cleaned = sanitizeSave(corruptOneField(save, rng));
      expectValidSave(cleaned);
      // Cleaning is idempotent: a cleaned save is already valid.
      expect(sanitizeSave(cleaned)).toEqual(cleaned);
    }
  });
});

// ───────────────────────────── createSaveStore ─────────────────────────────

class FakeStorage {
  data = new Map<string, string>();
  writes = 0;
  failWrites = false;
  failReads = false;

  getItem(key: string): string | null {
    if (this.failReads) throw new Error("SecurityError");
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.writes++;
    this.data.set(key, value);
  }
}

describe("createSaveStore", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts from the default save when storage is empty", () => {
    const store = createSaveStore(new FakeStorage());
    expect(store.get()).toEqual(defaultSave());
  });

  it("loads (and sanitizes) an existing save", () => {
    const storage = new FakeStorage();
    storage.data.set(SAVE_STORAGE_KEY, JSON.stringify({ ...defaultSave(), coins: 77, owned: ["bugNet", "ghostItem"] }));
    const save = createSaveStore(storage).get();
    expect(save.coins).toBe(77);
    expect(save.owned).toEqual(["bugNet", ...STARTER_IDS]);
  });

  it("falls back to the default save on corrupt JSON or unreadable storage", () => {
    const corrupt = new FakeStorage();
    corrupt.data.set(SAVE_STORAGE_KEY, "{oops");
    expect(createSaveStore(corrupt).get()).toEqual(defaultSave());

    const locked = new FakeStorage();
    locked.failReads = true;
    expect(createSaveStore(locked).get()).toEqual(defaultSave());
  });

  it("batches changes into one write after the debounce", () => {
    vi.useFakeTimers();
    const storage = new FakeStorage();
    const store = createSaveStore(storage);

    store.set((save) => addCoins(save, 5));
    store.set((save) => addCoins(save, 5));
    expect(storage.writes).toBe(0);

    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(storage.writes).toBe(1);
    expect(JSON.parse(storage.data.get(SAVE_STORAGE_KEY)!).coins).toBe(10);
  });

  it("flush() writes immediately, and does nothing when there is no pending change", () => {
    vi.useFakeTimers();
    const storage = new FakeStorage();
    const store = createSaveStore(storage);

    store.flush();
    expect(storage.writes).toBe(0);

    store.set((save) => addCoins(save, 3));
    store.flush();
    expect(storage.writes).toBe(1);
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 2);
    expect(storage.writes).toBe(1); // the pending timer was cancelled
  });

  it("does not write when a reducer returns the same save", () => {
    vi.useFakeTimers();
    const storage = new FakeStorage();
    const store = createSaveStore(storage);
    store.set((save) => addCoins(save, 0));
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(storage.writes).toBe(0);
  });

  it("keeps working in memory when storage is full", () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const storage = new FakeStorage();
    storage.failWrites = true;
    const store = createSaveStore(storage);

    store.set((save) => addCoins(save, 9));
    expect(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS)).not.toThrow();
    expect(store.get().coins).toBe(9);
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("round-trips through storage: a new store sees what the old one saved", () => {
    const storage = new FakeStorage();
    const first = createSaveStore(storage);
    first.set((save) => withRepoProgress(addCoins(save, 42), KEY, { defeated: ["a"], cleared: [], opened: [], milestones: [] }));
    first.flush();
    expect(createSaveStore(storage).get()).toEqual(first.get());
  });

  it("works with no window at all (server rendering) and keeps a stable server snapshot", () => {
    expect(typeof window).toBe("undefined");
    const store = createSaveStore();
    store.set((save) => addCoins(save, 1));
    expect(store.get().coins).toBe(1);
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot());
    expect(store.getServerSnapshot()).toEqual(defaultSave());
  });
});
