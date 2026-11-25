"use client";

// Placeholder — replaced by the real BugCard overlay.
import { Modal, PixelButton } from "@/components/ui/kit";
import type { OverlayProps } from "./types";

export default function BugCardOverlay({ ctx }: OverlayProps<"bugCard">) {
  return (
    <Modal label="BugCard" onClose={ctx.close} className="p-6">
      <p className="mb-4">BugCard overlay (coming soon)</p>
      <PixelButton onClick={ctx.close}>Close</PixelButton>
    </Modal>
  );
}
