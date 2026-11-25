/**
 * The built-in demo kingdom: a small, made-up Python codebase for a fantasy
 * bakery & potion shop. It needs no network, so the game is always playable
 * (GitHub rate limits, offline graders, automated tests).
 *
 * The files are written to show off every part of the game:
 *   clean treasure houses   bakery/oven.py & main.py (S), potions/ingredients.py (A),
 *                           tools/inventory.py & tests/test_oven.py (B), two tiny __init__.py
 *   minions                 bakery/recipes.py, tests/test_recipes.py
 *   every elite             bakery/orders.py (phantom, mimic, swallow toad),
 *                           bakery/pricing.py (spaghetti, gremlin),
 *                           potions/labels.py, tools/restock.py
 *   bosses                  config.py (key thief), potions/brewing.py (eval serpent),
 *                           potions/cauldron.py (syntax error → glitch king)
 *
 * The real linter runs on these files, so what the player fights is exactly
 * what Ruff reports. Tests in tests/analysis/demo.test.ts keep it that way.
 */
import type { RepoAnalysis, RepoRef } from "@/lib/types";
import { analyzeSources } from "./analyzeSources";
import { AnalyzeError, abortedError, throwIfAborted } from "./errors";
import { createLintClient, type LintClient } from "./lintClient";
import type { RawDiagnostic } from "./normalize";
import { progressEvent, type ProgressCallback } from "./progress";

export const DEMO_REPO: RepoRef = {
  owner: "lintlands",
  repo: "demo-kingdom",
  ref: "main",
  // Any 40 hex digits will do; this one reads "decode scalable coffee…".
  sha: "d3c0de5ca1ab1ec0ffee0ba5eba11c0de5d3e0aa",
};

export const DEMO_DESCRIPTION = "The Crumbleton Bakery & Potion Shop — a tiny kingdom to practise on.";

/** Python source is written raw so backslashes like "\n" stay as Python sees them. */
const py = String.raw;

export const DEMO_SOURCES: readonly { path: string; source: string }[] = [
  {
    path: "main.py",
    source: py`"""Crumbleton Bakery & Potion Shop: the front door of the kingdom."""

from bakery.oven import bake_batch, describe
from potions.ingredients import rare_ingredients


def open_shop() -> None:
    """Greet the morning customers with fresh pastries."""
    # The morning tray: always croissants, sometimes something daring.
    for pastry in bake_batch(["croissant", "cinnamon swirl"], minutes=25):
        print(describe(pastry))
    for ingredient in rare_ingredients():
        print(f"Today's rare find: {ingredient.name}")


if __name__ == "__main__":
    open_shop()
`,
  },
  {
    path: "config.py",
    source: py`"""Shop settings. Please don't read this file out loud."""

SHOP_NAME = "Crumbleton Bakery & Potion Shop"
OPENING_HOUR = 7

# The till is locked with the royal password.
ADMIN_PASSWORD = "sugarplum123"

# FIXME: the dragon discount should not be negative.
DRAGON_DISCOUNT = -0.5
`,
  },
  {
    path: "bakery/__init__.py",
    source: "",
  },
  {
    path: "bakery/oven.py",
    source: py`"""The royal oven: turns raw dough into golden, flaky pastries."""

from dataclasses import dataclass

# Every pastry bakes at the same cosy temperature (in degrees Celsius).
OVEN_TEMPERATURE = 180


@dataclass
class Pastry:
    """A single pastry, from lump of dough to crowning glory."""

    name: str
    minutes_baked: int = 0

    def is_golden(self) -> bool:
        """Return True once the pastry has baked long enough to shine."""
        # Twenty minutes is the sweet spot for most croissants.
        return self.minutes_baked >= 20


def bake(pastry: Pastry, minutes: int) -> Pastry:
    """Bake a pastry for a few more minutes and return it."""
    # Never bake for negative time; the oven is not a time machine.
    pastry.minutes_baked += max(0, minutes)
    return pastry


def bake_batch(names: list[str], minutes: int) -> list[Pastry]:
    """Bake a whole tray of pastries at once."""
    return [bake(Pastry(name), minutes) for name in names]


def describe(pastry: Pastry) -> str:
    """Describe a pastry the way the head baker would."""
    if pastry.is_golden():
        return f"A golden {pastry.name}, fresh from the oven!"
    return f"A pale {pastry.name}. Give it a few more minutes."
`,
  },
  {
    path: "bakery/recipes.py",
    source: py`"""Secret recipes of the Crumbleton Bakery."""

import os
import random

# The house sourdough starter, fed every morning by the apprentice.
STARTER = {"flour": 100, "water": 100}

# TODO: ask Granny Marzipan for her cinnamon roll recipe.


def scale_recipe(recipe, servings):
    """Multiply every ingredient so the recipe feeds more hungry knights."""
    leftovers = recipe.get("leftovers")
    scaled = {}
    for ingredient, grams in recipe.items():
        scaled[ingredient] = grams * servings
    # scaled["sugar"] = scaled["sugar"] * 2
    return scaled


def pick_daily_special(recipes):
    """Let fate choose today's special."""
    if recipes == None:
        return "plain bread"
    return random.choice(list(recipes))
`,
  },
  {
    path: "bakery/orders.py",
    source: py`"""Taking orders from hungry villagers (and the occasional dragon)."""


def add_to_basket(item, basket=[]):
    """Put an item in the customer's basket."""
    basket.append(item)
    return basket


def read_order(slip):
    """Read a handwritten order slip like '3 croissants'."""
    try:
        count, pastry = slip.split(" ", 1)
        return int(count), pastry
    except:
        return 0, "mystery bun"


def total_price(order):
    """Add up the cost of an order."""
    count, pastry = order
    return count * PRICES[pastry]
`,
  },
  {
    path: "bakery/pricing.py",
    source: py`"""How much does a pastry cost today? It depends... on everything."""


def price_of(pastry, day, customer, weather, coupon):
    """Work out the price of one pastry. Good luck."""
    price = 3
    if pastry == "croissant":
        price = 4
    elif pastry == "eclair":
        price = 5
    elif pastry == "dragonfruit tart":
        price = 9
    if day == "Saturday":
        price += 1
    elif day == "Monday":
        price -= 1
    if customer == "knight":
        price -= 1
    elif customer == "dragon":
        price *= 10
    if weather == "rainy":
        if coupon:
            price -= 2
        else:
            price -= 1
    if coupon is "HALFOFF":
        price = price / 2
    for _ in range(3):
        if price < 1:
            price += 1
    return price
`,
  },
  {
    path: "potions/__init__.py",
    source: py`"""Potions: brewing, bottling and labelling magical drinks."""

from .ingredients import Ingredient

__all__ = ["Ingredient"]
`,
  },
  {
    path: "potions/brewing.py",
    source: py`"""The Grand Cauldron's brewing instructions. Handle with oven mitts."""

import subprocess


def brew(recipe_text: str) -> float:
    """Brew a potion from a recipe such as '2 * newt + 3 * moonlight'."""
    ingredients = {"newt": 1.5, "moonlight": 2.0, "glitter": 0.5}
    # Let Python do the maths for us. What could possibly go wrong?
    return eval(recipe_text, {}, ingredients)


def bottle(potion_name: str) -> None:
    """Ask the bottling machine to fill a bottle with the named potion."""
    subprocess.run(f"bottler --fill {potion_name}", shell=True, check=True)
`,
  },
  {
    path: "potions/cauldron.py",
    source: py`"""The cauldron itself. Someone stirred a little too hard."""


class Cauldron:
    """A big iron pot that bubbles ominously."""

    def __init__(self, size: int) -> None:
        self.size = size
        self.contents: list[str] = []

    def add(self, ingredient: str) -> None:
        """Drop an ingredient into the brew."""
        self.contents.append(ingredient

    def stir(self, times: int) -> str:
        """Stir the brew clockwise, as tradition demands."""
        return "bubble " * times
`,
  },
  {
    path: "potions/ingredients.py",
    source: py`"""A field guide to potion ingredients and where to find them."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Ingredient:
    """Something that can go into a potion."""

    name: str
    rarity: int
    found_in: str

    def is_rare(self):
        """Rare ingredients are worth a detour."""
        return self.rarity >= 3


# The witch's shopping list, sorted from common to legendary.
PANTRY = [
    Ingredient("newt eye", 1, "the pond"),
    Ingredient("moonlight", 3, "the hill at midnight"),
    Ingredient("dragon scale", 5, "a very grumpy dragon"),
]


def find(name):
    """Look up an ingredient by name, or return None."""
    for ingredient in PANTRY:
        if ingredient.name == name:
            return ingredient
    return None


def rare_ingredients() -> list[Ingredient]:
    """All ingredients rare enough to brag about."""
    return [item for item in PANTRY if item.is_rare()]
`,
  },
  {
    path: "potions/labels.py",
    source: py`"""Printing labels for potion bottles, with appropriate warnings."""

WARNINGS = {"fizzy": "May cause hiccups.", "glowing": "Do not drink after dark."}


def label_for(potion_name, effects):
    """Write the label text for one bottle."""
    if not potion_name:
        ValueError("Every potion needs a name!")
    lines = [potion_name.upper()]
    for effect in effects:
        if effect in WARNINGS.keys():
            lines.append(WARNINGS[effect])
    return "\n".join(lines)


def make_printers(colors):
    """One tiny printer function per ink color."""
    printers = []
    for color in colors:
        printers.append(lambda text: f"[{color}] {text}")
    return printers
`,
  },
  {
    path: "tests/test_oven.py",
    source: py`"""Tests for the royal oven."""

from bakery.oven import Pastry, bake, describe


def test_fresh_pastry_is_not_golden() -> None:
    assert not Pastry("croissant").is_golden()


def test_baking_long_enough_makes_it_golden() -> None:
    assert bake(Pastry("eclair"), 25).is_golden()


def test_negative_minutes_are_ignored() -> None:
    assert bake(Pastry("bun"), -10).minutes_baked == 0


def test_description_mentions_the_name() -> None:
    assert "croissant" in describe(Pastry("croissant", 30))
`,
  },
  {
    path: "tests/test_recipes.py",
    source: py`"""Tests for the secret recipes."""

from bakery.recipes import scale_recipe


def test_scaling_doubles_everything() -> None:
    """Twice the knights, twice the flour."""
    doubled = scale_recipe({"flour": 100, "egg": 2}, 2)
    assert doubled == {"flour": 200, "egg": 4}


def test_scaling_by_zero_empties_the_bowl() -> None:
    """Nobody is hungry today."""
    original = {"flour": 100}
    result = scale_recipe({"flour": 100}, 0)
    assert result == {"flour": 0}
`,
  },
  {
    path: "tools/inventory.py",
    source: py`"""Counting what is left in the pantry at the end of the day."""

from collections import Counter


def count_items(shelf):
    """Count how many of each item are on a shelf."""
    return Counter(shelf)


def low_stock(counts, threshold=3):
    """Items that are running low and need restocking."""
    return sorted(name for name, amount in counts.items() if amount < threshold)


def merge_shelves(*shelves):
    total = Counter()
    for shelf in shelves:
        total.update(count_items(shelf))
    return total
`,
  },
  {
    path: "tools/restock.py",
    source: py`"""Restocking the pantry from the market cart. Run it every morning."""

import json


def load_delivery(path):
    """Read the market cart's delivery note."""
    try:
        with open(path) as note:
            return json.load(note)
    except Exception:
        return {}


def restock(pantry, delivery):
    """Add delivered goods to the pantry."""
    list = sorted(delivery)
    for item in list:
        pantry[item] = pantry.get(item, 0) + delivery[item]
    # TODO: send a thank-you note to the market witch.
    return pantry


if __name__ == "__main__":
    print(restock({}, load_delivery("delivery.json")))
`,
  },
];

// ────────────────────────── Fake loading ──────────────────────────

/** Artificial pauses (ms) so the loading screen is visible for ~2–3 seconds. */
const DEMO_DELAYS = { listing: 400, perDownload: 70, perLint: 40, building: 300 };

/** Waits `ms` milliseconds; rejects with the "aborted" error if the signal fires. */
function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortedError());
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(abortedError());
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function utf8Size(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Analyzes the demo kingdom with the real linter, pretending to download it
 * so the loading screen behaves exactly like it does for a real repo.
 */
export async function analyzeDemo(
  onProgress: ProgressCallback,
  signal?: AbortSignal,
  deps: { createLintClient?: () => Promise<LintClient> } = {},
): Promise<RepoAnalysis> {
  const linterPromise = (deps.createLintClient ?? createLintClient)();
  linterPromise.catch(() => undefined); // handled below
  const total = DEMO_SOURCES.length;

  try {
    onProgress(progressEvent("listing"));
    await pause(DEMO_DELAYS.listing, signal);

    for (let i = 0; i <= total; i++) {
      onProgress(progressEvent("downloading", i, total));
      if (i < total) await pause(DEMO_DELAYS.perDownload, signal);
    }

    let linter: LintClient;
    try {
      linter = await linterPromise;
    } catch (error) {
      console.error("Lintlands: the Ruff lint worker failed to start", error);
      throw new AnalyzeError("linter_failed", "Couldn't start the bug detector. Try reloading the page.");
    }

    // Keyed by source text, like analyzeRepo: Ruff's output depends only on the text.
    const diagnosticsBySource = new Map<string, RawDiagnostic[]>();
    onProgress(progressEvent("linting", 0, total));
    for (const [i, file] of DEMO_SOURCES.entries()) {
      throwIfAborted(signal);
      diagnosticsBySource.set(file.source, await linter.lint(file.source));
      await pause(DEMO_DELAYS.perLint, signal);
      onProgress(progressEvent("linting", i + 1, total));
    }

    onProgress(progressEvent("building"));
    await pause(DEMO_DELAYS.building, signal);
    const analysis = analyzeDemoSources((source) => diagnosticsBySource.get(source) ?? []);
    onProgress(progressEvent("done"));
    return analysis;
  } finally {
    linterPromise.then((linter) => linter.dispose(), () => undefined);
  }
}

/**
 * The synchronous part, shared with the tests (which lint with Ruff's
 * Node.js build instead of the Web Worker).
 */
export function analyzeDemoSources(lint: (source: string) => RawDiagnostic[]): RepoAnalysis {
  return analyzeSources(
    { repo: DEMO_REPO, description: DEMO_DESCRIPTION, stars: 113, demo: true, warnings: [] },
    DEMO_SOURCES.map((file) => ({ path: file.path, size: utf8Size(file.source), source: file.source })),
    lint,
  );
}
