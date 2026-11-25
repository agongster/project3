"use client";

// Placeholder — replaced by the real Gacha overlay.
import { Modal, PixelButton } from "@/components/ui/kit";
import type { OverlayProps } from "./types";

export default function GachaOverlay({ ctx }: OverlayProps<"gacha">) {
  return (
    <Modal label="Gacha" onClose={ctx.close} className="p-6">
      <p className="mb-4">Gacha overlay (coming soon)</p>
      <PixelButton onClick={ctx.close}>Close</PixelButton>
    </Modal>
  );
}
