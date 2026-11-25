import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * False during server rendering and hydration, true afterwards.
 *
 * The game needs canvases, localStorage and Web Audio, none of which exist on
 * the server, so screens render only once this is true. Using
 * `useSyncExternalStore` (instead of a state flag set in an effect) gives the
 * right answer on the very first client render after hydration.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
