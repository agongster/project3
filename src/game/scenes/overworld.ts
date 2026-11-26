/**
 * The overworld: the village built from the repo.
 *
 * It owns the static world (ground, props, buildings, villagers) and the
 * overworld-only features: building interactions (dungeon doors, treasure
 * chests), file-name labels, the minimap / big map, and the victory check.
 * Everything shared with dungeons (hero, pickups, drawing order, lighting...)
 * comes from world.ts.
 *
 * This scene object lives for the whole game: when the hero visits a
 * dungeon and comes back, broken bushes, coins on the ground and villagers
 * are exactly where they were.
 */
import { getTheme } from "@/lib/game/catalog";
import { THEME_COLORS } from "@/game/art";
import { uiSprite } from "@/game/art/ui";
import { getProgress } from "@/lib/game";
import type { Prop, SaveData } from "@/lib/types";
import { VIEW_H, VIEW_W } from "../bridge";
import { Ambient } from "../engine/ambient";
import { Lighting } from "../engine/lighting";
import { GroundRenderer } from "../engine/tiles";
import { BuildingEntity } from "../entities/buildings";
import { breakableDrawables, createBreakables, BREAKABLE_KINDS, type Breakable } from "../entities/breakables";
import { Villager } from "../entities/npc";
import { propDrawables, propLights } from "../entities/scenery";
import type { GameServices } from "../services";
import { BuildingLabels } from "../ui/labels";
import { MapView } from "../ui/minimap";
import { SceneContext } from "./context";
import { nearestInteractable, propInteractable, type Interactable } from "./interactions";
import { allDungeonsCleared, bugsLeft, shortPath } from "./progressView";
import type { Drawable, Light, Scene } from "./scene";
import { FaintSequence, heroLight, renderShared, updateShared } from "./world";

/** How dark the night theme gets away from lights (0–1). */
const NIGHT_DARKNESS = 0.58;
/** Name shown in the HUD when the hero is between regions. */
const WILDS_NAME = "Countryside";
/** Shown once when the repo has no findings at all (no dungeons, so no victory screen either). */
const ALREADY_PURE_TEXT = "Ruff found no bugs here: this land is already pure! Go open its treasure chests.";

export class OverworldScene implements Scene {
  readonly kind = "overworld";
  readonly ctx: SceneContext;
  private readonly ground: GroundRenderer;
  private readonly buildings: BuildingEntity[];
  private readonly scenery: Prop[];
  private readonly breakables: Breakable[];
  private readonly villagers: Villager[];
  private readonly interactables: Interactable[];
  private readonly labels = new BuildingLabels();
  private readonly mapView: MapView;
  private readonly lighting = new Lighting();
  private readonly ambient = new Ambient(VIEW_W, VIEW_H);
  private readonly faint = new FaintSequence();
  private bigMap = false;
  /** Path of the chest overlay we opened, to celebrate when it comes back opened. */
  private pendingChest: string | null = null;
  /** The save we last derived building states from. */
  private seenSave: SaveData | null = null;
  /** Whether the one-off greeting for a bug-free repo was already considered. */
  private greeted = false;

  constructor(private readonly game: GameServices) {
    const world = game.options.world;
    const ctx = (this.ctx = new SceneContext(game, world));
    this.ground = new GroundRenderer(world);
    const files = new Map(game.analysis.files.map((f) => [f.path, f]));
    this.buildings = world.buildings.map((b) => new BuildingEntity(b, files.get(b.path)));

    this.scenery = world.props.filter((p) => !BREAKABLE_KINDS.has(p.kind));
    for (const p of this.scenery) if (p.solid) ctx.setBlocked(p.x, p.y, true);
    const broken = game.session.brokenBushes;
    const key = (p: Prop) => p.y * world.width + p.x;
    this.breakables = createBreakables(ctx, world.props, (p) => broken.has(key(p)), (b) => broken.add(key(b.prop)));

    this.villagers = world.npcs.map((n) => new Villager(n));
    this.interactables = [
      ...this.buildings.map((b) => this.buildingInteractable(b)),
      ...this.scenery.map((p) => propInteractable(ctx, p)).filter((i): i is Interactable => i !== null),
      ...this.villagers.map((v) => this.villagerInteractable(v)),
    ];
    this.mapView = new MapView(world);
  }

  /** Places the hero at the spawn point, or in front of the building they just left. */
  arriveFrom(path: string | null): void {
    const world = this.game.options.world;
    const building = path ? this.buildings.find((b) => b.path === path) : undefined;
    const tile = building ? building.building.door : world.spawn;
    this.game.player.placeAtTile(tile.x, tile.y, "down");
  }

  enter(): void {
    const { ctx, game } = this;
    game.player.restore(game.stats().maxHp);
    game.pet.placeNear(game.player.x, game.player.y);
    ctx.camera.centerOn(game.player.x, game.player.y);
    game.audio.music("overworld");
    game.hud.patch({ scene: "overworld", dungeon: null, boss: null, prompt: null });
    this.seenSave = null; // re-check buildings and victory on the next step
    for (const b of this.buildings) b.refresh(ctx);
  }

  update(dt: number): void {
    const { ctx, game } = this;
    const input = game.input;
    if (input.pressed("map")) this.bigMap = !this.bigMap;
    if (input.pressed("menu")) {
      if (this.bigMap) this.bigMap = false;
      else return game.emitPausing({ type: "menu" });
    }
    if (this.bigMap) {
      game.hud.patch({ prompt: null });
      return;
    }
    if (!updateShared(ctx, dt)) return;
    this.greetIfAlreadyPure();

    for (const v of this.villagers) {
      v.update(dt, ctx);
      v.pushOut(ctx);
    }
    // Building states only change when the save does, so skip the work otherwise.
    const save = game.save.get();
    if (save !== this.seenSave) {
      this.seenSave = save;
      for (const b of this.buildings) b.refresh(ctx);
      this.checkVictory();
    }
    for (const b of this.buildings) {
      if (ctx.camera.sees(b.x - 40, b.y - 80, 80, 90)) b.emitLife(dt, ctx, game.theme());
    }
    this.labels.update(dt, this.buildings, game.player);
    this.ambient.update(dt);
    this.faint.update(dt, ctx, () => this.arriveFrom(null));
    this.updateInteraction();
    game.hud.patch({ location: this.regionName() });
  }

  render(g: CanvasRenderingContext2D): void {
    const { ctx, game } = this;
    const theme = game.theme();
    const colors = THEME_COLORS[theme];
    const dark = getTheme(theme).dark;
    const hero = game.player;
    const visible = (x: number, y: number) => ctx.camera.sees(x - 40, y - 72, 80, 80);

    const drawables: Drawable[] = [];
    propDrawables(this.scenery, theme, ctx.time, hero, visible, drawables);
    breakableDrawables(this.breakables, theme, drawables, visible);
    for (const b of this.buildings) if (visible(b.x, b.y)) drawables.push(b.drawable(theme, hero));
    for (const v of this.villagers) if (visible(v.x, v.y)) drawables.push(v.drawable());

    const lights: Light[] = [];
    if (dark) {
      propLights(this.scenery, true, ctx.time, visible, lights);
      heroLight(ctx, lights);
    }
    for (const b of this.buildings) if (visible(b.x, b.y)) b.lights(dark, lights);

    this.ambient.setKind(getTheme(theme).ambient, colors.ambient);
    renderShared(ctx, g, {
      backdrop: colors.backdrop,
      ground: this.ground,
      drawables,
      lights,
      darkness: dark ? { color: colors.overlay, alpha: NIGHT_DARKNESS } : null,
      tint: !dark && colors.overlayAlpha > 0 ? { color: colors.overlay, alpha: colors.overlayAlpha } : null,
      vignette: null,
      lighting: this.lighting,
      ambient: this.ambient,
      overlay: (wg) => {
        for (const b of this.buildings) if (visible(b.x, b.y)) b.drawBadge(wg, ctx, theme);
        this.labels.draw(wg, theme);
      },
    });

    if (this.bigMap) this.mapView.drawBig(g, VIEW_W, VIEW_H, theme, this.buildings, hero, ctx.time);
    else this.mapView.drawMini(g, VIEW_W, theme, this.buildings, hero, ctx.time);
  }

  onResume(): void {
    const path = this.pendingChest;
    this.pendingChest = null;
    if (!path || !getProgress(this.ctx.save.get(), this.ctx.repoKey).opened.includes(path)) return;
    const b = this.buildings.find((x) => x.path === path);
    if (!b) return;
    const ctx = this.ctx;
    for (let i = 0; i < 18; i++) {
      ctx.particles.emit({ x: b.x + (Math.random() - 0.5) * 30, y: b.y, z: 6 + Math.random() * 30, vz: 20 + Math.random() * 30, gravity: 30, life: 1 + Math.random() * 0.6, sprite: uiSprite(i % 3 === 0 ? "star" : "sparkle", i), delay: i * 0.03 });
    }
  }

  destroy(): void {
    this.ctx.particles.clear();
  }

  // ───────────── interactions ─────────────

  private updateInteraction(): void {
    const { ctx, game } = this;
    const current = game.player.fainted ? null : nearestInteractable(ctx, this.interactables);
    game.hud.patch({ prompt: current ? current.prompt() : null });
    if (current && game.input.pressed("interact")) current.activate();
  }

  private buildingInteractable(b: BuildingEntity): Interactable {
    return { x: b.doorX, y: b.doorY, radius: 11, prompt: () => this.buildingPrompt(b), activate: () => this.useBuilding(b) };
  }

  private buildingPrompt(b: BuildingEntity): string {
    const name = shortPath(b.path, 28);
    const grade = b.file?.quality.grade ?? "C";
    switch (b.status) {
      case "cursed": {
        const n = b.file ? bugsLeft(this.ctx.save.get(), this.ctx.repoKey, b.file) : 0;
        return `Enter ${name} — ${n} ${n === 1 ? "bug" : "bugs"} lurking`;
      }
      case "treasure":
        return `Open the treasure of ${name} (grade ${grade})`;
      case "claimable":
        return `Claim the prize of ${name}`;
      case "done":
        return `Visit ${name}`;
    }
  }

  private useBuilding(b: BuildingEntity): void {
    const game = this.game;
    switch (b.status) {
      case "cursed":
        game.enterDungeon(b.path);
        return;
      case "treasure":
      case "claimable":
        this.pendingChest = b.path;
        game.emitPausing({ type: "chest", source: b.status === "treasure" ? "clean-file" : "dungeon-clear", path: b.path });
        return;
      case "done": {
        const cleanFile = !b.file || b.file.findings.length === 0;
        const detail = cleanFile ? `grade ${b.file?.quality.grade ?? "C"}` : "purified";
        game.emit({ type: "toast", text: `${b.path} — ${detail}, treasure claimed ✓`, tone: "good" });
        return;
      }
    }
  }

  private villagerInteractable(v: Villager): Interactable {
    const game = this.game;
    return {
      get x() {
        return v.x;
      },
      get y() {
        return v.y + 4;
      },
      radius: 20,
      prompt: () => `Talk to ${v.spawn.name}`,
      activate: () => {
        v.faceToward(game.player.x, game.player.y);
        game.emitPausing({ type: "dialog", speaker: v.spawn.name, lines: v.spawn.lines });
      },
    };
  }

  // ───────────── misc ─────────────

  private regionName(): string {
    const p = this.game.player;
    const tx = Math.floor(p.x / 16);
    const ty = Math.floor(p.y / 16);
    const region = this.game.options.world.regions.find((r) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h);
    return region?.name ?? WILDS_NAME;
  }

  /**
   * A repo without a single finding has no dungeons and so no victory to
   * win: say so once, on the first step, and point at the treasure instead.
   */
  private greetIfAlreadyPure(): void {
    if (this.greeted) return;
    this.greeted = true;
    if (this.game.analysis.stats.findingCount > 0) return;
    this.game.emit({ type: "toast", text: ALREADY_PURE_TEXT, tone: "good" });
  }

  private checkVictory(): void {
    const { game } = this;
    if (game.session.victoryShown || !allDungeonsCleared(game.save.get(), game.repoKey, game.analysis)) return;
    game.session.victoryShown = true;
    game.emitPausing({ type: "victory" });
  }
}
