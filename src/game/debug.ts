/**
 * Debug helpers for play-testing and screenshot scripts. In development they
 * are reachable as `window.__lintlands` on the /dev/engine page and as
 * `window.__app.debug` in the real game. The game itself never calls them.
 */
import type { Dungeon, Prop } from "@/lib/types";
import { Monster } from "./entities/monsters/monster";
import type { Scene } from "./scenes/scene";
import { buildingStatus } from "./scenes/progressView";
import type { GameServices } from "./services";

export interface GameDebug {
  /** Puts the hero on a tile of the current scene. */
  teleport(tileX: number, tileY: number): void;
  /** Hurts the hero (half-hearts), as if bumped from the right. */
  hurt(amount: number): void;
  /**
   * Tile to stand on to use the nearest thing of a kind: a prop kind
   * ("well", "sign", "bush"...), "npc", or a building status
   * ("cursed", "treasure", "claimable", "done"). Null when there is none.
   */
  nearest(kind: string): { x: number; y: number } | null;
  /** A snapshot of what is going on (scene, hero position, HP...). */
  state(): { scene: string; x: number; y: number; tileX: number; tileY: number; hp: number; facing: string };
  /** Monsters the hero can hit right now (empty in the overworld), for scripted play-tests. */
  monsters(): { kind: string; x: number; y: number; hp: number; engaged: boolean; warning: boolean }[];
}

const dist2 = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function createDebug(game: GameServices, currentScene: () => Scene): GameDebug {
  const heroTile = () => ({ x: Math.floor(game.player.x / 16), y: Math.floor(game.player.y / 16) });

  /** The closest standing spot that is not blocked (so a teleport never lands inside a bush). */
  function nearestOf<T>(items: readonly T[], spot: (t: T) => { x: number; y: number }): { x: number; y: number } | null {
    const here = heroTile();
    const free = (s: { x: number; y: number }) => !currentScene().ctx.isSolidTile(s.x, s.y);
    let best: { x: number; y: number } | null = null;
    for (const item of items) {
      const s = spot(item);
      if (free(s) && (!best || dist2(s, here) < dist2(best, here))) best = s;
    }
    return best;
  }

  return {
    teleport(tileX, tileY) {
      const scene = currentScene();
      game.player.placeAtTile(tileX, tileY, "down");
      game.pet.placeNear(game.player.x, game.player.y);
      scene.ctx.camera.centerOn(game.player.x, game.player.y);
    },
    hurt(amount) {
      const p = game.player;
      p.invuln = 0;
      p.hurt(amount, p.x + 10, p.y, currentScene().ctx);
    },
    nearest(kind) {
      const scene = currentScene();
      const save = game.save.get();
      if (scene.kind === "overworld") {
        const world = game.options.world;
        if (kind === "npc") return nearestOf(world.npcs, (n) => ({ x: n.x, y: n.y + 1 }));
        const files = new Map(game.analysis.files.map((f) => [f.path, f]));
        const buildings = world.buildings.filter((b) => buildingStatus(save, game.repoKey, files.get(b.path)) === kind);
        if (buildings.length > 0) return nearestOf(buildings, (b) => b.door);
        return nearestOf(world.props.filter((p: Prop) => p.kind === kind), (p) => ({ x: p.x, y: p.y + 1 }));
      }
      // Inside a dungeon the scene's map is the Dungeon itself, which lists its props.
      const map = scene.ctx.map as Partial<Dungeon>;
      if (kind === "exit" && map.exit) return { x: map.exit.x + 1, y: map.exit.y };
      if (kind === "chest" && map.chest) return { x: map.chest.x, y: map.chest.y + 1 };
      return nearestOf((map.props ?? []).filter((p) => p.kind === kind), (p) => ({ x: p.x, y: p.y + 1 }));
    },
    state() {
      const p = game.player;
      const t = heroTile();
      return { scene: currentScene().kind, x: Math.round(p.x), y: Math.round(p.y), tileX: t.x, tileY: t.y, hp: p.hp, facing: p.facing };
    },
    monsters() {
      const list = [...currentScene().ctx.hittables].filter((t): t is Monster => t instanceof Monster);
      return list.map((m) => ({ kind: m.species, x: Math.round(m.x), y: Math.round(m.y), hp: m.hp, engaged: m.engaged, warning: m.shiver || m.alert > 0 }));
    },
  };
}
