/**
 * Keyboard (and mouse-button) input, turned into game ACTIONS.
 *
 * The rest of the engine never looks at raw keys: it asks "is `attack`
 * held?" or "was `interact` pressed since the last update?". That keeps the
 * alternate bindings (WASD / arrows, Space / J / mouse...) in one table.
 *
 * Two kinds of question:
 *   held(action)    – is any key for it down right now (movement, auto-attack)
 *   pressed(action) – did it go down since the previous simulation step
 *                     (one-shot things: interact, dash, menu)
 *
 * While the game is paused (an overlay is open) key presses are ignored and
 * never `preventDefault`ed, so the HTML overlay gets the keyboard to itself.
 */

export type Action = "up" | "down" | "left" | "right" | "attack" | "dash" | "interact" | "menu" | "map";

/** `KeyboardEvent.code` → action. Codes are layout-independent (WASD stays WASD on AZERTY). */
const KEY_BINDINGS: Record<string, Action> = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "attack",
  KeyJ: "attack",
  ShiftLeft: "dash",
  ShiftRight: "dash",
  KeyK: "dash",
  KeyE: "interact",
  Enter: "interact",
  NumpadEnter: "interact",
  Escape: "menu",
  Tab: "menu",
  KeyM: "map",
};

export interface Input {
  held(action: Action): boolean;
  pressed(action: Action): boolean;
  /** Unit-length (or zero) movement direction from the held arrow/WASD keys. */
  moveVector(): { x: number; y: number };
  /** Call after every simulation step: forgets this step's `pressed` edges. */
  endStep(): void;
  /** Turns gameplay input on/off (off while paused). */
  setEnabled(enabled: boolean): void;
  destroy(): void;
}

/** True when the key press is meant for a text field, not for the game. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function createInput(canvas: HTMLCanvasElement): Input {
  /** Physical keys (codes) currently down, plus "Mouse0" for the left button. */
  const down = new Set<string>();
  /** Actions pressed since the last `endStep`. */
  const edges = new Set<Action>();
  let enabled = true;
  /**
   * When input was last re-enabled. The key press that CLOSES an overlay
   * (e.g. Enter on a dialog) may reach us right after `resume()`; its event
   * timestamp is older than this, so we can tell it apart and not
   * immediately re-open the dialog.
   */
  let enabledAt = 0;

  const isHeld = (action: Action) => {
    for (const code of down) if ((code === "Mouse0" ? "attack" : KEY_BINDINGS[code]) === action) return true;
    return false;
  };

  function onKeyDown(e: KeyboardEvent): void {
    const action = KEY_BINDINGS[e.code];
    if (!action || isTypingTarget(e.target)) return;
    down.add(e.code);
    if (!enabled) return;
    e.preventDefault(); // no page scrolling on Space / arrows, no focus jump on Tab
    if (e.repeat || e.timeStamp < enabledAt) return;
    edges.add(action);
  }

  function onKeyUp(e: KeyboardEvent): void {
    down.delete(e.code);
  }

  function onMouseDown(e: MouseEvent): void {
    if (e.button !== 0 || !enabled) return;
    down.add("Mouse0");
    edges.add("attack");
  }

  function onMouseUp(e: MouseEvent): void {
    if (e.button === 0) down.delete("Mouse0");
  }

  /** Window lost focus: we will never see the key-ups, so forget everything. */
  function onBlur(): void {
    down.clear();
    edges.clear();
  }

  window.addEventListener("keydown", onKeyDown);
  // Key-ups are caught in the capture phase so an overlay that stops event
  // propagation can never leave a key "stuck down" in the game.
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("blur", onBlur);
  canvas.addEventListener("mousedown", onMouseDown);

  return {
    held: (action) => enabled && isHeld(action),
    pressed: (action) => enabled && edges.has(action),
    moveVector() {
      if (!enabled) return { x: 0, y: 0 };
      const x = (isHeld("right") ? 1 : 0) - (isHeld("left") ? 1 : 0);
      const y = (isHeld("down") ? 1 : 0) - (isHeld("up") ? 1 : 0);
      // Normalise so diagonals are not 41% faster than straight lines.
      const len = Math.hypot(x, y);
      return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
    },
    endStep() {
      edges.clear();
    },
    setEnabled(next) {
      if (next && !enabled) enabledAt = performance.now();
      enabled = next;
      edges.clear();
    },
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("mousedown", onMouseDown);
    },
  };
}
