/**
 * What every scene (the overworld village, a dungeon) looks like to the game.
 *
 * The game owns exactly one ACTIVE scene. Each simulation step it calls
 * `update(dt)`, each animation frame `render(g)`. Scenes never switch
 * themselves: they ask the game (`ctx.game.enterDungeon(path)` /
 * `leaveDungeon()`), which runs the iris transition and swaps them.
 */
import type { SceneContext } from "./context";

/**
 * One thing to draw in the y-sorted world layer. Objects whose base is
 * lower on the screen (larger `y`) are drawn later, so they correctly
 * overlap things standing behind them.
 */
export interface Drawable {
  /** World y of the object's base (its "feet"). */
  y: number;
  draw(g: CanvasRenderingContext2D): void;
  /** Optional ground shadow, drawn in a pass BEFORE all bodies. */
  shadow?(g: CanvasRenderingContext2D): void;
}

/** A soft light (night theme, dungeons). Positions are world pixels. */
export interface Light {
  x: number;
  y: number;
  radius: number;
  color: string;
  /** 0–1, how strongly it cuts through the darkness (default 1). */
  strength?: number;
}

export interface Scene {
  readonly kind: "overworld" | "dungeon";
  readonly ctx: SceneContext;
  /** Called each time the scene becomes active (also after leaving a dungeon). */
  enter(): void;
  update(dt: number): void;
  render(g: CanvasRenderingContext2D): void;
  /** The game was un-paused (an overlay closed). */
  onResume(): void;
  /** Free anything the scene holds (it will not be used again). */
  destroy(): void;
}
