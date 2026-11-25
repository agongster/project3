/**
 * Plain-language descriptions of items and player stats.
 *
 * The catalog stores raw numbers (cooldowns in ms, ranges in px, HP in
 * half-hearts). Players should never have to do that maths, so this file
 * turns the numbers into short sentences like "3.6 attacks per second".
 * Pure functions only: no React, easy to read and to test.
 */
import { MAX_CHARMS, TILE, getItem } from "@/lib/game/catalog";
import type { AttackStyle, CharmDef, ItemDef, PetPerk, TrailDef, WeaponDef } from "@/lib/game/catalog";
import { BASE_MAGNET_RADIUS } from "@/lib/game";
import type { PlayerStats } from "@/lib/game";
import type { ItemSlot } from "@/lib/types";

/** One row of a stats list. `hearts` (in half-hearts) asks the UI to draw heart icons too. */
export interface StatLine {
  label: string;
  text: string;
  hearts?: number;
}

const MS_PER_SECOND = 1000;
const HALF_HEARTS_PER_HEART = 2;

export const SLOT_LABEL: Readonly<Record<ItemSlot, string>> = {
  weapon: "Weapon",
  charm: "Charm",
  hat: "Hat",
  pet: "Pet",
  trail: "Trail",
};

export const SLOT_PLURAL: Readonly<Record<ItemSlot, string>> = {
  weapon: "Weapons",
  charm: "Charms",
  hat: "Hats",
  pet: "Pets",
  trail: "Trails",
};

/** Bag tab order. */
export const SLOTS: readonly ItemSlot[] = ["weapon", "charm", "hat", "pet", "trail"];

const ATTACK_STYLE_TEXT: Readonly<Record<AttackStyle, string>> = {
  swing: "Wide swing in front of you",
  thrust: "Long poke that hits a whole line",
  projectile: "Shoots straight ahead",
  boomerang: "Flies out and comes back",
  slam: "Heavy smash that hits all around",
  nova: "Bursts out in a ring around you",
};

const PET_PERK_TEXT: Readonly<Record<PetPerk, string>> = {
  collector: "Nudges nearby coins toward you",
  fighter: "Pecks a nearby monster every couple of seconds",
  healer: "Now and then drops a heart for you",
  lucky: "Monsters drop a few extra coins",
};

const TRAIL_SHAPE_TEXT: Readonly<Record<TrailDef["shape"], string>> = {
  sparkle: "sparkles",
  petal: "petals",
  heart: "hearts",
  bit: "0s and 1s",
  note: "music notes",
};

// ───────────────────────────── Number words ─────────────────────────────

/** 1 → "0.5 heart", 2 → "1 heart", 3 → "1.5 hearts". */
function heartsText(halfHearts: number): string {
  const hearts = halfHearts / HALF_HEARTS_PER_HEART;
  return `${hearts} heart${hearts === 1 || hearts === 0.5 ? "" : "s"}`;
}

/** Pixels → "1.9 tiles" (one decimal, trailing ".0" dropped). */
function tilesText(px: number): string {
  const tiles = Math.round((px / TILE) * 10) / 10;
  return `${tiles} tile${tiles === 1 ? "" : "s"}`;
}

/** 0.15 → "15%". */
function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** A cooldown in ms → attacks per second, one decimal. */
function attacksPerSecond(cooldownMs: number): number {
  return Math.round((MS_PER_SECOND / cooldownMs) * 10) / 10;
}

// ───────────────────────────── Items ─────────────────────────────

function weaponLines(weapon: WeaponDef): StatLine[] {
  const lines: StatLine[] = [
    { label: "Style", text: ATTACK_STYLE_TEXT[weapon.style] },
    { label: "Damage", text: heartsText(weapon.damage), hearts: weapon.damage },
    { label: "Speed", text: `${attacksPerSecond(weapon.cooldownMs)} attacks per second` },
    { label: "Reach", text: tilesText(weapon.range) },
  ];
  if (weapon.pierce) lines.push({ label: "Bonus", text: "Flies through every monster in its way" });
  if (weapon.homing) lines.push({ label: "Bonus", text: "Steers itself toward monsters" });
  if (weapon.wave) lines.push({ label: "Bonus", text: "Every swing also sends out a wave" });
  return lines;
}

/** What a charm does, as one short sentence. */
function charmEffectText(charm: CharmDef): string {
  switch (charm.effect) {
    case "speed":
      return `+${percent(charm.value)} move speed`;
    case "magnet":
      return `Pulls in coins from ${tilesText(charm.value)} further away`;
    case "maxHp":
      return `+${heartsText(charm.value)} of health`;
    case "coins":
      return `+${percent(charm.value)} coins from everything`;
    case "dash":
      return `Dash ${Math.round(1 / charm.value)}× as often`;
    case "regen":
      return `Heals half a heart every ${charm.value} seconds`;
    case "crit":
      return `${percent(charm.value)} chance to deal double damage`;
    case "thorns":
      return `Monsters that bump into you take ${heartsText(charm.value)} of damage`;
  }
}

/** The stats list shown in the bag's detail pane and on reward cards. */
export function itemStatLines(item: ItemDef): StatLine[] {
  switch (item.slot) {
    case "weapon":
      return weaponLines(item);
    case "charm":
      return [{ label: "Effect", text: charmEffectText(item) }];
    case "pet":
      return [
        { label: "Perk", text: PET_PERK_TEXT[item.perk] },
        { label: "Moves", text: item.flies ? "Flutters along in the air" : "Hops along behind you" },
      ];
    case "trail":
      return [{ label: "Effect", text: `Leaves a trail of ${TRAIL_SHAPE_TEXT[item.shape]} as you walk` }];
    case "hat":
      return [{ label: "Effect", text: "Pure style. Shows on your hero." }];
  }
}

/** The single most important fact about an item, for compact cards. */
export function itemHeadlineStat(item: ItemDef): string {
  return itemStatLines(item)[0].text;
}

// ───────────────────────────── Charms ─────────────────────────────

/**
 * What equipping `charmId` will do to the worn charms, in words, or null
 * when it is simply added. (Mirrors `equipItem`: when MAX_CHARMS are worn,
 * the charm put on first comes off.)
 */
export function charmSwapText(wornCharms: readonly string[], charmId: string): string | null {
  if (wornCharms.includes(charmId) || wornCharms.length < MAX_CHARMS) return null;
  const oldest = getItem(wornCharms[0]);
  return `You can wear ${MAX_CHARMS} charms. Equipping this one takes off ${oldest?.name ?? "your oldest charm"}.`;
}

// ───────────────────────────── Player stats ─────────────────────────────

/**
 * The hero's derived stats as friendly lines. Hearts and weapon always
 * show; every other line appears only when a charm, level or pet changes it.
 */
export function playerStatLines(stats: PlayerStats): StatLine[] {
  const lines: StatLine[] = [
    { label: "Health", text: heartsText(stats.maxHp), hearts: stats.maxHp },
    { label: "Weapon", text: `${stats.weapon.name} · ${heartsText(stats.weapon.damage)} per hit` },
  ];
  if (stats.speedMult !== 1) lines.push({ label: "Speed", text: `+${percent(stats.speedMult - 1)} faster` });
  if (stats.coinMult !== 1) lines.push({ label: "Coins", text: `+${percent(stats.coinMult - 1)} from everything` });
  if (stats.magnetRadius > BASE_MAGNET_RADIUS) lines.push({ label: "Magnet", text: `Coins fly in from ${tilesText(stats.magnetRadius)}` });
  if (stats.dashCooldownMult !== 1) lines.push({ label: "Dash", text: `${Math.round(1 / stats.dashCooldownMult)}× as often` });
  if (stats.regenEverySec !== null) lines.push({ label: "Regen", text: `Half a heart every ${stats.regenEverySec} s` });
  if (stats.critChance > 0) lines.push({ label: "Crit", text: `${percent(stats.critChance)} double damage` });
  if (stats.thorns > 0) lines.push({ label: "Thorns", text: `${heartsText(stats.thorns)} back to attackers` });
  if (stats.petPerk) lines.push({ label: "Pet", text: PET_PERK_TEXT[stats.petPerk] });
  return lines;
}
