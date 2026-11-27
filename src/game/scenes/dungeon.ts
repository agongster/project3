/**
 * A dungeon: the inside of a cursed file. Built on demand from
 * `options.makeDungeon(path)` each time the hero walks in.
 *
 * The scene handles the map (floor, walls, torches with flickering light,
 * pots and crates to smash), the exit doormat, fainting, and its two
 * endings (SPEC.md F1): once the last monster is subdued the dungeon goes
 * QUIET (a banner and calmer music; each beaten monster's wisp dozes over
 * its glowing line, where E opens the Workshop, see floorCode.ts); once the
 * file has no bug left it is PURIFIED (a sparkle wave turns the cursed
 * purple torch light warm, see dungeonCleanse.ts, and the prize chest drops
 * in with a bobbing arrow). Monsters are delegated to a MonsterDirector
 * (see monsterDirector.ts). The end door in the last room,
 * a second way out once the dungeon is quiet, is its own module
 * (dungeonEndDoor.ts).
 *
 * When the file is edited in the Workshop while the hero is inside, the
 * engine calls `follow`; once the game runs again the dungeon RE-FORMS
 * (dungeonReform.ts): fixed and ignored monsters dissolve, and the room
 * stays exactly as it is while it still has something to do. It is
 * purified on the spot when the file has no bug left, and rebuilt from the
 * new code only once it is done and the file has more bugs.
 */
import { DUNGEON } from "@/game/art";
import { getProgress, isDungeonPurified, isDungeonQuiet, recordDungeonQuiet } from "@/lib/game";
import { locationLabel } from "@/lib/worldgen";
import type { AnalyzedFile, Dungeon, Prop } from "@/lib/types";
import { VIEW_H, VIEW_W } from "../bridge";
import { Ambient } from "../engine/ambient";
import { Lighting } from "../engine/lighting";
import { GroundRenderer } from "../engine/tiles";
import { breakableDrawables, createBreakables, BREAKABLE_KINDS, type Breakable } from "../entities/breakables";
import { propDrawables, propLights } from "../entities/scenery";
import type { GameServices } from "../services";
import { Caption } from "../ui/caption";
import { SceneContext } from "./context";
import { nearestInteractable, propInteractable, type Interactable } from "./interactions";
import { PrizeChest } from "./dungeonChest";
import { drawRoomNames, plaqueInteractable, roomLineAt } from "./dungeonRooms";
import { Cleanse } from "./dungeonCleanse";
import { EndDoor } from "./dungeonEndDoor";
import { REFORM_SEC, WALK_OUT_CAPTION, WALK_OUT_SEC, followEdit, nextWaveCaption, reformCaption, reformOutcome, settledCaption, type ReformOutcome } from "./dungeonReform";
import { FloorCode } from "./floorCode";
import { createMonsterDirector, type MonsterDirector } from "./monsterDirector";
import type { Drawable, Light, Scene } from "./scene";
import { FaintSequence, heroLight, renderShared, updateShared } from "./world";
import type { HeroSituation } from "./workshopTarget";

const DARKNESS_COLOR = "#0b0716";
const VIGNETTE = { color: "#0b0716", alpha: 0.55 };
const EXIT_LIGHT = { radius: 30, color: "#ffe08a" };
/** Floating dust becomes these sparkles once the dungeon is purified. */
const PURIFIED_AMBIENT = ["#fff6a9", "#ffd36b", "#ffffff"];
const FAINT_MESSAGE = "You fainted — the bugs didn't move. Try again!";
/** While the room re-forms, this many shimmer sparkles rise from random floor spots each step. */
const SHIMMER_PER_STEP = 2;
const SHIMMER_COLORS = ["#bffcff", "#8affff", "#ffffff"];

export class DungeonScene implements Scene {
  readonly kind = "dungeon";
  readonly ctx: SceneContext;
  readonly dungeon: Dungeon;
  private readonly ground: GroundRenderer;
  private readonly scenery: Prop[];
  /** Torches are lit separately: their light shows whether the dungeon is still cursed. */
  private readonly torches: Prop[];
  private readonly otherScenery: Prop[];
  private readonly breakables: Breakable[];
  private readonly director: MonsterDirector;
  private readonly interactables: Interactable[];
  private readonly lighting = new Lighting();
  private readonly ambient = new Ambient(VIEW_W, VIEW_H);
  private readonly faint = new FaintSequence(FAINT_MESSAGE);
  private readonly cleanse: Cleanse;
  /** Each monster's line of code carved into the floor where it starts, and its wisp once subdued (floorCode.ts). */
  private readonly floorCode: FloorCode;
  /** True once no monster is left to fight (every one subdued). */
  private quiet: boolean;
  /** True once the file has no bug left (the chest is out). */
  private purified: boolean;
  private readonly chest: PrizeChest;
  private readonly endDoor: EndDoor;
  private leaving = false;
  /** Says on screen why the dungeon just changed. */
  private readonly caption = new Caption();
  /** The edited file and the ids of its findings fixed for real or sealed, waiting for the game to run again. */
  private pending: { file: AnalyzedFile; fixedIds: Set<string>; sealedIds: Set<string> } | null = null;
  /** The re-forming in progress (see dungeonReform.ts). */
  private reform: { age: number; outcome: ReformOutcome } | null = null;
  /**
   * The file as this room knows it: the code as it is now, with only the
   * bugs that live here (each has a monster or a line in the room). After
   * an edit the file itself can hold more (`waiting` of them): bugs new to
   * the room, which get their monsters when the dungeon is next built.
   */
  private room: AnalyzedFile;
  private waiting = 0;
  /** Seconds until a purified dungeon with nothing left to give walks the hero out (null: not scheduled). */
  private walkOutIn: number | null = null;

  constructor(
    private readonly game: GameServices,
    readonly path: string,
  ) {
    const file = game.analysis.files.find((f) => f.path === path);
    if (!file) throw new Error(`No analyzed file for dungeon ${path}`);
    this.room = file;
    this.dungeon = game.options.makeDungeon(file);
    const ctx = (this.ctx = new SceneContext(game, this.dungeon));
    this.ground = new GroundRenderer(this.dungeon);
    this.scenery = this.dungeon.props.filter((p) => !BREAKABLE_KINDS.has(p.kind));
    this.torches = this.scenery.filter((p) => p.kind === "torch");
    this.otherScenery = this.scenery.filter((p) => p.kind !== "torch");
    for (const p of this.scenery) if (p.solid) ctx.setBlocked(p.x, p.y, true);
    this.breakables = createBreakables(ctx, this.dungeon.props, () => false);
    this.director = createMonsterDirector(ctx, this.dungeon, file);
    this.quiet = isDungeonQuiet(file, getProgress(game.save.get(), game.repoKey));
    this.purified = isDungeonPurified(file);
    this.cleanse = new Cleanse(this.dungeon, this.purified);
    this.floorCode = new FloorCode(ctx, this.dungeon, file);
    this.chest = new PrizeChest(ctx, this.dungeon, path);
    if (this.purified) this.chest.place();
    // The end door goes by the bugs of this room: one still waiting in the code does not keep it shut.
    this.endDoor = new EndDoor(ctx, this.dungeon, { file: () => this.room, leave: () => this.leave(), say: (text) => this.announce(text) });
    this.interactables = [
      ...this.scenery.map((p) => (p.kind === "plaque" ? plaqueInteractable(ctx, game, this.dungeon, p) : propInteractable(ctx, p))).filter((i): i is Interactable => i !== null),
      this.exitInteractable(),
      this.endDoor.interactable(),
      this.chest.interactable(() => this.openChest()),
    ];
  }

  enter(): void {
    const { ctx, game, dungeon } = this;
    game.player.placeAtTile(dungeon.entrance.x, dungeon.entrance.y, "right");
    game.pet.placeNear(game.player.x, game.player.y);
    ctx.camera.centerOn(game.player.x, game.player.y);
    if (this.purified) this.ambient.setKind("sparkles", PURIFIED_AMBIENT);
    else this.ambient.setKind("dust", DUNGEON.ambient);
    game.audio.music("dungeon");
    this.patchHud();
  }

  update(dt: number): void {
    const { ctx, game } = this;
    if (game.input.pressed("menu")) return game.emitPausing({ type: "menu" });
    if (game.input.pressed("map")) game.emit({ type: "toast", text: "No maps down here — find the glowing exit to leave.", tone: "info" });
    this.caption.update(dt);
    if (this.pending && !this.faint.active && !game.player.fainted) this.beginReform();
    if (this.reform) return this.updateReform(dt);
    // A defeated boss goes down in slow motion: the whole dungeon runs slower for a moment.
    const step = dt * this.director.timeScale();
    if (!updateShared(ctx, step)) return;
    this.director.update(step);
    this.floorCode.update(step, this.director.living());
    this.cleanse.update(ctx, step);
    this.chest.update(step);
    this.ambient.update(step);
    this.faint.update(step, ctx, () => this.respawn());
    this.updateWalkOut(step);
    if (!this.quiet && this.director.remaining() === 0) this.onQuiet();
    this.checkExit();
    this.endDoor.update(step);
    const current = game.player.fainted ? null : nearestInteractable(ctx, [...this.interactables, ...this.director.interactables(), ...this.floorCode.interactables()]);
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
    this.chest.drawables(drawables);
    this.endDoor.drawables(drawables);
    this.director.drawables(drawables);
    this.floorCode.drawables(drawables);

    const lights: Light[] = [];
    propLights(this.otherScenery, true, ctx.time, visible, lights);
    const firstTorch = lights.length;
    propLights(this.torches, true, ctx.time, visible, lights);
    for (let i = firstTorch; i < lights.length; i++) lights[i].color = this.cleanse.torchColor(lights[i].x, lights[i].y);
    lights.push({ ...EXIT_LIGHT, x: dungeon.exit.x * 16 + 8, y: dungeon.exit.y * 16 + 8 });
    this.chest.lights(lights);
    this.endDoor.lights(lights);
    heroLight(ctx, lights);
    this.director.lights(lights);
    this.floorCode.lights(lights, ctx.camera);

    renderShared(ctx, g, {
      backdrop: DUNGEON.backdrop,
      ground: this.ground,
      drawables,
      lights,
      darkness: { color: DARKNESS_COLOR, alpha: this.cleanse.darknessAlpha() },
      tint: null,
      vignette: VIGNETTE,
      lighting: this.lighting,
      ambient: this.ambient,
      floor: (g) => this.floorCode.drawFloor(g, ctx.camera),
      overlay: (g) => {
        this.director.overlay(g);
        this.chest.drawArrow(g);
        this.endDoor.drawArrow(g);
        drawRoomNames(g, ctx, dungeon);
      },
    });
    this.caption.draw(g, VIEW_W, VIEW_H);
  }

  onResume(): void {
    this.chest.onResume();
  }

  /** The finisher overlay's answer for a dazed monster (see GameHandle.resolveFinisher). */
  resolveFinisher(findingId: string, correct: boolean): void {
    this.director.resolveFinisher(findingId, correct);
  }

  /** "Fix it for real" in the finisher: the dazed monster gets back up (see GameHandle.spareFinisher). */
  spareFinisher(findingId: string): void {
    this.director.spareFinisher(findingId);
  }

  workshopSituation(): HeroSituation {
    const { player } = this.game;
    const roomLine = roomLineAt(this.dungeon, Math.floor(player.x / 16), Math.floor(player.y / 16));
    // A subdued monster's glowing line counts as where a bug is, like a living monster.
    const bugs = [...this.director.living(), ...this.floorCode.subduedSpots()];
    return { scene: "dungeon", path: this.path, hero: { x: player.x, y: player.y }, monsters: bugs, roomLine };
  }

  /** Shows a caption, e.g. why the hero is standing in a freshly re-formed dungeon. */
  announce(text: string): void {
    this.caption.show(text);
  }

  /**
   * This dungeon's file was edited (the game is usually paused in the
   * Workshop). Defeats still in flight are recorded now, under the ids the
   * save still knows; the rest waits until the game runs again.
   */
  follow(file: AnalyzedFile): void {
    if (!this.pending) {
      this.director.settleNow();
      this.pending = { file, fixedIds: new Set(), sealedIds: new Set() };
    }
    this.pending.file = file;
  }

  /** Ids (before the edit) of findings fixed for real or sealed: their monsters and lines will dissolve. */
  noteFixed(fixedIds: readonly string[], sealedIds: readonly string[] = []): void {
    if (!this.pending) return;
    for (const id of fixedIds) this.pending.fixedIds.add(id);
    for (const id of sealedIds) this.pending.sealedIds.add(id);
  }

  destroy(): void {
    this.director.destroy();
    this.ctx.particles.clear();
    this.ctx.hittables.clear();
  }

  // ───────────── re-forming after an edit (dungeonReform.ts) ─────────────

  private beginReform(): void {
    const { ctx, game } = this;
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    const { renamed, fixed, sealed, waiting } = followEdit(this.room.findings, pending.file, pending.fixedIds, pending.sealedIds);
    this.director.rewrite(new Set([...fixed, ...sealed]));
    // The save already knows the moved findings by their new ids: the monsters, lines and wisps follow them at once.
    this.director.follow(renamed);
    this.floorCode.follow(renamed, fixed, sealed);
    this.room = { ...pending.file, findings: [...renamed.values()] };
    this.waiting = waiting.length;
    // Nothing in this room changed (the edit was elsewhere, or the file was already pure): no pause, no caption.
    const untouched = fixed.size + sealed.size === 0;
    if (untouched && (this.room.findings.length > 0 || this.purified)) return;
    const outcome = reformOutcome(pending.file, this.room.findings);
    this.reform = { age: 0, outcome };
    this.caption.show(reformCaption(this.path, fixed.size, sealed.size));
    game.audio.sfx(fixed.size > 0 ? "revealRare" : "uiSelect");
    // Before a rebuild nothing can be hit (a blow now would land on a monster of the old dungeon).
    if (outcome === "rebuild") ctx.hittables.clear();
  }

  /** The room holds still and shimmers while the fixed monsters dissolve; then it purifies or re-forms. */
  private updateReform(dt: number): void {
    const reform = this.reform;
    if (!reform) return;
    const { ctx } = this;
    if (!updateShared(ctx, dt)) return;
    reform.age += dt;
    this.director.updateEffects(dt);
    this.floorCode.update(dt, []);
    this.cleanse.update(ctx, dt);
    this.ambient.update(dt);
    this.shimmer();
    this.game.hud.patch({ prompt: null });
    this.patchHud();
    if (reform.age < REFORM_SEC || this.director.rewriting()) return;
    this.reform = null;
    if (reform.outcome === "purify") this.purifyByCode();
    else if (reform.outcome === "settle") this.settle();
    else this.game.rebuildDungeon(nextWaveCaption(this.path));
  }

  /** Sparkles rising from random floor tiles on screen: the room is being rewritten. */
  private shimmer(): void {
    const { ctx } = this;
    for (let i = 0; i < SHIMMER_PER_STEP; i++) {
      const x = ctx.camera.left + Math.random() * VIEW_W;
      const y = ctx.camera.top + Math.random() * VIEW_H;
      if (ctx.isSolid(x, y)) continue;
      ctx.particles.emit({ x, y, z: 1, vz: 18, life: 0.7, color: SHIMMER_COLORS[i % SHIMMER_COLORS.length], size: 1, drag: 1 });
    }
  }

  /**
   * The new code has no bug left: the dungeon PURIFIES right here (the
   * sparkle wave, then the prize chest). If this file's one chest was
   * opened before, there is nothing to give, and the hero is walked out.
   */
  private purifyByCode(): void {
    const { ctx, game } = this;
    this.quiet = true;
    this.purified = true;
    ctx.juice.flash("#ffffff", 0.5, 0.5);
    ctx.emit({ type: "purified", path: this.path });
    this.cleanse.start(game.player.x, game.player.y);
    this.ambient.setKind("sparkles", PURIFIED_AMBIENT);
    if (this.chest.opened()) {
      this.caption.show(WALK_OUT_CAPTION);
      this.walkOutIn = WALK_OUT_SEC;
      return;
    }
    this.chest.drop();
  }

  /**
   * The room still has something to do: it stays exactly as it is. The
   * hero keeps their place, the other monsters fight on, and the lines that
   * were dealt with lie healed (or turned to stone) where they are.
   */
  private settle(): void {
    this.caption.show(settledCaption(this.director.remaining(), this.room.findings.length, this.waiting));
  }

  private updateWalkOut(dt: number): void {
    if (this.walkOutIn === null) return;
    this.walkOutIn -= dt;
    if (this.walkOutIn <= 0) {
      this.walkOutIn = null;
      this.leave();
    }
  }

  // ───────────── going quiet & the prize chest ─────────────

  /**
   * The last fighting monster is subdued: the dungeon goes QUIET. The UI
   * shows the banner and calms the music; nothing else is given away (the
   * chest waits for the code to be purified).
   */
  private onQuiet(): void {
    const { ctx, game } = this;
    this.quiet = true;
    game.save.set((save) => recordDungeonQuiet(save, game.repoKey, this.path));
    ctx.emit({ type: "quiet", path: this.path });
  }

  /** A purified dungeon's prize: the dungeon-clear chest, by the toughest bug the dungeon held. */
  private openChest(): void {
    if (!this.purified) return;
    this.game.emitPausing({ type: "chest", source: "dungeon-clear", path: this.path });
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
    const remaining = this.quiet ? 0 : this.director.remaining();
    this.game.hud.patch({
      scene: "dungeon",
      // The room the hero stands in names the code it stands for: "orders.py · def take_order()".
      location: locationLabel(this.dungeon, Math.floor(this.game.player.x / 16), Math.floor(this.game.player.y / 16)),
      dungeon: { path: this.path, remaining, total: this.dungeon.monsters.length, toFix: this.room.findings.length },
      boss: this.director.boss(),
    });
  }
}
