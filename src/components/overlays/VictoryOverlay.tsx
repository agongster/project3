"use client";

// Placeholder — replaced by the real Victory overlay.
import { Modal, PixelButton } from "@/components/ui/kit";
import type { OverlayProps } from "./types";

export default function VictoryOverlay({ ctx }: OverlayProps<"victory">) {
  return (
    <Modal label="Victory" onClose={ctx.close} className="p-6">
      <p className="mb-4">Victory overlay (coming soon)</p>
      <PixelButton onClick={ctx.close}>Close</PixelButton>
    </Modal>
  );
}
