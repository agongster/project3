/**
 * A dungeon: the inside of a cursed file. Built on demand from
 * `options.makeDungeon(path)` each time the hero walks in.
 *
 * The scene handles the map (floor, walls, torches with flickering light,
 * pots and crates to smash), the exit doormat, fainting, and the reward
 * chest that appears once the dungeon is cleared. Monsters are delegated to
 * a MonsterDirector (see monsterDirector.ts).
 */
import { DUNGEON, drawSprite } from "@/game/art";
import { uiSprite } from "@/game/art/ui";
import { getProgress, isDungeonCleared, recordDungeonCleared } from "@/lib/game";
import type { AnalyzedFile, Dungeon, Prop } from "@/lib/types";
import { VIEW_H, VIEW_W } from "../bridge";
import { Ambient } from "../engine/ambient";
import { Lighting } from "../engine/lighting";
import { GroundRenderer } from "../engine/tiles";
import { breakableDrawables, createBreakables, BREAKABLE_KINDS, type Breakable } from "../entities/breakables";
import { propDrawables, propLights } from "../entities/scenery";
import type { GameServices } from "../services";
import { SceneContext } from "./context";
import { nearestInteractable, propInteractable, type Interactable } from "./interactions";
import { createMonsterDirector, type MonsterDirector } from "./monsterDirector";
import type { Drawable, Light, Scene } from "./scene";
import { FaintSequence, heroLight, renderShared, updateShared } from "./world";

const DARKNESS = { color: "#0b0716", alpha: 0.5 };
const VIGNETTE = { color: "#0b0716", alpha: 0.55 };
const EXIT_LIGHT = { radius: 30, color: "#ffe08a" };
const CHEST_LIGHT = { radius: 26, color: "#ffd36b" };

export class DungeonScene implements Scene {
  readonly kind = "dungeon";
  readonly ctx: SceneContext;
  readonly dungeon: Dungeon;
  private readonly file: AnalyzedFile;
  private readonly ground: GroundRenderer;
  private readonly scenery: Prop[];
  private readonly breakables: Breakable[];
  private readonly director: MonsterDirector;
  private readonly interactables: Interactable[];
  private readonly lighting = new Lighting();
  private readonly ambient = new Ambient(VIEW_W, VIEW_H);
  private readonly faint = new FaintSequence();
  /** True once every monster is gone (the chest is out). */
  private cleared: boolean;
  private chestOpenedAtResume = false;
  private leaving = false;

  constructor(
    private readonly game: GameServices,
    readonly path: string,
  ) {
    const file = game.analysis.files.find((f) => f.path === path);
    if (!file) throw new Error(`No analyzed file for dungeon ${path}`);
    this.file = file;
    this.dungeon = game.options.makeDungeon(path);
    const ctx = (this.ctx = new SceneContext(game, this.dungeon));
    this.ground = new GroundRenderer(this.dungeon);
    this.scenery = this.dungeon.props.filter((p) => !BREAKABLE_KINDS.has(p.kind));
    for (const p of this.scenery) if (p.solid) ctx.setBlocked(p.x, p.y, true);
    this.breakables = createBreakables(ctx, this.dungeon.props, () => false);
    this.director = createMonsterDirector(ctx, this.dungeon, file);
    this.cleared = isDungeonCleared(file, getProgress(game.save.get(), game.repoKey));
    if (this.cleared) this.placeChest();
    this.interactables = [
      ...this.scenery.map((p) => propInteractable(ctx, p)).filter((i): i is Interactable => i !== null),
      this.exitInteractable(),
      this.chestInteractable(),
    ];
  }

  enter(): void {
    const { ctx, game, dungeon } = this;
    game.player.placeAtTile(dungeon.entrance.x, dungeon.entrance.y, "right");
    game.pet.placeNear(game.player.x, game.player.y);
    ctx.camera.centerOn(game.player.x, game.player.y);
    this.ambient.setKind("dust", DUNGEON.ambient);
    game.audio.music("dungeon");
    this.patchHud();
  }

  update(dt: number): void {
    const { ctx, game } = this;
    if (game.input.pressed("menu")) return game.emitPausing({ type: "menu" });
    if (game.input.pressed("map")) game.emit({ type: "toast", text: "No maps down here — find the glowing exit to leave.", tone: "info" });
    if (!updateShared(ctx, dt)) return;
    this.director.update(dt);
    this.ambient.update(dt);
    this.faint.update(dt, ctx, () => this.respawn());
    if (!this.cleared && this.director.remaining() === 0) this.onCleared();
    this.checkExit();
    const current = game.player.fainted ? null : nearestInteractable(ctx, this.interactables);
    game.hud.patch({ prompt: current ? current.prompt() : null });
    if (current && game.input.pressed("interact")) current.activate();
    this.patchHud();
  }

  render(g: CanvasRenderingContext2D): void {
    const { ctx, game, dungeon } = this;
    const theme = game.theme();
    const visible = (x: number, y: number) => ctx.camera.sees(x - 32, y - 48, 64, 64);
    const drawables: Drawable[] = [];
    propDrawables(this.scenery, theme, ctx.time, game.player, visible, drawables);
    breakableDrawables(this.breakables, theme, drawables, visible);
    if (this.cleared) drawables.push(this.chestDrawable());
    this.director.drawables(drawables);

    const lights: Light[] = [];
    propLights(this.scenery, true, ctx.time, visible, lights);
    lights.push({ ...EXIT_LIGHT, x: dungeon.exit.x * 16 + 8, y: dungeon.exit.y * 16 + 8 });
    if (this.cleared) lights.push({ ...CHEST_LIGHT, x: dungeon.chest.x * 16 + 8, y: dungeon.chest.y * 16 + 8 });
    heroLight(ctx, lights);
    this.director.lights(lights);

    renderShared(ctx, g, {
      backdrop: DUNGEON.backdrop,
      ground: this.ground,
      drawables,
      lights,
      darkness: DARKNESS,
      tint: null,
      vignette: VIGNETTE,
      lighting: this.lighting,
      ambient: this.ambient,
    });
  }

  onResume(): void {
    // Celebrate the moment the prize chest comes back opened.
    const opened = this.chestOpened();
    if (opened && !this.chestOpenedAtResume && this.cleared) {
      const cx = this.dungeon.chest.x * 16 + 8;
      const cy = this.dungeon.chest.y * 16 + 12;
      this.ctx.particles.burst(16, cx, cy, 50, { life: 0.9, sprite: uiSprite("sparkle", 0), drag: 2.5 });
    }
    this.chestOpenedAtResume = opened;
  }

  destroy(): void {
    this.director.destroy();
    this.ctx.particles.clear();
    this.ctx.hittables.clear();
  }

  // ───────────── clearing & the prize chest ─────────────

  private onCleared(): void {
    const { ctx, game } = this;
    this.cleared = true;
    game.save.set((save) => recordDungeonCleared(save, game.repoKey, this.path));
    ctx.audio.sfx("purify");
    ctx.juice.flash("#ffffff", 0.5, 0.5);
    ctx.emit({ type: "purified", path: this.path });
    this.placeChest();
    const cx = this.dungeon.chest.x * 16 + 8;
    const cy = this.dungeon.chest.y * 16 + 12;
    ctx.particles.emit({ x: cx, y: cy, life: 0.4, sprite: uiSprite("poof", 0) });
    ctx.particles.burst(20, cx, cy, 60, { life: 1, sprite: uiSprite("star", 0), drag: 2 });
  }

  private placeChest(): void {
    const { chest } = this.dungeon;
    this.ctx.setBlocked(chest.x, chest.y, true);
    this.chestOpenedAtResume = this.chestOpened();
  }

  private chestOpened(): boolean {
    return getProgress(this.game.save.get(), this.game.repoKey).opened.includes(this.path);
  }

  private chestDrawable(): Drawable {
    const { chest } = this.dungeon;
    const x = chest.x * 16 + 8;
    const y = chest.y * 16 + 15;
    const opened = this.chestOpened();
    const bob = opened ? 0 : Math.round(Math.sin(this.ctx.time * 4) * 1);
    return {
      y,
      shadow: (g) => drawSprite(g, uiSprite("shadowMedium"), x, y),
      draw: (g) => {
        if (!opened) drawSprite(g, uiSprite("chestGlow", Math.floor(this.ctx.time * 6)), x, y);
        drawSprite(g, uiSprite(opened ? "chestOpen" : "chestClosed"), x, y + bob);
      },
    };
  }

  private chestInteractable(): Interactable {
    const { chest } = this.dungeon;
    return {
      x: chest.x * 16 + 8,
      y: chest.y * 16 + 24,
      radius: 14,
      prompt: () => (this.chestOpened() ? "The chest is empty — great job!" : "Open the dungeon's treasure chest"),
      activate: () => {
        if (!this.cleared || this.chestOpened()) return;
        this.game.emitPausing({ type: "chest", source: "dungeon-clear", path: this.path });
      },
    };
  }

  // ───────────── leaving, fainting ─────────────

  private exitInteractable(): Interactable {
    const { exit } = this.dungeon;
    return { x: exit.x * 16 + 8, y: exit.y * 16 + 8, radius: 14, prompt: () => "Leave the dungeon", activate: () => this.leave() };
  }

  /** Stepping onto the glowing doormat leaves the dungeon. */
  private checkExit(): void {
    const p = this.game.player;
    const { exit } = this.dungeon;
    if (Math.floor(p.x / 16) === exit.x && Math.floor((p.y - 3) / 16) === exit.y) this.leave();
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.game.leaveDungeon();
  }

  private respawn(): void {
    const { entrance } = this.dungeon;
    this.director.onPlayerFainted();
    this.game.player.placeAtTile(entrance.x, entrance.y, "right");
    this.game.pet.placeNear(this.game.player.x, this.game.player.y);
    this.ctx.camera.centerOn(this.game.player.x, this.game.player.y);
  }

  private patchHud(): void {
    const remaining = this.cleared ? 0 : this.director.remaining();
    this.game.hud.patch({
      scene: "dungeon",
      location: this.path,
      dungeon: { path: this.path, remaining, total: this.file.findings.length },
      boss: this.director.boss(),
    });
  }
}
