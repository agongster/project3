/**
 * The MONSTER DIRECTOR: runs every monster of one dungeon visit. The dungeon
 * scene owns one and calls it each step (see scenes/monsterDirector.ts for
 * the interface).
 *
 * Each step:
 *   1. refresh what the monsters may see (hero position, grace period)
 *   2. noticing / forgetting the hero (engagement.ts: max 3 pursuers, one boss at a time)
 *   3. boss intros (bossShow.ts)
 *   4. each living monster thinks and moves (a dazed one waits to be finished,
 *      dazed.ts); defeated ones play their death (deaths.ts)
 *   5. separation, contact damage, landing hazards
 *   6. keep `ctx.hittables` in sync (an invisible phantom cannot be hit)
 *
 * Each monster may have a TRAIT that makes it behave like its bug (traits/):
 * a rune for the Phantom, an echo for the Echo Bat, a tag left behind... The
 * director builds them (createBodies), draws their floor marks, overlays and
 * left-behind tags, and makes sure a finding with two bodies is still
 * defeated exactly once (traits/oneDefeat.ts).
 *
 * It also draws the monsters, their telegraphs, name tags and badges,
 * reports the HUD's boss bar and how many monsters remain, offers the
 * "finish it with a fix" spots of dazed monsters, and takes the answer.
 */
import { getProgress } from "@/lib/game";
import type { AnalyzedFile, Dungeon } from "@/lib/types";
import type { HudState } from "../../bridge";
import type { SceneContext } from "../../scenes/context";
import { recordFindingDefeated } from "../../scenes/defeat";
import { layoutCarvings } from "../../scenes/floorCodeLayout";
import type { MonsterDirector } from "../../scenes/monsterDirector";
import type { Interactable } from "../../scenes/interactions";
import type { Drawable, Light } from "../../scenes/scene";
import { BossShow } from "./bossShow";
import { BOSS_SLOWMO, bugCardDue, deathDuration, finishDeath, isDeathAnimating, lingerDuration, startDeath, updateDeathFx } from "./deaths";
import { answerFinisher, declineUnanswered, drawFinisherRing, finisherSpot } from "./dazed";
import { applyContactDamage, separate, updateEngagement } from "./engagement";
import { hazardDrawables } from "./hazards";
import type { Monster } from "./monster";
import { drawMonsterBadges, drawMonsterBody, drawMonsterShadow, monsterLight } from "./monsterDraw";
import { NameTags } from "./nameTags";
import { spawnsToCreate } from "./rewards";
import { playPoof, SceneMonsterWorld } from "./sceneWorld";
import { createBodies } from "./traits";
import { dungeonSpotMap, FloorSpots } from "./traits/floorSpots";
import { Leftovers } from "./traits/leftovers";
import { DefeatLedger } from "./traits/oneDefeat";

/** Monsters hold back this long after the hero walks in. */
const ENTRY_GRACE_SEC = 1;
/** …and this long after the hero respawns from fainting. */
const RESPAWN_GRACE_SEC = 1.5;
/** Off-screen monsters within this margin are still drawn (their telegraphs may reach in). */
const DRAW_MARGIN_PX = 48;

/**
 * A boss keeps its bar and its music while it fights, and also while it is
 * dazed: the fight logic counts it as beaten, but the show isn't over yet.
 */
function onStage(m: Monster): boolean {
  return m.alive && (m.engaged || m.dazed);
}

export class Director implements MonsterDirector {
  private monsters: Monster[];
  private readonly world: SceneMonsterWorld;
  private readonly tags = new NameTags();
  private readonly show = new BossShow();
  private readonly ledger = new DefeatLedger();
  private readonly leftovers: Leftovers;
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
    this.leftovers = new Leftovers(ctx);
    const findings = new Map(file.findings.map((f) => [f.id, f]));
    const defeated = getProgress(ctx.save.get(), ctx.repoKey).defeated;
    // Runes and echoes go on free floor of the real map (walls, pots and carvings as they are now).
    const spots = new FloorSpots(dungeonSpotMap(dungeon, (tx, ty) => !ctx.isSolidTile(tx, ty), layoutCarvings(dungeon, file.findings)));
    const setup = { spots, outline: file.outline };
    this.monsters = spawnsToCreate(dungeon.monsters, defeated).flatMap((spawn) => {
      const finding = findings.get(spawn.findingId);
      return finding ? createBodies(spawn, finding, this.world, setup) : [];
    });
    for (const m of this.monsters) ctx.hittables.add(m);
  }

  update(dt: number): void {
    const { ctx, world } = this;
    this.grace = Math.max(0, this.grace - dt);
    world.refresh(this.grace);
    declineUnanswered(this.monsters);
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
    this.leftovers.update(dt);
    this.monsters = this.monsters.filter((m) => m.alive || m.dyingFor < deathDuration(m) + lingerDuration(m));
  }

  drawables(out: Drawable[]): void {
    // Trait floor marks (a rune can lie a few tiles from its monster, so they skip the camera check).
    for (const m of this.monsters) {
      if (m.alive && m.trait?.drawFloor) out.push({ y: m.y, shadow: (g) => m.trait?.drawFloor?.(g, m, this.ctx.time), draw: () => {} });
    }
    for (const m of this.monsters) {
      if (!m.alive && !isDeathAnimating(m)) continue;
      if (!this.ctx.camera.sees(m.x - DRAW_MARGIN_PX, m.y - DRAW_MARGIN_PX * 1.5, DRAW_MARGIN_PX * 2, DRAW_MARGIN_PX * 2)) continue;
      const death = deathDuration(m);
      out.push({
        y: m.y,
        shadow: (g) => {
          if (m.dazed) drawFinisherRing(g, m, this.ctx.time);
          else if (m.alive) m.brain.drawFloor?.(g, m);
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
      if (m.alive) m.trait?.lights?.(m, out);
    }
  }

  overlay(g: CanvasRenderingContext2D): void {
    this.tags.draw(g);
    for (const m of this.monsters) {
      drawMonsterBadges(g, m, this.ctx.time);
      if (m.alive) m.trait?.drawOverlay?.(g, m, this.ctx.time);
    }
    this.leftovers.draw(g);
    this.show.draw(g, this.ctx);
  }

  /** Findings still standing (an echo bat and its echo count once). */
  remaining(): number {
    return new Set(this.monsters.map((m) => m.finding.id)).size;
  }

  boss(): HudState["boss"] {
    const b = this.monsters.find((m) => m.isBoss && onStage(m));
    return b ? { name: b.def.name, hp: b.hp, maxHp: b.maxHp } : null;
  }

  timeScale(): number {
    return this.monsters.some((m) => (m.isBoss || m.criticalFix) && isDeathAnimating(m)) ? BOSS_SLOWMO : 1;
  }

  interactables(): Interactable[] {
    return this.monsters.filter((m) => m.dazed).map((m) => finisherSpot(this.ctx, m));
  }

  resolveFinisher(findingId: string, correct: boolean): void {
    answerFinisher(this.monsters, findingId, correct);
  }

  onPlayerFainted(): void {
    // A dazed monster was beaten all the same: it goes down instead of starting over.
    for (const m of this.monsters) if (m.dazed) m.collapse();
    for (const m of this.monsters) if (m.alive) m.resetForRetry();
    this.world.hazards.clear();
    this.ctx.projectiles.clearHostile();
    this.show.cancel(this.ctx);
    this.introduced.clear();
    this.tags.clear();
    this.leftovers.clear();
    this.grace = RESPAWN_GRACE_SEC;
  }

  destroy(): void {
    // A monster still dazed or squashing when the hero walks out was beaten all the same
    // (but not the first body of a pair to fall: its partner still stands).
    for (const m of this.monsters) {
      const unrecorded = m.dazed || (!m.alive && m.dyingFor < deathDuration(m) && this.ledger.reward(m).pays);
      if (unrecorded) recordFindingDefeated(this.ctx, m.finding, 0, m.criticalFix);
    }
    for (const m of this.monsters) this.ctx.hittables.delete(m);
    this.world.hazards.clear();
    this.leftovers.clear();
    this.monsters = [];
  }

  // ───────────── internals ─────────────

  /** Boss intro when a boss starts fighting; back to the dungeon tune if it loses the hero. */
  private introduceBosses(): void {
    for (const m of this.monsters) {
      if (!m.isBoss) continue;
      if (m.alive && m.engaged && !this.introduced.has(m)) {
        this.introduced.add(m);
        this.show.introduce(this.ctx, m);
      } else if (!onStage(m) && this.introduced.has(m)) {
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
      this.claimDefeat(m);
      startDeath(ctx, m);
    }
    const before = m.dyingFor;
    m.updateDying(dt);
    updateDeathFx(ctx, m, before);
    const end = deathDuration(m);
    if (before < end && m.dyingFor >= end) this.pop(m);
    if (bugCardDue(m, before)) ctx.game.emitPausing({ type: "bugCard", finding: m.finding });
  }

  /** A body starts dying: does it defeat its finding, and does its trait add a bonus? */
  private claimDefeat(m: Monster): void {
    const lastBody = this.ledger.claim(m, this.monsters);
    const coinMultiplier = m.trait?.onDefeat?.(m, this.world, lastBody) ?? 1;
    this.ledger.setReward(m, { pays: lastBody, coinMultiplier });
  }

  /** The pop at the end of the squash: rewards (once per finding) and whatever the trait leaves behind. */
  private pop(m: Monster): void {
    const reward = this.ledger.reward(m);
    finishDeath(this.ctx, m, reward);
    const tag = reward.pays ? m.trait?.leftover?.(m) : null;
    if (tag) this.leftovers.add(tag, m.x, m.y);
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
