/**
 * The MONSTER DIRECTOR: runs every monster of one dungeon visit. The dungeon
 * scene owns one and calls it each step (see scenes/monsterDirector.ts for
 * the interface).
 *
 * Each step:
 *   1. refresh what the monsters may see (hero position, grace period)
 *   2. noticing / forgetting the hero (engagement.ts: max 3 pursuers, one boss at a time)
 *   3. boss intros (bossShow.ts)
 *   4. each living monster thinks and moves; defeated ones play their death (deaths.ts)
 *   5. separation, contact damage, landing hazards
 *   6. keep `ctx.hittables` in sync (an invisible phantom cannot be hit)
 *
 * It also draws the monsters, their telegraphs, name tags and badges, and
 * reports the HUD's boss bar and how many monsters remain.
 */
import { getProgress } from "@/lib/game";
import type { AnalyzedFile, Dungeon } from "@/lib/types";
import type { HudState } from "../../bridge";
import type { SceneContext } from "../../scenes/context";
import { recordFindingDefeated } from "../../scenes/defeat";
import type { MonsterDirector } from "../../scenes/monsterDirector";
import type { Drawable, Light } from "../../scenes/scene";
import { BossShow } from "./bossShow";
import { createBrain } from "./brains";
import { BOSS_SLOWMO, bugCardDue, deathDuration, finishDeath, isDeathAnimating, lingerDuration, startDeath, updateDeathFx } from "./deaths";
import { applyContactDamage, separate, updateEngagement } from "./engagement";
import { hazardDrawables } from "./hazards";
import { Monster } from "./monster";
import { drawMonsterBadges, drawMonsterBody, drawMonsterShadow, monsterLight } from "./monsterDraw";
import { NameTags } from "./nameTags";
import { spawnsToCreate } from "./rewards";
import { playPoof, SceneMonsterWorld } from "./sceneWorld";

/** Monsters hold back this long after the hero walks in. */
const ENTRY_GRACE_SEC = 1;
/** …and this long after the hero respawns from fainting. */
const RESPAWN_GRACE_SEC = 1.5;
/** Off-screen monsters within this margin are still drawn (their telegraphs may reach in). */
const DRAW_MARGIN_PX = 48;

export class Director implements MonsterDirector {
  private monsters: Monster[];
  private readonly world: SceneMonsterWorld;
  private readonly tags = new NameTags();
  private readonly show = new BossShow();
  /** Bosses whose intro already played during this engagement. */
  private readonly introduced = new Set<Monster>();
  private grace = ENTRY_GRACE_SEC;

  constructor(
    private readonly ctx: SceneContext,
    dungeon: Dungeon,
    file: AnalyzedFile,
  ) {
    this.world = new SceneMonsterWorld(ctx, dungeon.entrance);
    this.world.refresh(this.grace);
    const findings = new Map(file.findings.map((f) => [f.id, f]));
    const defeated = getProgress(ctx.save.get(), ctx.repoKey).defeated;
    this.monsters = spawnsToCreate(dungeon.monsters, defeated).flatMap((spawn) => {
      const finding = findings.get(spawn.findingId);
      return finding ? [new Monster(spawn, finding, createBrain(spawn.kind), this.world)] : [];
    });
    for (const m of this.monsters) ctx.hittables.add(m);
  }

  update(dt: number): void {
    const { ctx, world } = this;
    this.grace = Math.max(0, this.grace - dt);
    world.refresh(this.grace);
    this.dropDefeatedElsewhere();
    updateEngagement(this.monsters, world, !ctx.game.player.fainted, dt);
    this.introduceBosses();
    for (const m of this.monsters) {
      if (m.alive) m.update(dt);
      else this.updateDeath(m, dt);
    }
    separate(this.monsters);
    applyContactDamage(this.monsters, world);
    world.hazards.update(dt, world);
    this.syncHittables();
    this.show.update(ctx, dt);
    this.tags.update(dt, this.monsters, world.hero);
    this.monsters = this.monsters.filter((m) => m.alive || m.dyingFor < deathDuration(m) + lingerDuration(m));
  }

  drawables(out: Drawable[]): void {
    for (const m of this.monsters) {
      if (!m.alive && !isDeathAnimating(m)) continue;
      if (!this.ctx.camera.sees(m.x - DRAW_MARGIN_PX, m.y - DRAW_MARGIN_PX * 1.5, DRAW_MARGIN_PX * 2, DRAW_MARGIN_PX * 2)) continue;
      const death = deathDuration(m);
      out.push({
        y: m.y,
        shadow: (g) => {
          if (m.alive) m.brain.drawFloor?.(g, m);
          drawMonsterShadow(g, m);
        },
        draw: (g) => drawMonsterBody(g, m, death),
      });
    }
    hazardDrawables(this.world.hazards, this.ctx.time, out);
  }

  lights(out: Light[]): void {
    for (const m of this.monsters) {
      const light = monsterLight(m);
      if (light) out.push(light);
    }
  }

  overlay(g: CanvasRenderingContext2D): void {
    this.tags.draw(g);
    for (const m of this.monsters) drawMonsterBadges(g, m, this.ctx.time);
    this.show.draw(g, this.ctx);
  }

  remaining(): number {
    return this.monsters.length;
  }

  boss(): HudState["boss"] {
    const b = this.monsters.find((m) => m.isBoss && m.alive && m.engaged);
    return b ? { name: b.def.name, hp: b.hp, maxHp: b.maxHp } : null;
  }

  timeScale(): number {
    return this.monsters.some((m) => m.isBoss && isDeathAnimating(m)) ? BOSS_SLOWMO : 1;
  }

  onPlayerFainted(): void {
    for (const m of this.monsters) if (m.alive) m.resetForRetry();
    this.world.hazards.clear();
    this.ctx.projectiles.clearHostile();
    this.show.cancel(this.ctx);
    this.introduced.clear();
    this.tags.clear();
    this.grace = RESPAWN_GRACE_SEC;
  }

  destroy(): void {
    // A monster still squashing when the hero walks out was beaten all the same.
    for (const m of this.monsters) if (!m.alive && m.dyingFor < deathDuration(m)) recordFindingDefeated(this.ctx, m.finding, 0);
    for (const m of this.monsters) this.ctx.hittables.delete(m);
    this.world.hazards.clear();
    this.monsters = [];
  }

  // ───────────── internals ─────────────

  /** Boss intro when a boss starts fighting; back to the dungeon tune if it loses the hero. */
  private introduceBosses(): void {
    for (const m of this.monsters) {
      if (!m.isBoss) continue;
      const fighting = m.alive && m.engaged;
      if (fighting && !this.introduced.has(m)) {
        this.introduced.add(m);
        this.show.introduce(this.ctx, m);
      } else if (!fighting && this.introduced.has(m)) {
        this.introduced.delete(m);
        // (A defeated boss changes the music itself, in its big burst.)
        if (m.alive) this.show.cancel(this.ctx);
      }
    }
  }

  private updateDeath(m: Monster, dt: number): void {
    const { ctx } = this;
    if (m.dyingFor === 0) {
      ctx.hittables.delete(m);
      this.world.hazards.removeOwnedBy(m);
      startDeath(ctx, m);
    }
    const before = m.dyingFor;
    m.updateDying(dt);
    updateDeathFx(ctx, m, before);
    const end = deathDuration(m);
    if (before < end && m.dyingFor >= end) finishDeath(ctx, m);
    if (bugCardDue(m, before)) ctx.game.emitPausing({ type: "bugCard", finding: m.finding });
  }

  /** Only monsters that can be hit right now are in `ctx.hittables` (invisible phantoms are not). */
  private syncHittables(): void {
    for (const m of this.monsters) {
      if (m.alive && m.targetable) this.ctx.hittables.add(m);
      else this.ctx.hittables.delete(m);
    }
  }

  /**
   * Keeps the scene in step with the save: a monster whose finding was
   * recorded as defeated some other way (the dev page's `defeatAll`) just
   * poofs away, so the dungeon can still purify.
   */
  private dropDefeatedElsewhere(): void {
    const defeated = getProgress(this.ctx.save.get(), this.ctx.repoKey).defeated;
    if (defeated.length === 0) return;
    const gone = this.monsters.filter((m) => m.alive && defeated.includes(m.finding.id));
    for (const m of gone) {
      this.ctx.hittables.delete(m);
      playPoof(this.ctx, m.x, m.y - 8);
    }
    if (gone.length > 0) this.monsters = this.monsters.filter((m) => !gone.includes(m));
  }
}
