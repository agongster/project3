"use client";

// Placeholder — replaced by the real Chest overlay.
import { Modal, PixelButton } from "@/components/ui/kit";
import type { OverlayProps } from "./types";

export default function ChestOverlay({ ctx }: OverlayProps<"chest">) {
  return (
    <Modal label="Chest" onClose={ctx.close} className="p-6">
      <p className="mb-4">Chest overlay (coming soon)</p>
      <PixelButton onClick={ctx.close}>Close</PixelButton>
    </Modal>
  );
}
