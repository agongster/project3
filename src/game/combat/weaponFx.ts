/**
 * Drawing the weapon in the hero's hand and the attack effects (slash arcs,
 * thrust streaks, slam and nova rings).
 *
 * Weapon sprites point RIGHT with their anchor at the grip, so drawing one
 * is "put the grip in the hand, rotate to the wanted angle". Effects are
 * plotted pixel by pixel (`pixelArc`) so they stay as crisp as the sprites.
 */
import { drawSprite } from "@/game/art";
import { weaponSprite } from "@/game/art/weapons";
import type { WeaponDef } from "@/lib/game/catalog";
import type { Rarity } from "@/lib/types";
import type { Player } from "../entities/player";
import { SWING_HALF_ARC, SLAM_REACH } from "./geometry";
import { STYLE_TIMING, type ActiveAttack } from "./attackState";

/** Effect colour per weapon rarity: fancier weapons leave fancier trails. */
const FX_COLORS: Record<Rarity, [string, string]> = {
  common: ["#ffffff", "#d7e6f5"],
  rare: ["#e3f4ff", "#7cc4ff"],
  epic: ["#f6e8ff", "#c38bff"],
  legendary: ["#fff8d6", "#ffc93c"],
};

/** Where the grip sits relative to the feet, per facing (the hero holds things at hip height). */
const HAND: Record<Player["facing"], { x: number; y: number; idleAngle: number }> = {
  right: { x: 4, y: -8, idleAngle: 1.0 },
  left: { x: -4, y: -8, idleAngle: Math.PI - 1.0 },
  down: { x: 6, y: -7, idleAngle: 1.25 },
  up: { x: -6, y: -9, idleAngle: -1.9 },
};

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/** Draws a right-pointing sprite rotated to `angle`, mirrored when pointing left so it is never upside down. */
function drawPointing(g: CanvasRenderingContext2D, weapon: WeaponDef, x: number, y: number, angle: number): void {
  const sprite = weaponSprite(weapon.id);
  if (Math.cos(angle) < -0.01) drawSprite(g, sprite, x, y, { flipX: true, rotation: angle - Math.PI });
  else drawSprite(g, sprite, x, y, { rotation: angle });
}

/** The weapon in the hero's hand: resting, or posed according to the running attack. */
export function drawHeldWeapon(g: CanvasRenderingContext2D, player: Player, weapon: WeaponDef, attack: ActiveAttack | null): void {
  const hand = HAND[player.facing];
  const hx = player.x + hand.x;
  const hy = player.y + hand.y;
  if (!attack) {
    drawPointing(g, weapon, hx, hy, hand.idleAngle);
    return;
  }
  const t = Math.min(1, attack.age / attack.duration);
  const cx = player.x + Math.cos(attack.aim) * 3;
  const cy = player.y - 7 + Math.sin(attack.aim) * 2;
  switch (weapon.style) {
    case "swing": {
      const angle = attack.aim + attack.sweep * SWING_HALF_ARC * (2 * easeOut(t) - 1);
      drawPointing(g, weapon, cx, cy, angle);
      break;
    }
    case "thrust": {
      const reach = Math.sin(Math.PI * t) * weapon.range * 0.45;
      drawPointing(g, weapon, cx + Math.cos(attack.aim) * reach, cy + Math.sin(attack.aim) * reach, attack.aim);
      break;
    }
    case "projectile":
    case "boomerang":
      // the arm whips forward
      drawPointing(g, weapon, cx, cy, attack.aim - attack.sweep * (1 - easeOut(t)) * 1.3);
      break;
    case "slam": {
      const impact = STYLE_TIMING.slam.hitFrom;
      // wind up over the head, then smash down toward the aim
      const angle = t < impact ? lerpAngle(hand.idleAngle, -Math.PI / 2, easeOut(t / impact)) : attack.aim;
      drawPointing(g, weapon, cx, cy - (t < impact ? 4 : 0), angle);
      break;
    }
    case "nova":
      drawPointing(g, weapon, player.x + 1, player.y - 14, -Math.PI / 2 + Math.sin(t * Math.PI * 4) * 0.15);
      break;
  }
}

/** Slash arcs, thrust streaks and rings for the running attack. */
export function drawAttackFx(g: CanvasRenderingContext2D, player: Player, a: ActiveAttack): void {
  const t = Math.min(1, a.age / a.duration);
  const [light, tint] = FX_COLORS[a.weapon.rarity];
  const cx = player.x;
  const cy = player.y - 6;
  const range = a.weapon.range;
  g.save();
  switch (a.weapon.style) {
    case "swing": {
      // The trail covers from where the swing started to where the blade is now.
      const start = a.aim - a.sweep * SWING_HALF_ARC;
      const now = a.aim + a.sweep * SWING_HALF_ARC * (2 * easeOut(t) - 1);
      g.globalAlpha = 0.9 * (1 - t * 0.7);
      pixelArc(g, cx, cy, range - 2, start, now, tint);
      pixelArc(g, cx, cy, range - 4, start, now, light);
      pixelArc(g, cx, cy, range - 6, start + (now - start) * 0.35, now, light);
      break;
    }
    case "thrust": {
      // three dotted speed streaks along the jab
      g.globalAlpha = 0.8 * Math.sin(Math.PI * t);
      const ux = Math.cos(a.aim);
      const uy = Math.sin(a.aim);
      for (const side of [-3, 0, 3]) {
        g.fillStyle = side === 0 ? light : tint;
        const len = range * (side === 0 ? 0.9 : 0.6);
        for (let d = 8; d < len; d += 2) g.fillRect(Math.round(cx + ux * d - uy * side), Math.round(cy + uy * d + ux * side), 1, 1);
      }
      break;
    }
    case "slam": {
      const impact = STYLE_TIMING.slam.hitFrom;
      if (t < impact) break;
      const k = (t - impact) / (1 - impact);
      const sx = player.x + Math.cos(a.aim) * range * SLAM_REACH;
      const sy = player.y - 4 + Math.sin(a.aim) * range * SLAM_REACH;
      g.globalAlpha = 1 - k;
      pixelArc(g, sx, sy, range * 0.75 * easeOut(k), 0, Math.PI * 2, tint, 0.55);
      pixelArc(g, sx, sy, range * 0.75 * easeOut(k) - 2, 0, Math.PI * 2, light, 0.55);
      break;
    }
    case "nova": {
      const r = range * t;
      g.globalAlpha = 1 - t * 0.6;
      pixelArc(g, cx, cy + 2, r, 0, Math.PI * 2, tint, 0.6);
      pixelArc(g, cx, cy + 2, Math.max(0, r - 2), 0, Math.PI * 2, light, 0.6);
      break;
    }
    default:
      break;
  }
  g.restore();
}

/**
 * Plots a 1-px-wide arc of radius `r` from angle a0 to a1 as crisp squares.
 * `squash` < 1 flattens it vertically (rings on the ground look like ellipses).
 */
export function pixelArc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, a0: number, a1: number, color: string, squash = 1): void {
  if (r <= 0) return;
  g.fillStyle = color;
  const steps = Math.max(4, Math.ceil(Math.abs(a1 - a0) * r * 1.2));
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * squash), 1, 1);
  }
}

/** Interpolates between two angles the short way round. */
function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
