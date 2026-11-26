/**
 * FLOOR CODE: each monster's offending line of code carved into the dungeon
 * floor where it starts, and everything that happens on it. This class is
 * what the dungeon scene talks to; the parts are:
 *
 *   floorCodeLayout.ts   WHAT each carving says and WHERE it lies (pure)
 *   floorCodeLook.ts     how a line looks for its bug's state: cursed,
 *                        caught (subdued), healed (fixed) or sealed
 *   floorCodeWisps.ts    the subdued monster's wisp, dozing above its line
 *   floorCodeLines.ts    "E  Fix line 22 in the Workshop" on a glowing line
 *
 * The state of each bug is read from the save (a fight records it as
 * subdued in `RepoProgress.defeated`) plus what the code did during this
 * visit (`follow`: fixed or sealed in the Workshop), so the monster code
 * needs no hook: the floor simply follows the save.
 */
import type { FindingState } from "@/lib/game/progress";
import { getProgress } from "@/lib/game";
import type { AnalyzedFile, Dungeon, Finding } from "@/lib/types";
import type { Camera } from "../engine/camera";
import type { SceneContext } from "./context";
import { carvingText, layoutCarvings, type Carving } from "./floorCodeLayout";
import { lineInteractable, linePrompt, type LineSpot } from "./floorCodeLines";
import { CarvingLooks } from "./floorCodeLook";
import { Wisps } from "./floorCodeWisps";
import type { Interactable } from "./interactions";
import type { Drawable, Light } from "./scene";

/**
 * Lines of bugs gone from the code are kept under their old id behind this
 * prefix: finding ids start with a file path, which never holds a NUL, so a
 * surviving finding that moves onto a gone one's id is never mistaken for it.
 */
const RETIRED = "\u0000";

const retired = (id: string) => `${RETIRED}${id}`;

export class FloorCode {
  private readonly looks: CarvingLooks;
  private readonly wisps: Wisps;
  private spots: LineSpot[];
  /** Retired keys of lines fixed or sealed in the code during this visit (the save no longer knows them). */
  private readonly fixed = new Set<string>();
  private readonly sealed = new Set<string>();
  /** The save's subdued ids as a set, rebuilt only when the save's list changes (it is immutable). */
  private subdued: { list: readonly string[]; set: ReadonlySet<string> } = { list: [], set: new Set() };
  private readonly path: string;

  constructor(
    private readonly ctx: SceneContext,
    dungeon: Dungeon,
    file: AnalyzedFile,
  ) {
    this.path = dungeon.path;
    const carvings = layoutCarvings(dungeon, file.findings);
    const state = (id: string) => this.stateOf(id);
    this.looks = new CarvingLooks(carvings, state);
    this.wisps = new Wisps(dungeon.monsters, state);
    this.spots = lineSpots(file, carvings, (id) => this.wisps.postOf(id));
  }

  /** The state of the bug a line stands for (see src/lib/game/progress.ts). */
  stateOf(findingId: string): FindingState {
    if (this.fixed.has(findingId)) return "fixed";
    if (this.sealed.has(findingId)) return "sealed";
    const list = getProgress(this.ctx.save.get(), this.ctx.repoKey).defeated;
    if (list !== this.subdued.list) this.subdued = { list, set: new Set(list) };
    return this.subdued.set.has(findingId) ? "subdued" : "alive";
  }

  /** One step. `living` are the monsters still standing: a wisp rises where its monster fell. */
  update(dt: number, living: readonly { id: string; x: number; y: number }[]): void {
    const state = (id: string) => this.stateOf(id);
    this.wisps.track(living);
    this.looks.update(dt, this.ctx.particles, state);
    this.wisps.update(dt, this.ctx.particles, state);
  }

  /**
   * The code was edited (dungeonReform.ts `followEdit`). Findings still in
   * it follow to their new id and line number (`renamed`: old id → the
   * finding now), their carvings cut again with the new number. Findings
   * gone from it are retired: fixed lines heal and their wisps are freed,
   * sealed ones turn to stone.
   */
  follow(renamed: ReadonlyMap<string, Finding>, fixedIds: ReadonlySet<string>, sealedIds: ReadonlySet<string>): void {
    const keys = new Map<string, string>();
    for (const [oldId, finding] of renamed) keys.set(oldId, finding.id);
    for (const id of [...fixedIds, ...sealedIds]) keys.set(id, retired(id));
    this.looks.rekey(keys);
    this.wisps.rekey(keys);
    this.spots = this.spots.map((spot) => {
      const finding = renamed.get(spot.findingId);
      if (finding) return { ...spot, findingId: finding.id, line: finding.line };
      return { ...spot, findingId: keys.get(spot.findingId) ?? spot.findingId };
    });
    for (const id of fixedIds) this.fixed.add(retired(id));
    for (const id of sealedIds) this.sealed.add(retired(id));
    for (const finding of renamed.values()) {
      const text = carvingText(finding);
      if (text) this.looks.relabel(finding.id, text);
    }
  }

  /** The carvings, drawn in world space right after the floor tiles. */
  drawFloor(g: CanvasRenderingContext2D, camera: Pick<Camera, "sees">): void {
    this.looks.draw(g, camera);
  }

  /** The wisps, y-sorted with everything else standing in the dungeon. */
  drawables(out: Drawable[]): void {
    this.wisps.drawables(out);
  }

  lights(out: Light[], camera: Pick<Camera, "sees">): void {
    this.looks.lights(out, camera);
    this.wisps.lights(out);
  }

  /** "E  Fix line 22 in the Workshop" spots: every line whose bug is subdued, fixed or sealed. */
  interactables(): Interactable[] {
    const hero = () => this.ctx.game.player;
    const open = (line: number) => this.ctx.game.openWorkshop({ path: this.path, line });
    return this.spots.flatMap((spot) => {
      const state = this.stateOf(spot.findingId);
      return linePrompt(state, spot.line) === null ? [] : [lineInteractable(spot, state, hero, open)];
    });
  }

  /** Where the subdued lines are (their middle) and which line of code each is, for the Workshop key (F). */
  subduedSpots(): { x: number; y: number; line: number }[] {
    return this.spots
      .filter((spot) => this.stateOf(spot.findingId) === "subdued")
      .map((spot) => ({ x: spot.box.x + spot.box.w / 2, y: spot.box.y + spot.box.h / 2, line: spot.line }));
  }
}

/**
 * Every line E can be pressed on: each carving's box, plus a small spot at
 * the wisp's post for a monster whose line found no room on the floor.
 */
function lineSpots(file: AnalyzedFile, carvings: readonly Carving[], postOf: (findingId: string) => { x: number; y: number } | null): LineSpot[] {
  const byId = new Map(carvings.map((c) => [c.findingId, c]));
  return file.findings.flatMap((finding) => {
    const carving = byId.get(finding.id);
    if (carving) return [{ findingId: finding.id, line: finding.line, box: { x: carving.x, y: carving.y, w: carving.w, h: carving.h } }];
    const post = postOf(finding.id);
    return post ? [{ findingId: finding.id, line: finding.line, box: { x: post.x, y: post.y, w: 0, h: 0 } }] : [];
  });
}
