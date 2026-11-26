/**
 * While the Workshop (or its loading screen) is on screen, no key may reach
 * the game, which listens on `window`. Every key stops at the document,
 * after the Workshop's own handlers ran.
 *
 * The Workshop's root also stops the keys it handles; this catches the rest,
 * such as Esc in CodeMirror's search panel (the panel is removed while the
 * key is handled, so React can no longer trace the key back to the Workshop)
 * or a key pressed while the Workshop is still downloading.
 */
import { useEffect } from "react";

export function useKeysStayHere(): void {
  useEffect(() => {
    const stop = (event: Event) => event.stopPropagation();
    document.addEventListener("keydown", stop);
    document.addEventListener("keyup", stop);
    return () => {
      document.removeEventListener("keydown", stop);
      document.removeEventListener("keyup", stop);
    };
  }, []);
}
