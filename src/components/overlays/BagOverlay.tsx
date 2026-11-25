"use client";

// Placeholder — replaced by the real Bag overlay.
import { Modal, PixelButton } from "@/components/ui/kit";
import type { OverlayProps } from "./types";

export default function BagOverlay({ ctx }: OverlayProps<"bag">) {
  return (
    <Modal label="Bag" onClose={ctx.close} className="p-6">
      <p className="mb-4">Bag overlay (coming soon)</p>
      <PixelButton onClick={ctx.close}>Close</PixelButton>
    </Modal>
  );
}
