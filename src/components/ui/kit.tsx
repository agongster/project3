"use client";

/**
 * Small shared UI kit: pixel-styled building blocks used by every screen and
 * overlay. The styling lives in `src/app/globals.css` (classes `px-panel`,
 * `px-btn`, ...); these components just make them convenient to use.
 */
import { useEffect, useRef } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

/** Joins class names, skipping falsy ones. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ───────────────────────────── Panel ─────────────────────────────

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "cream" | "dark" | "wood";
}

export function PixelPanel({ tone = "cream", className, ...rest }: PanelProps) {
  return <div className={cx("px-panel", tone !== "cream" && tone, className)} {...rest} />;
}

// ───────────────────────────── Button ────────────────────────────

export type ButtonTone = "leaf" | "gold" | "rose" | "sky" | "grape" | "cream" | "berry";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  small?: boolean;
}

export function PixelButton({ tone = "leaf", small, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={cx("px-btn", tone !== "leaf" && tone, small && "small", className)} {...rest} />;
}

// ───────────────────────────── Sprite ────────────────────────────

/** Anything with a canvas and a size — matches the art module's `Sprite`. */
export interface SpriteLike {
  canvas: CanvasImageSource;
  w: number;
  h: number;
}

interface SpriteViewProps {
  sprite: SpriteLike | null;
  /** Integer zoom factor (each art pixel becomes scale×scale CSS pixels). */
  scale?: number;
  flipX?: boolean;
  className?: string;
  title?: string;
}

/** Draws one pixel-art sprite into the DOM, scaled up with crisp pixels. */
export function SpriteView({ sprite, scale = 3, flipX, className, title }: SpriteViewProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !sprite) return;
    canvas.width = sprite.w;
    canvas.height = sprite.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, sprite.w, sprite.h);
    ctx.drawImage(sprite.canvas, 0, 0);
  }, [sprite]);

  if (!sprite) return null;
  return (
    <canvas
      ref={ref}
      title={title}
      className={cx("pixelated", className)}
      style={{ width: sprite.w * scale, height: sprite.h * scale, transform: flipX ? "scaleX(-1)" : undefined }}
    />
  );
}

// ───────────────────────────── Modal ─────────────────────────────

interface ModalProps {
  children: ReactNode;
  /** Called when the player presses Escape or clicks the dimmed backdrop. */
  onClose?: () => void;
  /** Extra classes for the panel (size, padding). */
  className?: string;
  tone?: "cream" | "dark" | "wood";
  /** Accessible name of the dialog. */
  label: string;
  /** Set false for overlays that must be finished (e.g. mid-reveal). */
  dismissable?: boolean;
}

/**
 * A centred pixel panel on a dimmed backdrop. Traps Escape, focuses itself so
 * keyboard input goes to the overlay instead of the game.
 */
export function Modal({ children, onClose, className, tone = "cream", label, dismissable = true }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!onClose || !dismissable) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, dismissable]);

  return (
    <div
      className="anim-fade-in absolute inset-0 z-40 flex items-center justify-center bg-[#120d24]/70 p-4"
      onMouseDown={(event) => {
        if (dismissable && onClose && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cx("px-panel anim-pop max-h-full outline-none", tone !== "cream" && tone, className)}
      >
        {children}
      </div>
    </div>
  );
}

// ───────────────────────────── Bits ──────────────────────────────

/** A keyboard key hint, e.g. <KeyCap>E</KeyCap>. */
export function KeyCap({ children }: { children: ReactNode }) {
  return <kbd className="px-key">{children}</kbd>;
}

interface BarProps {
  /** 0–1 */
  value: number;
  color?: string;
  className?: string;
  label?: string;
}

/** A chunky progress bar. */
export function PixelBar({ value, color = "var(--color-leaf)", className, label }: BarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cx("relative h-4 bg-[#2b1b3d]/25", className)}
      style={{ boxShadow: "0 -3px 0 0 #2b1b3d, 0 3px 0 0 #2b1b3d, -3px 0 0 0 #2b1b3d, 3px 0 0 0 #2b1b3d" }}
    >
      <div
        className="h-full transition-[width] duration-300"
        style={{ width: `${pct}%`, background: color, boxShadow: "inset 0 -4px 0 0 rgb(0 0 0 / 0.2), inset 0 3px 0 0 rgb(255 255 255 / 0.35)" }}
      />
    </div>
  );
}
