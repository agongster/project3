"use client";

/**
 * Small pieces shared by the Workshop's panels: shortcut key caps that
 * print the right modifier for the player's computer, a focus trap for
 * popups, and the clip helper for repo text shown outside the editor.
 */
import { useEffect, useSyncExternalStore, type RefObject } from "react";
import { KeyCap } from "@/components/ui/kit";
import { shortcutKeys, type WorkshopCommand } from "../logic/shortcuts";

/** Cuts text longer than `max` characters with an ellipsis (paths, messages from a repo). */
export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function subscribeNever(): () => void {
  return () => undefined;
}

/** True on a Mac (shortcuts show ⌘). False during server rendering. */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

/** The key caps of a shortcut, e.g. [⌘][S]. */
export function ShortcutKeys({ command }: { command: WorkshopCommand }) {
  const isMac = useIsMac();
  return (
    <span className="ws-keys" aria-hidden="true">
      {shortcutKeys(command, isMac).map((key) => (
        <KeyCap key={key}>{key}</KeyCap>
      ))}
    </span>
  );
}

/** The shortcut as words for a tooltip or label, e.g. "Ctrl+S". */
export function useShortcutText(command: WorkshopCommand): string {
  return shortcutKeys(command, useIsMac()).join("+");
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Where focus goes when a popup closes and the element it came from is gone: the code, or else the Workshop itself. */
function focusHome(home: HTMLElement | null): void {
  const code = home?.querySelector<HTMLElement>(".ws-editor-host:not(.ws-covered) .cm-content");
  (code ?? home)?.focus();
}

/**
 * Keeps Tab inside a popup and gives focus back to where it was when the
 * popup closes, so keyboard players never end up behind it (or on the page
 * body, where their keys would reach the game).
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const home = box.closest<HTMLElement>(".ws-root");
    if (!box.contains(document.activeElement)) (box.querySelector<HTMLElement>("[data-autofocus]:not([disabled])") ?? box.querySelector<HTMLElement>(FOCUSABLE) ?? box).focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    box.addEventListener("keydown", onKey);
    return () => {
      box.removeEventListener("keydown", onKey);
      // Give focus back only if it was lost with the popup, not if something (the editor) took it on purpose.
      const now = document.activeElement;
      if (now !== null && now !== document.body && !box.contains(now)) return;
      if (before?.isConnected && before !== document.body) before.focus();
      else focusHome(home);
    };
  }, [ref]);
}
