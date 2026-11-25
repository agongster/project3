"use client";

// Placeholder — replaced by the real Codex overlay.
import { Modal, PixelButton } from "@/components/ui/kit";
import type { OverlayProps } from "./types";

export default function CodexOverlay({ ctx }: OverlayProps<"codex">) {
  return (
    <Modal label="Codex" onClose={ctx.close} className="p-6">
      <p className="mb-4">Codex overlay (coming soon)</p>
      <PixelButton onClick={ctx.close}>Close</PixelButton>
    </Modal>
  );
}
