"use client";

/**
 * An animated hero (or villager) drawn from the character art generator.
 *
 * - `walking` plays the walk cycle in place.
 * - `turning` slowly spins the character through all four directions, which
 *   shows off the whole outfit; otherwise it faces `facing`.
 */
import { renderCharacter, WALK_CYCLE, type Facing } from "@/game/art";
import { SpriteView } from "@/components/ui/kit";
import type { CharacterLook } from "@/lib/types";
import { useTicker } from "./useTicker";

/** Time per walk-cycle step (the art module suggests 120–150 ms). */
const STEP_MS = 140;
/** Turn to the next direction after this many steps (≈ 1.5 s). */
const STEPS_PER_TURN = 11;
/** Clockwise, starting by facing the player. */
const TURN_ORDER: readonly Facing[] = ["down", "left", "up", "right"];

interface Props {
  look: CharacterLook;
  hatId: string | null;
  /** Integer zoom (each art pixel becomes scale × scale screen pixels). */
  scale?: number;
  walking?: boolean;
  turning?: boolean;
  facing?: Facing;
  className?: string;
}

export function CharacterPreview({ look, hatId, scale = 4, walking = true, turning = false, facing = "down", className }: Props) {
  const tick = useTicker(STEP_MS, walking || turning);
  const dir = turning ? TURN_ORDER[Math.floor(tick / STEPS_PER_TURN) % TURN_ORDER.length] : facing;
  const step = walking ? WALK_CYCLE[tick % WALK_CYCLE.length] : 0;
  const sprite = renderCharacter(look, hatId).frame(dir, step);
  return <SpriteView sprite={sprite} scale={scale} className={className} title={look.name} />;
}
