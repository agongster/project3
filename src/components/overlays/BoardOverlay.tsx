"use client";

// Placeholder — replaced by the real Board overlay.
import { Modal, PixelButton } from "@/components/ui/kit";
import type { OverlayProps } from "./types";

export default function BoardOverlay({ ctx }: OverlayProps<"board">) {
  return (
    <Modal label="Board" onClose={ctx.close} className="p-6">
      <p className="mb-4">Board overlay (coming soon)</p>
      <PixelButton onClick={ctx.close}>Close</PixelButton>
    </Modal>
  );
}
