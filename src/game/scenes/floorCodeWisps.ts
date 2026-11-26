/**
 * FLOOR CODE, part 3: the BOUND WISPS. A monster beaten in a fight is only
 * SUBDUED (src/lib/game/progress.ts): after its death animation its spirit,
 * a small, pale, see-through copy of it, rises from where it fell and drifts
 * back to its post above the line of code it came from. There it dozes,
 * bobbing gently with a "zzz", bound to its glowing line until the bug is
 * dealt with in the code:
 *
 *   fixed    it flashes white, stretches upward and bursts into sparkles
 *            (the line heals to gold underneath, floorCodeLook.ts)
 *   sealed   it simply fades away in a grey puff (the line turns to stone)
 *
 * Wisps are decoration only: nothing can hit them and they hurt nobody.
 * They follow the save (a finding id in `defeated` is subdued), so they
 * need no hook in the monster code; `track` remembers where each living
 * monster last stood, which is where its wisp rises.
 */
import { drawSprite, flashSprite, monsterSprite, type Sprite } from "@/game/art";
import { uiSprite } from "@/game/art/ui";
import { MONSTERS } from "@/lib/game/catalog";
import type { FindingState } from "@/lib/game/progress";
import type { MonsterKind, MonsterSpawn } from "@/lib/types";
import { TILE_PX } from "../engine/collision";
import type { Particles } from "../engine/particles";
import type { Drawable, Light } from "./scene";

/** A monster's feet stand this far below the top of its spawn tile (matches monster.ts and floorCodeLayout.ts). */
const FEET_DY = 12;
/** The pale spirit colour, and how see-through the wisp is while it dozes. */
const WISP_COLOR = "#c9f6ff";
const WISP_ALPHA = 0.5;
/** The monster's own colours show faintly through the spirit. */
const WISP_DETAIL_ALPHA = 0.3;
/** Rising from where it fell and drifting back to its post takes this long (s), after a short pause for the death poof. */
const RISE_DELAY_SEC = 0.15;
const DRIFT_SEC = 0.9;
/** It floats this high above its post at the top of the drift's arc (px). */
const DRIFT_ARC_PX = 10;
/** Dozing: a 1 px bob, once every BOB_SEC. */
const BOB_PX = 1;
const BOB_SEC = 1.6;
/** The "zzz" floats a little above the wisp's head and to its right. */
const ZZZ_OFFSET = { x: 5, y: 3 };
/** Freed by a fix: a white flash that stretches up and fades over FREE_SEC, with a burst of sparkles. */
const FREE_SEC = 0.6;
const FREE_RISE_PX = 12;
const FREE_SPARKLES = 12;
/** Sealed: a plain fade over SEAL_FADE_SEC and a small grey puff. */
const SEAL_FADE_SEC = 0.4;
const SEAL_PUFF = 5;
/** A faint cool light, so a dozing wisp shows in the dark. */
const WISP_LIGHT: Omit<Light, "x" | "y"> = { radius: 12, color: "#7fe8ff", strength: 0.45 };

type WispPhase = "drifting" | "dozing" | "freed" | "sealing";

/** Where a monster's wisp dozes: above its line, at the tile the monster started on. */
interface Post {
  kind: MonsterKind;
  post: { x: number; y: number };
}

interface Wisp {
  findingId: string;
  kind: MonsterKind;
  /** Where its feet rest while it dozes (world px). */
  post: { x: number; y: number };
  /** Where it rose from (world px). */
  from: { x: number; y: number };
  phase: WispPhase;
  /** Seconds in this phase. */
  age: number;
  /** Seconds of dozing, for the bob (each wisp starts at its own point of the cycle). */
  bobPhase: number;
}

const spiritCache = new Map<MonsterKind, Sprite>();

/** The monster's first frame as a pale silhouette (cached: one per species). */
function spirit(kind: MonsterKind): Sprite {
  let sprite = spiritCache.get(kind);
  if (!sprite) spiritCache.set(kind, (sprite = flashSprite(monsterSprite(kind, 0), WISP_COLOR)));
  return sprite;
}

/** Wisps start their bob this far apart (s), so a room of them never bobs in unison. */
const BOB_STAGGER_SEC = 0.7;

function makeWisp(findingId: string, at: Post, from: { x: number; y: number }, phase: WispPhase, index: number): Wisp {
  return { findingId, kind: at.kind, post: at.post, from: { ...from }, phase, age: 0, bobPhase: index * BOB_STAGGER_SEC };
}

/** 0 → 1 with a soft start and a soft landing. */
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k));

export class Wisps {
  private posts = new Map<string, Post>();
  private wisps = new Map<string, Wisp>();
  /** Where each living monster last stood: its wisp rises from there. */
  private lastSeen = new Map<string, { x: number; y: number }>();

  /** `stateOf` tells which monsters were already subdued when the dungeon was built: their wisps doze from the start. */
  constructor(spawns: readonly MonsterSpawn[], stateOf: (findingId: string) => FindingState) {
    spawns.forEach((spawn, i) => {
      const at: Post = { kind: spawn.kind, post: { x: spawn.x * TILE_PX + TILE_PX / 2, y: spawn.y * TILE_PX + FEET_DY } };
      this.posts.set(spawn.findingId, at);
      if (stateOf(spawn.findingId) === "subdued") this.wisps.set(spawn.findingId, makeWisp(spawn.findingId, at, at.post, "dozing", i));
    });
  }

  /** Call each step with the monsters still standing. */
  track(living: readonly { id: string; x: number; y: number }[]): void {
    for (const m of living) this.lastSeen.set(m.id, { x: m.x, y: m.y });
  }

  /** Starts a wisp for each newly subdued monster, and frees or seals the ones whose bug left the code. */
  update(dt: number, particles: Particles, stateOf: (findingId: string) => FindingState): void {
    for (const [id, at] of this.posts) {
      const state = stateOf(id);
      const wisp = this.wisps.get(id);
      if (state === "subdued" && !wisp) this.wisps.set(id, makeWisp(id, at, this.lastSeen.get(id) ?? at.post, "drifting", this.wisps.size));
      else if (wisp && (state === "fixed" || state === "sealed") && (wisp.phase === "dozing" || wisp.phase === "drifting")) this.release(wisp, state, particles);
    }
    for (const wisp of this.wisps.values()) {
      wisp.age += dt;
      wisp.bobPhase += dt;
      if (wisp.phase === "drifting" && wisp.age >= RISE_DELAY_SEC + DRIFT_SEC) this.setPhase(wisp, "dozing");
    }
    for (const [id, wisp] of this.wisps) if (this.gone(wisp)) this.wisps.delete(id);
  }

  /** Each wisp, y-sorted with everything else that stands in the dungeon. */
  drawables(out: Drawable[]): void {
    for (const wisp of this.wisps.values()) {
      const { x, y } = this.position(wisp);
      out.push({
        y,
        shadow: (g) => drawSprite(g, uiSprite("shadowSmall"), wisp.post.x, wisp.post.y, { alpha: this.alpha(wisp) * 0.6 }),
        draw: (g) => this.drawWisp(g, wisp, x, y),
      });
    }
  }

  lights(out: Light[]): void {
    for (const wisp of this.wisps.values()) {
      const { x, y } = this.position(wisp);
      out.push({ ...WISP_LIGHT, x, y: y - MONSTERS[wisp.kind].size / 2 });
    }
  }

  /** The code was edited and findings moved: each wisp follows its finding to its new id (`renamed`: old id → new id). */
  rekey(renamed: ReadonlyMap<string, string>): void {
    const follow = <T>(map: Map<string, T>) => new Map([...map].map(([id, value]) => [renamed.get(id) ?? id, value] as const));
    this.posts = follow(this.posts);
    this.wisps = follow(this.wisps);
    this.lastSeen = follow(this.lastSeen);
    for (const [id, wisp] of this.wisps) wisp.findingId = id;
  }

  /** Where the wisp bound to a finding dozes, or null when there is none (for "press E" spots without a carving). */
  postOf(findingId: string): { x: number; y: number } | null {
    return this.posts.get(findingId)?.post ?? null;
  }

  private setPhase(wisp: Wisp, phase: WispPhase): void {
    wisp.phase = phase;
    wisp.age = 0;
  }

  private release(wisp: Wisp, state: "fixed" | "sealed", particles: Particles): void {
    const { x, y } = this.position(wisp);
    const midY = y - MONSTERS[wisp.kind].size / 2;
    wisp.from = { x, y };
    if (state === "fixed") {
      this.setPhase(wisp, "freed");
      particles.burst(FREE_SPARKLES, x, midY, 50, { life: 0.9, sprite: uiSprite("sparkle", 0), drag: 2 });
    } else {
      this.setPhase(wisp, "sealing");
      particles.burst(SEAL_PUFF, x, midY, 14, { life: 0.6, sprite: uiSprite("dust", 1), drag: 3 });
    }
  }

  private gone(wisp: Wisp): boolean {
    return (wisp.phase === "freed" && wisp.age >= FREE_SEC) || (wisp.phase === "sealing" && wisp.age >= SEAL_FADE_SEC);
  }

  /** Where the wisp's feet are now (world px). */
  private position(wisp: Wisp): { x: number; y: number } {
    if (wisp.phase === "drifting") {
      const k = easeInOut(Math.min(1, Math.max(0, wisp.age - RISE_DELAY_SEC) / DRIFT_SEC));
      const arc = Math.sin(k * Math.PI) * DRIFT_ARC_PX;
      return { x: wisp.from.x + (wisp.post.x - wisp.from.x) * k, y: wisp.from.y + (wisp.post.y - wisp.from.y) * k - arc };
    }
    if (wisp.phase === "dozing") {
      const bob = Math.round((0.5 + 0.5 * Math.sin((wisp.bobPhase / BOB_SEC) * Math.PI * 2)) * BOB_PX);
      return { x: wisp.post.x, y: wisp.post.y - bob };
    }
    if (wisp.phase === "freed") return { x: wisp.from.x, y: wisp.from.y - (wisp.age / FREE_SEC) * FREE_RISE_PX };
    return wisp.from;
  }

  /** How visible the wisp is: it fades in as it rises, and out when freed or sealed. */
  private alpha(wisp: Wisp): number {
    switch (wisp.phase) {
      case "drifting":
        return Math.min(1, wisp.age / (RISE_DELAY_SEC + DRIFT_SEC / 3));
      case "dozing":
        return 1;
      case "freed":
        return 1 - wisp.age / FREE_SEC;
      case "sealing":
        return 1 - wisp.age / SEAL_FADE_SEC;
    }
  }

  private drawWisp(g: CanvasRenderingContext2D, wisp: Wisp, x: number, y: number): void {
    const alpha = this.alpha(wisp);
    if (wisp.phase === "freed") {
      drawSprite(g, flashSprite(monsterSprite(wisp.kind, 0)), x, y, { alpha });
      return;
    }
    drawSprite(g, spirit(wisp.kind), x, y, { alpha: WISP_ALPHA * alpha });
    drawSprite(g, monsterSprite(wisp.kind, 0), x, y, { alpha: WISP_DETAIL_ALPHA * alpha });
    if (wisp.phase === "dozing") {
      const size = MONSTERS[wisp.kind].size;
      drawSprite(g, uiSprite("zzz"), x + size / 2 - ZZZ_OFFSET.x, y - size - ZZZ_OFFSET.y, { alpha: 0.8 });
    }
  }
}
