"use client";

// Placeholder — replaced by the real Pause overlay.
import { Modal, PixelButton } from "@/components/ui/kit";
import type { OverlayProps } from "./types";

export default function PauseOverlay({ ctx }: OverlayProps<"pause">) {
  return (
    <Modal label="Pause" onClose={ctx.close} className="p-6">
      <p className="mb-4">Pause overlay (coming soon)</p>
      <PixelButton onClick={ctx.close}>Close</PixelButton>
    </Modal>
  );
}
