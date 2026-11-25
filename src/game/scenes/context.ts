/**
 * The SCENE CONTEXT: everything a scene's entities need, in one object.
 *
 * Each scene (overworld, one dungeon visit) gets a fresh context holding its
 * own map, particles, pickups, projectiles and camera, plus `game` — the
 * game-wide services (save, audio, hero...). Entities receive the context
 * instead of importing globals, which keeps them easy to test and lets the
 * monster code (added later) use exactly the same helpers:
 *
 *   ctx.isSolid(px, py)        is this world pixel blocked?
 *   ctx.spawnCoins(x, y, n)    pop coins out (combo bonus included)
 *   ctx.spawnHeart(x, y)       pop a heart out
 *   ctx.particles / floatText / shake / hitStop   game-feel helpers
 *   ctx.hittables              everything attacks can hit
 *   ctx.petPerk                the equipped pet's perk ("lucky" → +coins)
 */
import { VIEW_H, VIEW_W, type AudioApi, type GameEvent } from "../bridge";
import { Camera } from "../engine/camera";
import { TILE_PX } from "../engine/collision";
import { Juice, type FloatStyle } from "../engine/juice";
import { Particles } from "../engine/particles";
import { Pickups } from "../entities/pickups";
import { Projectiles } from "../combat/projectiles";
import type { Hittable } from "../combat/hittable";
import type { GameServices } from "../services";
import type { PetPerk } from "@/lib/game/catalog";
import type { PlayerStats } from "@/lib/game";
import type { RepoAnalysis, SaveData, Store, TileMap } from "@/lib/types";

export class SceneContext {
  readonly camera = new Camera(VIEW_W, VIEW_H);
  readonly particles = new Particles();
  readonly juice = new Juice();
  readonly hittables = new Set<Hittable>();
  readonly pickups: Pickups;
  readonly projectiles: Projectiles;
  /** Seconds of (unpaused) simulation since the scene was created. Drives animations. */
  time = 0;
  /** Terrain + building footprints + solid props; breakables clear their tile when broken. */
  private readonly blocked: Uint8Array;

  constructor(
    readonly game: GameServices,
    readonly map: TileMap,
  ) {
    this.blocked = map.solid.slice();
    this.camera.setBounds(map.width * TILE_PX, map.height * TILE_PX);
    this.pickups = new Pickups(this);
    this.projectiles = new Projectiles(this);
  }

  // ───────────── collision ─────────────

  /** Tiles outside the map count as solid, so nothing can walk off the edge. */
  isSolidTile = (tx: number, ty: number): boolean => {
    if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return true;
    return this.blocked[ty * this.map.width + tx] === 1;
  };

  /** Is the world pixel (px, py) inside a blocked tile? */
  isSolid(px: number, py: number): boolean {
    return this.isSolidTile(Math.floor(px / TILE_PX), Math.floor(py / TILE_PX));
  }

  setBlocked(tx: number, ty: number, solid: boolean): void {
    if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return;
    this.blocked[ty * this.map.width + tx] = solid ? 1 : 0;
  }

  // ───────────── shortcuts to the game services ─────────────

  get save(): Store<SaveData> {
    return this.game.save;
  }

  get audio(): AudioApi {
    return this.game.audio;
  }

  get analysis(): RepoAnalysis {
    return this.game.analysis;
  }

  get repoKey(): string {
    return this.game.repoKey;
  }

  get stats(): PlayerStats {
    return this.game.stats();
  }

  /** The equipped pet's perk, or null. Monster drops add 1–2 coins when this is "lucky". */
  get petPerk(): PetPerk | null {
    return this.game.stats().petPerk;
  }

  emit(event: GameEvent): void {
    this.game.emit(event);
  }

  // ───────────── game feel ─────────────

  /** Pops `count` coins out of (x, y). The current combo multiplies the count. */
  spawnCoins(x: number, y: number, count: number): void {
    this.pickups.spawnCoins(x, y, count * this.game.combo.coinMultiplier());
  }

  spawnHeart(x: number, y: number): void {
    this.pickups.spawnHeart(x, y);
  }

  floatText(x: number, y: number, text: string, style: FloatStyle = "info"): void {
    this.juice.floatText(x, y, text, style);
  }

  /** Screen shake (0–1). Ignored when the player turned shake off in the settings. */
  shake(amount: number): void {
    this.camera.shake(amount);
  }

  /** Freezes the action for a split second so a hit feels weighty. */
  hitStop(ms: number): void {
    this.juice.hitStop(ms);
  }
}
