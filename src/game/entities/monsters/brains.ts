/**
 * Which brain each monster gets: one per archetype (see MONSTERS in
 * catalog.ts), and for bosses the shared boss frame with that boss's moves.
 * A champion (champion.ts) gets its species' brain with one move sharpened
 * where the archetype has an obvious one: aimed hops, a double lunge, a
 * double swoop, a fan of three globs, a wider flail.
 */
import { MONSTERS } from "@/lib/game/catalog";
import type { MonsterKind } from "@/lib/types";
import { AmbusherBrain } from "./ambusher";
import { BlinkerBrain } from "./blinker";
import { BossBrain, type BossMove } from "./boss";
import type { Brain } from "./brain";
import { ChaserBrain } from "./chaser";
import { OrbFanMove, TailSweepMove } from "./evalSerpent";
import { FlutterBrain } from "./flutter";
import { GlitchRainMove, TeleportMove } from "./glitchKing";
import { HopperBrain } from "./hopper";
import { DashMove, KeyScatterMove } from "./keyThief";
import { SkitterBrain } from "./skitter";
import { SpitterBrain } from "./spitter";
import { TankBrain } from "./tank";

/** Each boss's moves, in the order it uses them. */
function bossMoves(kind: MonsterKind): BossMove[] {
  switch (kind) {
    case "keyThief":
      return [new DashMove(), new KeyScatterMove()];
    case "evalSerpent":
      return [new OrbFanMove(), new TailSweepMove()];
    case "glitchKing":
      return [new TeleportMove(), new GlitchRainMove()];
    default:
      return [new DashMove()];
  }
}

/** A fresh brain for one monster (brains hold per-monster state, so never share them). */
export function createBrain(kind: MonsterKind, champion = false): Brain {
  switch (MONSTERS[kind].archetype) {
    case "hopper":
      return new HopperBrain(champion);
    case "skitter":
      return new SkitterBrain();
    case "flutter":
      return new FlutterBrain(champion);
    case "chaser":
      return new ChaserBrain(champion);
    case "blinker":
      return new BlinkerBrain();
    case "ambusher":
      return new AmbusherBrain();
    case "spitter":
      return new SpitterBrain(champion);
    case "tank":
      return new TankBrain(champion);
    case "boss":
      return new BossBrain(bossMoves(kind));
  }
}
