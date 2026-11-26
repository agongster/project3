/**
 * What happens when a monster's HP reaches 0, step by step (the timeline
 * is measured by `monster.dyingFor`, in game seconds):
 *
 *   0 ─ startDeath: squash sound, the body starts to flatten (monsterDraw.ts)
 *   │   bosses: the whole game drops into slow motion and the boss shudders
 *   │   critical fixes (the right pick in the finisher, dazed.ts): slow motion
 *   │   too, a golden flash and "CRITICAL FIX!"
 *   deathDuration ─ finishDeath: smoke poof, burst, coins (and maybe a heart),
 *   │   the defeat is recorded (XP, "squashed" toast, level-ups, milestones)
 *   │   — only when this body's death defeats the finding (an echo bat's
 *   │   first body just pops, see traits/oneDefeat.ts)
 *   │   bosses: big burst, `bossDown`, white flash, back to dungeon music
 *   │   critical fixes: a star burst and double coins (and double XP, defeat.ts)
 *   + BUG_CARD_DELAY_SEC ─ bosses only: the game pauses on the bug card
 *   │   (skipped when the finisher overlay already showed this bug)
 *   + linger ─ the monster no longer counts as remaining (a short breather
 *              before the dungeon purifies)
 */
import { uiSprite } from "@/game/art/ui";
import { CRITICAL_FIX_COIN_MULTIPLIER } from "@/lib/game/finisher";
import type { SceneContext } from "../../scenes/context";
import { recordFindingDefeated } from "../../scenes/defeat";
import type { Monster } from "./monster";
import { DEATH_SQUASH_SEC } from "./monsterDraw";
import { coinsForDefeat, heartDropChance } from "./rewards";
import { emitBits, playPoof } from "./sceneWorld";
import type { DeathReward } from "./traits/oneDefeat";

/** Boss death animation length in GAME seconds (slow motion stretches it to ~1.8 s of real time). */
const BOSS_DEATH_SEC = 0.55;
/** Game speed while a boss is going down. */
export const BOSS_SLOWMO = 0.3;
/** The bug card shows this long after the boss bursts, so you see the coins fly. */
const BUG_CARD_DELAY_SEC = 0.7;
/** How long a defeated monster still counts as "remaining" after it popped. */
const LINGER_SEC = 0.6;
const BOSS_LINGER_SEC = 1;
const BOSS_SHUDDER_EVERY_SEC = 0.08;
const POP_COLORS = ["#ffffff", "#ffe066", "#ffb3c7"];
const BOSS_BURST_COLORS = ["#ffffff", "#ffe066", "#ff9ec4", "#9be7ff"];
const CRITICAL_FLASH = { color: "#ffe066", alpha: 0.45, sec: 0.4 };
const CRITICAL_SHAKE = 0.45;
const CRITICAL_STARS = 14;
const CRITICAL_BITS = 16;
const CRITICAL_BURST_COLORS = ["#ffe066", "#ffd36b", "#8dffa8", "#ffffff"];
/** "CRITICAL FIX!" floats this far above the monster's head. */
const CRITICAL_TEXT_LIFT_PX = 10;

export function deathDuration(m: Monster): number {
  return m.isBoss ? BOSS_DEATH_SEC : DEATH_SQUASH_SEC;
}

/** Seconds after `deathDuration` before the monster stops counting as remaining. */
export function lingerDuration(m: Monster): number {
  return m.isBoss ? BOSS_LINGER_SEC : LINGER_SEC;
}

/** True while the body is still on screen (squashing or shuddering). */
export function isDeathAnimating(m: Monster): boolean {
  return m.dyingFor >= 0 && m.dyingFor < deathDuration(m);
}

export function startDeath(ctx: SceneContext, m: Monster): void {
  ctx.audio.sfx("squash", { pitch: m.isBoss ? 0.7 : 0.9 + Math.random() * 0.2 });
  if (m.isBoss) {
    ctx.shake(0.5);
    ctx.juice.flash("#ffffff", 0.35, 0.3);
  }
  if (m.criticalFix) {
    ctx.audio.sfx("crit", { pitch: 0.8 });
    ctx.shake(CRITICAL_SHAKE);
    ctx.juice.flash(CRITICAL_FLASH.color, CRITICAL_FLASH.alpha, CRITICAL_FLASH.sec);
    ctx.floatText(m.x, m.y - m.def.size - CRITICAL_TEXT_LIFT_PX, "CRITICAL FIX!", "crit");
  }
}

/** Bosses shudder and spit glitter while they go down. */
export function updateDeathFx(ctx: SceneContext, m: Monster, before: number): void {
  if (!m.isBoss || !isDeathAnimating(m)) return;
  if (Math.floor(before / BOSS_SHUDDER_EVERY_SEC) === Math.floor(m.dyingFor / BOSS_SHUDDER_EVERY_SEC)) return;
  const x = m.x + (Math.random() - 0.5) * 24;
  const y = m.y - Math.random() * 24;
  playPoof(ctx, x, y);
  ctx.shake(0.15);
}

/** The pop: effects, and — when this death defeats the finding — coins, maybe a heart, and the save bookkeeping. */
export function finishDeath(ctx: SceneContext, m: Monster, reward: DeathReward): void {
  const midY = m.y - m.def.size / 2;
  playPoof(ctx, m.x, midY);
  emitBits(ctx, m.x, midY, 8, POP_COLORS);
  ctx.particles.burst(m.isBoss ? 24 : 6, m.x, midY, m.isBoss ? 90 : 45, { life: m.isBoss ? 1.2 : 0.6, sprite: uiSprite("sparkle", 0), drag: 2.5 });
  if (m.isBoss) bossBurst(ctx, m);
  if (m.criticalFix) criticalBurst(ctx, m);
  if (!reward.pays) return;

  const multiplier = (m.criticalFix ? CRITICAL_FIX_COIN_MULTIPLIER : 1) * reward.coinMultiplier;
  const coins = coinsForDefeat(m.def, ctx.petPerk, Math.random) * multiplier;
  ctx.spawnCoins(m.x, m.y, coins);
  const player = ctx.game.player;
  if (Math.random() < heartDropChance(player.hp)) ctx.spawnHeart(m.x, m.y);
  recordFindingDefeated(ctx, m.finding, Math.floor(coins * ctx.game.combo.coinMultiplier()), m.criticalFix);
}

/**
 * True on the step a defeated boss-severity finding should open its bug card.
 * Not when the finisher overlay already showed the same bug: two overlays
 * in a row for one kill would be too much.
 */
export function bugCardDue(m: Monster, before: number): boolean {
  const at = deathDuration(m) + BUG_CARD_DELAY_SEC;
  return m.finding.severity === "boss" && !m.finisherOpened && before < at && m.dyingFor >= at;
}

/** The right fix: golden stars and green sparks fly. */
function criticalBurst(ctx: SceneContext, m: Monster): void {
  const midY = m.y - m.def.size / 2;
  ctx.audio.sfx("coin", { pitch: 1.5 });
  ctx.particles.burst(CRITICAL_STARS, m.x, midY, 80, { life: 1.2, sprite: uiSprite("star", 0), drag: 2, gravity: 0 });
  emitBits(ctx, m.x, midY, CRITICAL_BITS, CRITICAL_BURST_COLORS);
}

function bossBurst(ctx: SceneContext, m: Monster): void {
  const midY = m.y - m.def.size / 2;
  ctx.audio.sfx("bossDown");
  ctx.shake(0.7);
  ctx.juice.flash("#ffffff", 0.5, 0.5);
  ctx.particles.burst(16, m.x, midY, 70, { life: 1.4, sprite: uiSprite("star", 0), drag: 2, gravity: 0 });
  emitBits(ctx, m.x, midY, 20, BOSS_BURST_COLORS);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    playPoof(ctx, m.x + Math.cos(a) * 16, midY + Math.sin(a) * 10);
  }
  ctx.audio.music("dungeon");
}
