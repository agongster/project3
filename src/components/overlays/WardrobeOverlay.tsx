"use client";

// Placeholder — replaced by the real Wardrobe overlay.
import { Modal, PixelButton } from "@/components/ui/kit";
import type { OverlayProps } from "./types";

export default function WardrobeOverlay({ ctx }: OverlayProps<"wardrobe">) {
  return (
    <Modal label="Wardrobe" onClose={ctx.close} className="p-6">
      <p className="mb-4">Wardrobe overlay (coming soon)</p>
      <PixelButton onClick={ctx.close}>Close</PixelButton>
    </Modal>
  );
}
