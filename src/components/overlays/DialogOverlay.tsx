"use client";

// Placeholder — replaced by the real Dialog overlay.
import { Modal, PixelButton } from "@/components/ui/kit";
import type { OverlayProps } from "./types";

export default function DialogOverlay({ ctx }: OverlayProps<"dialog">) {
  return (
    <Modal label="Dialog" onClose={ctx.close} className="p-6">
      <p className="mb-4">Dialog overlay (coming soon)</p>
      <PixelButton onClick={ctx.close}>Close</PixelButton>
    </Modal>
  );
}
