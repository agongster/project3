"use client";

/** A checkmark for "this bug's monster is defeated" (an empty slot of the same size otherwise). */
import { PixelSprite } from "./PixelSprite";
import { uiIcon } from "./sprites";

const MARK_SCALE = 2;
const MARK_BOX = 20;

export function DoneMark({ done }: { done: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center" style={{ width: MARK_BOX, height: MARK_BOX }}>
      {done && <PixelSprite sprite={uiIcon("checkmark")} scale={MARK_SCALE} label="Defeated" />}
    </span>
  );
}
