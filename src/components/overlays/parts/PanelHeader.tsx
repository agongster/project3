"use client";

/** The title row shared by the bigger overlays: a pixel title, a subtitle and a Close button. */
import type { ReactNode } from "react";
import { KeyCap, PixelButton } from "@/components/ui/kit";

interface PanelHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Extra controls shown before the Close button. */
  actions?: ReactNode;
  onClose: () => void;
}

export function PanelHeader({ title, subtitle, actions, onClose }: PanelHeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1">
        <h2 className="font-title text-base leading-tight">{title}</h2>
        {subtitle && <div className="mt-1 truncate text-sm opacity-80">{subtitle}</div>}
      </div>
      {actions}
      <PixelButton tone="cream" small onClick={onClose} aria-label="Close">
        Close <KeyCap>Esc</KeyCap>
      </PixelButton>
    </header>
  );
}
