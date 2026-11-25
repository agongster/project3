/**
 * Keyboard + pointer input for Bug Catch, turned into a `SimInput`.
 *
 *   const input = listenForInput(canvas, { onFirstGesture: () => audio.unlock() });
 *   stepSim(sim, input.read(), dt);
 *   input.dispose();   // on unmount
 *
 * - ←/→ and A/D steer; while a key is held the pointer is ignored.
 * - Moving the mouse (or dragging a finger) over the canvas steers towards
 *   that x position; pressing a key hands control back to the keyboard.
 * - Keys typed into a text field are never touched, so the loading screen's
 *   repo input keeps working.
 */
import type { SimInput } from "./hero";
import { GAME_W } from "./tuning";

const LEFT_KEYS = new Set(["ArrowLeft", "a", "A"]);
const RIGHT_KEYS = new Set(["ArrowRight", "d", "D"]);

export interface InputTracker {
  read(): SimInput;
  /** Forget held keys (e.g. when the tab is hidden and key-ups could be missed). */
  releaseAll(): void;
  dispose(): void;
}

/** True when the key press belongs to a text field, select or editable element. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

export function listenForInput(canvas: HTMLCanvasElement, opts: { onFirstGesture: () => void }): InputTracker {
  let left = false;
  let right = false;
  let pointerX: number | null = null;

  const gesture = () => opts.onFirstGesture();

  const onKey = (down: boolean) => (e: KeyboardEvent) => {
    if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const isLeft = LEFT_KEYS.has(e.key);
    const isRight = RIGHT_KEYS.has(e.key);
    if (!isLeft && !isRight) return;
    if (isLeft) left = down;
    if (isRight) right = down;
    if (down) {
      pointerX = null; // the keyboard takes over
      gesture();
    }
    if (e.key.startsWith("Arrow")) e.preventDefault(); // do not scroll the page
  };
  const onKeyDown = onKey(true);
  const onKeyUp = onKey(false);

  /** Converts a pointer position on the (CSS-scaled) canvas into game pixels. */
  const toGameX = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return null;
    return ((e.clientX - rect.left) / rect.width) * GAME_W;
  };
  const onPointerMove = (e: PointerEvent) => {
    pointerX = toGameX(e);
  };
  const onPointerDown = (e: PointerEvent) => {
    pointerX = toGameX(e);
    gesture();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);

  return {
    read() {
      const dir = left === right ? 0 : left ? -1 : 1;
      return { dir, pointerX };
    },
    releaseAll() {
      left = false;
      right = false;
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
    },
  };
}
