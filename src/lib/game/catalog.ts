/**
 * The game's "design sheet": every item, monster, scenery theme and character
 * option lives here as plain data. Nothing in this file has behaviour, so it
 * is the easiest place to tweak the game (rename a weapon, rebalance a
 * monster, add a hat...).
 *
 * Units used throughout the game:
 *   - distances are in pixels (one tile = 16 px)
 *   - HP is counted in half-hearts (the player starts with 10 = five hearts)
 */
import type { ItemSlot, MonsterKind, Rarity, Severity, ThemeId } from "@/lib/types";

export const TILE = 16;
export const MAX_CHARMS = 2;
export const BASE_MAX_HP = 10;

// ──────────────────────────── Rarity ────────────────────────────

export const RARITIES: readonly Rarity[] = ["common", "rare", "epic", "legendary"];

export const RARITY_INFO: Record<Rarity, { label: string; color: string; stars: number; dupeRefund: number }> = {
  common: { label: "Common", color: "#9fb4c7", stars: 1, dupeRefund: 8 },
  rare: { label: "Rare", color: "#5aa9ff", stars: 2, dupeRefund: 20 },
  epic: { label: "Epic", color: "#c77dff", stars: 3, dupeRefund: 50 },
  legendary: { label: "Legendary", color: "#ffc93c", stars: 4, dupeRefund: 120 },
};

// ───────────────────────────── Items ────────────────────────────

interface ItemBase {
  id: string;
  name: string;
  slot: ItemSlot;
  rarity: Rarity;
  /** One playful line shown in the inventory and on the gacha reveal. */
  blurb: string;
  /** Starter items are owned from the beginning and never drop from gacha. */
  starter?: boolean;
}

/**
 * How a weapon attacks:
 *  - swing:      a quick arc in front of the player
 *  - thrust:     a long narrow poke that pierces everything in a line
 *  - projectile: fires something that flies straight ahead
 *  - boomerang:  flies out and comes back, hitting both ways
 *  - slam:       slow overhead smash with a round area of effect
 *  - nova:       a ring that bursts outward around the player
 */
export type AttackStyle = "swing" | "thrust" | "projectile" | "boomerang" | "slam" | "nova";

export interface WeaponDef extends ItemBase {
  slot: "weapon";
  style: AttackStyle;
  /** Half-hearts of damage per hit. */
  damage: number;
  /** Minimum time between attacks. */
  cooldownMs: number;
  /** Reach in pixels (swing/thrust/slam/nova radius, or projectile travel distance). */
  range: number;
  /** How far a hit pushes a monster back, in pixels. */
  knockback: number;
  /** Projectiles only: keeps flying through monsters. */
  pierce?: boolean;
  /** Projectiles only: gently steers toward the nearest monster. */
  homing?: boolean;
  /** Extra flourish: swings also launch a short-range wave. */
  wave?: boolean;
}

export type CharmEffect =
  | "speed" // value = move speed multiplier bonus (0.15 = +15%)
  | "magnet" // value = extra coin pickup radius in px
  | "maxHp" // value = extra half-hearts
  | "coins" // value = coin multiplier bonus (0.5 = +50%)
  | "dash" // value = dash cooldown multiplier (0.5 = half)
  | "regen" // value = seconds between healing one half-heart
  | "crit" // value = chance (0–1) to deal double damage
  | "thorns"; // value = damage dealt back to monsters that touch you

export interface CharmDef extends ItemBase {
  slot: "charm";
  effect: CharmEffect;
  value: number;
}

export interface HatDef extends ItemBase {
  slot: "hat";
}

/**
 * What a pet does besides being adorable:
 *  - collector: pulls nearby coins toward you
 *  - fighter:   pecks a nearby monster every couple of seconds
 *  - healer:    occasionally drops a heart
 *  - lucky:     monsters drop a few extra coins
 */
export type PetPerk = "collector" | "fighter" | "healer" | "lucky";

export interface PetDef extends ItemBase {
  slot: "pet";
  perk: PetPerk;
  /** True if the pet floats/flies (no hop animation, ignores walls visually). */
  flies: boolean;
}

export interface TrailDef extends ItemBase {
  slot: "trail";
  /** Particle colors, picked at random per particle. */
  colors: string[];
  /** Particle shape. */
  shape: "sparkle" | "petal" | "heart" | "bit" | "note";
}

export type ItemDef = WeaponDef | CharmDef | HatDef | PetDef | TrailDef;

export const WEAPONS: WeaponDef[] = [
  { id: "twig", slot: "weapon", rarity: "common", starter: true, name: "Trusty Twig", blurb: "Every great debugger starts with a stick.", style: "swing", damage: 1, cooldownMs: 280, range: 20, knockback: 6 },
  { id: "bugNet", slot: "weapon", rarity: "common", name: "Bug Net", blurb: "Huge swoosh. Catches bugs. Literally.", style: "swing", damage: 1, cooldownMs: 320, range: 30, knockback: 4 },
  { id: "keyboard", slot: "weapon", rarity: "common", name: "Clacky Keyboard", blurb: "Mechanical switches. Maximum bonk.", style: "slam", damage: 2, cooldownMs: 520, range: 22, knockback: 10 },
  { id: "lintRoller", slot: "weapon", rarity: "common", name: "Lint Roller", blurb: "Rolls right through the fuzz.", style: "thrust", damage: 1, cooldownMs: 300, range: 34, knockback: 8 },
  { id: "rubberDuck", slot: "weapon", rarity: "rare", name: "Rubber Duck", blurb: "Explain the bug to it. Then throw it.", style: "projectile", damage: 2, cooldownMs: 380, range: 110, knockback: 6 },
  { id: "formatterBlade", slot: "weapon", rarity: "rare", name: "Formatter Blade", blurb: "88 columns of razor-sharp consistency.", style: "swing", damage: 2, cooldownMs: 220, range: 24, knockback: 6 },
  { id: "typeBow", slot: "weapon", rarity: "rare", name: "Type-Hint Bow", blurb: "def arrow() -> Ouch:", style: "projectile", damage: 2, cooldownMs: 340, range: 150, knockback: 5, pierce: true },
  { id: "gitBoomerang", slot: "weapon", rarity: "rare", name: "Git Boomerang", blurb: "Whatever you push comes back.", style: "boomerang", damage: 2, cooldownMs: 560, range: 90, knockback: 4 },
  { id: "refactorHammer", slot: "weapon", rarity: "epic", name: "Refactor Hammer", blurb: "Breaks big problems into small ones.", style: "slam", damage: 4, cooldownMs: 600, range: 34, knockback: 14 },
  { id: "debugWand", slot: "weapon", rarity: "epic", name: "Debugger Wand", blurb: "Sets breakpoints that chase the bug.", style: "projectile", damage: 2, cooldownMs: 260, range: 140, knockback: 3, homing: true },
  { id: "snakeWhip", slot: "weapon", rarity: "epic", name: "Python Whip", blurb: "import antigravity; crack!", style: "thrust", damage: 3, cooldownMs: 300, range: 52, knockback: 9 },
  { id: "mergeSaber", slot: "weapon", rarity: "legendary", name: "Merge Saber", blurb: "Resolves every conflict in one stroke.", style: "swing", damage: 3, cooldownMs: 200, range: 30, knockback: 8, wave: true },
  { id: "zenStaff", slot: "weapon", rarity: "legendary", name: "Staff of Zen", blurb: "Beautiful is better than ugly.", style: "nova", damage: 3, cooldownMs: 480, range: 56, knockback: 12 },
  { id: "goldenDuck", slot: "weapon", rarity: "legendary", name: "Golden Duck", blurb: "The quack heard around the codebase.", style: "boomerang", damage: 4, cooldownMs: 420, range: 110, knockback: 8 },
];

export const CHARMS: CharmDef[] = [
  { id: "hotCoffee", slot: "charm", rarity: "common", name: "Hot Coffee", blurb: "+15% move speed. Jittery but effective.", effect: "speed", value: 0.15 },
  { id: "coinMagnet", slot: "charm", rarity: "common", name: "Coin Magnet", blurb: "Coins fly to you from far away.", effect: "magnet", value: 40 },
  { id: "heartCookie", slot: "charm", rarity: "rare", name: "Heart Cookie", blurb: "+1 heart. Baked with love.", effect: "maxHp", value: 2 },
  { id: "luckyClover", slot: "charm", rarity: "rare", name: "Lucky Clover", blurb: "+50% coins from everything.", effect: "coins", value: 0.5 },
  { id: "springBoots", slot: "charm", rarity: "rare", name: "Spring Boots", blurb: "Dash twice as often. Boing.", effect: "dash", value: 0.5 },
  { id: "cactusBuddy", slot: "charm", rarity: "epic", name: "Cactus Buddy", blurb: "Anything that bumps you gets poked.", effect: "thorns", value: 2 },
  { id: "docScarf", slot: "charm", rarity: "epic", name: "Docstring Scarf", blurb: "Slowly heals you. Well-documented warmth.", effect: "regen", value: 8 },
  { id: "greenCheck", slot: "charm", rarity: "legendary", name: "Green Checkmark", blurb: "All tests passing: 30% chance of double damage.", effect: "crit", value: 0.3 },
];

export const HATS: HatDef[] = [
  { id: "beanie", slot: "hat", rarity: "common", starter: true, name: "Cozy Beanie", blurb: "Standard-issue late-night coding hat." },
  { id: "strawHat", slot: "hat", rarity: "common", starter: true, name: "Straw Hat", blurb: "For touching grass." },
  { id: "partyHat", slot: "hat", rarity: "common", name: "Party Hat", blurb: "It compiled on the first try!" },
  { id: "headphones", slot: "hat", rarity: "common", name: "Headphones", blurb: "Lo-fi beats to squash bugs to." },
  { id: "catEars", slot: "hat", rarity: "rare", name: "Cat Ears", blurb: "Nyan-level productivity." },
  { id: "flowerCrown", slot: "hat", rarity: "rare", name: "Flower Crown", blurb: "Woven from the cleanest functions." },
  { id: "topHat", slot: "hat", rarity: "rare", name: "Top Hat", blurb: "Distinguished engineer." },
  { id: "wizardHat", slot: "hat", rarity: "epic", name: "Wizard Hat", blurb: "For regex sorcery." },
  { id: "snakeHood", slot: "hat", rarity: "epic", name: "Snake Hood", blurb: "Become the Python." },
  { id: "halo", slot: "hat", rarity: "legendary", name: "Halo", blurb: "Zero warnings. Zero sins." },
  { id: "crown", slot: "hat", rarity: "legendary", name: "Royal Crown", blurb: "Benevolent ruler for life." },
];

export const PETS: PetDef[] = [
  { id: "duckling", slot: "pet", rarity: "common", name: "Duckling", blurb: "Waddles after you and nudges coins your way.", perk: "collector", flies: false },
  { id: "snek", slot: "pet", rarity: "rare", name: "Snek", blurb: "A tiny python. Bites bugs for you.", perk: "fighter", flies: false },
  { id: "byteBat", slot: "pet", rarity: "rare", name: "Byte Bat", blurb: "Sniffs out extra coins.", perk: "lucky", flies: true },
  { id: "pixelCat", slot: "pet", rarity: "epic", name: "Pixel Cat", blurb: "Knocks monsters off the table.", perk: "fighter", flies: false },
  { id: "cloudPuff", slot: "pet", rarity: "epic", name: "Cloud Puff", blurb: "Rains the occasional heart.", perk: "healer", flies: true },
  { id: "starSprite", slot: "pet", rarity: "legendary", name: "Star Sprite", blurb: "A fallen star that showers you in luck.", perk: "lucky", flies: true },
];

export const TRAILS: TrailDef[] = [
  { id: "sparkleTrail", slot: "trail", rarity: "common", name: "Sparkle Steps", blurb: "Leave a little glitter behind.", colors: ["#fff6a9", "#ffffff", "#ffd66b"], shape: "sparkle" },
  { id: "petalTrail", slot: "trail", rarity: "rare", name: "Petal Path", blurb: "Flowers bloom where you walk.", colors: ["#ffb7c5", "#ff8fab", "#ffe5ec"], shape: "petal" },
  { id: "heartTrail", slot: "trail", rarity: "rare", name: "Heart Beat", blurb: "You love clean code and it shows.", colors: ["#ff6b81", "#ff9aa2"], shape: "heart" },
  { id: "bitTrail", slot: "trail", rarity: "epic", name: "Bit Stream", blurb: "0s and 1s tumble out of your pockets.", colors: ["#7cf5a4", "#3ddc84", "#b8ffd0"], shape: "bit" },
  { id: "rainbowTrail", slot: "trail", rarity: "legendary", name: "Rainbow Road", blurb: "All six colors of the merge graph.", colors: ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#4dabf7", "#b197fc"], shape: "note" },
];

export const ALL_ITEMS: ItemDef[] = [...WEAPONS, ...CHARMS, ...HATS, ...PETS, ...TRAILS];

const ITEM_INDEX: Map<string, ItemDef> = new Map(ALL_ITEMS.map((item) => [item.id, item]));

export function getItem(id: string): ItemDef | undefined {
  return ITEM_INDEX.get(id);
}

export function getWeapon(id: string): WeaponDef {
  const item = ITEM_INDEX.get(id);
  return item && item.slot === "weapon" ? item : WEAPONS[0];
}

export const STARTER_WEAPON = "twig";

// ─────────────────────────── Monsters ───────────────────────────

/**
 * How a monster moves:
 *  - hopper:   lazy little hops in random directions
 *  - skitter:  runs AWAY from the player (catch it!)
 *  - flutter:  drifts around in wobbly circles
 *  - chaser:   walks toward the player, pauses before lunging
 *  - blinker:  fades out, reappears somewhere nearby
 *  - ambusher: sits perfectly still until the player is close, then pounces
 *  - spitter:  keeps its distance and lobs slow projectiles
 *  - tank:     big and slow, shrugs off knockback
 *  - boss:     large, telegraphed attacks, shows a boss health bar
 */
export type MonsterArchetype = "hopper" | "skitter" | "flutter" | "chaser" | "blinker" | "ambusher" | "spitter" | "tank" | "boss";

export interface MonsterDef {
  kind: MonsterKind;
  name: string;
  severity: Severity;
  archetype: MonsterArchetype;
  /** Half-hearts of health. */
  hp: number;
  /** Pixels per second. */
  speed: number;
  /** Half-hearts of damage when it touches the player. */
  touchDamage: number;
  /** Coins dropped: [min, max]. */
  coins: [number, number];
  xp: number;
  /** Sprite size in pixels (square). */
  size: 16 | 24 | 32;
  /** Shown in the bestiary. */
  blurb: string;
}

export const MONSTERS: Record<MonsterKind, MonsterDef> = {
  dustBunny: { kind: "dustBunny", name: "Dust Bunny", severity: "minion", archetype: "hopper", hp: 2, speed: 22, touchDamage: 1, coins: [2, 4], xp: 5, size: 16, blurb: "Gathers wherever unused imports and variables are left lying around." },
  todoMite: { kind: "todoMite", name: "Todo Mite", severity: "minion", archetype: "skitter", hp: 1, speed: 48, touchDamage: 0, coins: [3, 6], xp: 5, size: 16, blurb: "Feeds on TODO comments. Promises it will leave 'later'." },
  echoBat: { kind: "echoBat", name: "Echo Bat", severity: "minion", archetype: "flutter", hp: 2, speed: 34, touchDamage: 1, coins: [2, 5], xp: 6, size: 16, blurb: "Repeats itself. Repeats itself. Lives in redundant code." },
  gremlin: { kind: "gremlin", name: "Gremlin", severity: "elite", archetype: "chaser", hp: 6, speed: 36, touchDamage: 1, coins: [8, 12], xp: 15, size: 16, blurb: "A plain old bug. Breaks things at runtime and giggles." },
  phantom: { kind: "phantom", name: "Phantom", severity: "elite", archetype: "blinker", hp: 5, speed: 28, touchDamage: 1, coins: [8, 12], xp: 15, size: 16, blurb: "The ghost of a name that was never defined." },
  mimic: { kind: "mimic", name: "Mimic", severity: "elite", archetype: "ambusher", hp: 7, speed: 60, touchDamage: 1, coins: [10, 16], xp: 18, size: 16, blurb: "Looks like harmless code. It is not harmless code." },
  swallowToad: { kind: "swallowToad", name: "Swallow Toad", severity: "elite", archetype: "spitter", hp: 6, speed: 20, touchDamage: 1, coins: [8, 12], xp: 15, size: 16, blurb: "Gulps down exceptions whole so nobody ever hears about them." },
  spaghetti: { kind: "spaghetti", name: "Spaghetti Beast", severity: "elite", archetype: "tank", hp: 12, speed: 16, touchDamage: 1, coins: [12, 18], xp: 20, size: 24, blurb: "A function so tangled it became sentient." },
  keyThief: { kind: "keyThief", name: "Key Thief", severity: "boss", archetype: "boss", hp: 22, speed: 40, touchDamage: 2, coins: [30, 40], xp: 50, size: 32, blurb: "Collects passwords that were hardcoded in plain sight." },
  evalSerpent: { kind: "evalSerpent", name: "Eval Serpent", severity: "boss", archetype: "boss", hp: 26, speed: 34, touchDamage: 2, coins: [30, 40], xp: 50, size: 32, blurb: "Will happily execute anything you feed it." },
  glitchKing: { kind: "glitchKing", name: "Glitch King", severity: "boss", archetype: "boss", hp: 24, speed: 30, touchDamage: 2, coins: [30, 40], xp: 50, size: 32, blurb: "Rules over code that does not even parse." },
};

// ───────────────────────── Scenery themes ───────────────────────

export interface ThemeDef {
  id: ThemeId;
  name: string;
  blurb: string;
  /** Drifting ambient particles drawn over the world. */
  ambient: "pollen" | "petals" | "leaves" | "snow" | "bubbles" | "fireflies";
  /** A representative color for menus/buttons. */
  accent: string;
  /** True for dark themes (the engine adds a soft glow around lamps). */
  dark: boolean;
}

export const THEMES: ThemeDef[] = [
  { id: "meadow", name: "Sunny Meadow", blurb: "Green hills, daisies and a warm breeze.", ambient: "pollen", accent: "#7ec850", dark: false },
  { id: "sakura", name: "Sakura Spring", blurb: "Pink blossoms drifting over soft grass.", ambient: "petals", accent: "#ff9ebb", dark: false },
  { id: "autumn", name: "Maple Autumn", blurb: "Crunchy leaves and golden afternoons.", ambient: "leaves", accent: "#e8833a", dark: false },
  { id: "snow", name: "Snowy Hollow", blurb: "A quiet village under fresh powder.", ambient: "snow", accent: "#9fd8f0", dark: false },
  { id: "beach", name: "Coral Coast", blurb: "Sandy paths, palm trees and sea spray.", ambient: "bubbles", accent: "#3cc7c0", dark: false },
  { id: "night", name: "Firefly Night", blurb: "Lantern light and fireflies after dark.", ambient: "fireflies", accent: "#8a7dff", dark: true },
];

export function getTheme(id: ThemeId): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

// ─────────────────────── Character options ──────────────────────

export const SKIN_TONES = ["#ffe0c2", "#f6c9a0", "#e0a878", "#c68653", "#9a5f3c", "#6b4027"];

export const HAIR_STYLES = ["Short", "Bob", "Long", "Ponytail", "Spiky", "Curly", "Buns", "Bald"];

export const HAIR_COLORS = ["#3b2a20", "#6b4226", "#a8672f", "#e3b55c", "#f4e3b1", "#d9534f", "#ff8fab", "#7c5cff", "#4dabf7", "#3ddc97", "#e9ecef", "#2b2b35"];

export const OUTFITS = ["Tee", "Hoodie", "Overalls", "Dress", "Robe"];

export const OUTFIT_COLORS = ["#e5484d", "#f08c3a", "#f2c94c", "#58b368", "#3cc7c0", "#4a90e2", "#7c5cff", "#e667af", "#8d6e63", "#f1f3f5", "#343a40"];

export const EYE_STYLES = ["Dot", "Sparkle", "Sleepy"];

export const ACCESSORIES = ["None", "Glasses", "Blush", "Freckles"];

// ───────────────────────── Levels & titles ──────────────────────

/** XP needed to *reach* each level (index 0 = level 1). */
export const LEVEL_XP = [0, 40, 100, 180, 280, 400, 550, 730, 950, 1200];

export const LEVEL_TITLES = ["Curious Intern", "Bug Spotter", "Junior Debugger", "Lint Apprentice", "Code Gardener", "Senior Squasher", "Refactor Knight", "Staff Purifier", "Principal Sage", "Benevolent Maintainer"];
