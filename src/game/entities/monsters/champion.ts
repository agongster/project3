/**
 * CHAMPIONS in the dungeon. A champion is its dungeon's toughest monster
 * made a mini-boss (which one: championOf in src/lib/game/champions.ts; its
 * health, size and drops: CHAMPION_STATS there and its body plan in
 * variety.ts). It keeps its species and brain (with one move sharpened, see
 * brains.ts) and gets the boss treatment, a size smaller:
 *
 *   - a roar and a short pause when it notices the hero, a banner with its
 *     name and the bug it stands for, and the boss tune (director.ts, bossShow.ts)
 *   - the HUD's boss bar (director.ts)
 *   - a gold crown on its head and a bigger glow (this file, monsterDraw.ts)
 *   - a grand death in slow motion and better drops (deaths.ts)
 *
 * It gets no arena: it fights in whatever room the dungeon gave it.
 */
import { championCrownSprite, CROWN_FRAMES, drawSprite } from "@/game/art";
import { championTitle } from "@/lib/game/champions";
import type { FileOutline } from "@/lib/types";
import { VIEW_W } from "../../bridge";
import { fitLabel } from "../../ui/treemap";
import type { MonsterWorld } from "./brain";
import type { Monster } from "./monster";
import { headY } from "./monsterDraw";
import { tagText } from "./nameTags";

/** It stands and roars this long when it notices the hero, so the banner can be read. */
export const CHAMPION_ROAR_SEC = 0.9;
/** Its roar is the boss roar, pitched up (a smaller beast). */
const ROAR_PITCH = 1.3;
const ROAR_SHAKE = 0.25;
/** The camera eases toward it for this long (a boss: BOSS_INTRO_SEC). */
export const CHAMPION_FOCUS_SEC = 0.8;
/** The crown bobs this many px, glinting every CROWN_GLINT_SEC. */
const CROWN_BOB_PX = 1;
const CROWN_GLINT_SEC = 0.4;
/** The banner's subtitle may use the screen width minus this margin. */
const BANNER_MARGIN_PX = 24;

/** The banner a champion shows when it notices the hero: "CHAMPION GREMLIN" over "of take_order() · Likely bug · L12". */
export function championBanner(m: Monster, outline: FileOutline): { title: string; subtitle: string } {
  const { title, of } = championTitle(m.finding, outline);
  const subtitle = of ? `of ${of} · ${tagText(m.finding)}` : tagText(m.finding);
  return { title: title.toUpperCase(), subtitle: fitLabel(subtitle, VIEW_W - BANNER_MARGIN_PX) };
}

/** The champion's roar: it stands still for CHAMPION_ROAR_SEC while the banner slides in. */
export function roar(m: Monster, world: MonsterWorld): void {
  m.stun = CHAMPION_ROAR_SEC;
  m.stretch = 0.3;
  world.fx.sfx("bossRoar", { pitch: ROAR_PITCH });
  world.fx.shake(ROAR_SHAKE);
}

/** The gold crown sitting on a champion's head (drawn above the darkness, like the badges). */
export function drawChampionCrown(g: CanvasRenderingContext2D, m: Monster, time: number): void {
  if (!m.champion || !m.alive || m.alpha < 0.3) return;
  const frame = Math.floor(time / CROWN_GLINT_SEC) % CROWN_FRAMES;
  const bob = Math.round(Math.sin(time * 3) * CROWN_BOB_PX);
  drawSprite(g, championCrownSprite(frame), Math.round(m.x), Math.round(headY(m)) + 3 + bob);
}
