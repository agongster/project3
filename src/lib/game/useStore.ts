/**
 * `useStore`: lets a React component read one slice of a Store and re-render
 * only when that slice changes.
 *
 * Kept out of index.ts on purpose: the canvas engine imports `@/lib/game` and
 * must never pull React in. UI code imports this file directly:
 *
 *   import { useStore } from "@/lib/game/useStore";
 *   const coins = useStore(saveStore, (s) => s.coins);
 */
import { useCallback, useState, useSyncExternalStore } from "react";
import type { Store } from "@/lib/types";

/** Any Store, optionally able to say what the server rendered (see `SaveStore.getServerSnapshot`). */
export type HydratableStore<T> = Store<T> & { getServerSnapshot?: () => T };

/**
 * Subscribes the component to `store` and returns `selector(state)`.
 *
 * Selectors may return primitives, existing parts of the state (`s => s.equipped`)
 * or brand-new objects / arrays (`s => ({ coins: s.coins, xp: s.xp })`). New
 * objects are compared *shallowly* with the previous result and the previous
 * one is reused when they match, which avoids React's "getSnapshot should be
 * cached" infinite loop and skips pointless re-renders. Inline arrow selectors
 * are fine.
 *
 * During hydration the server snapshot is used (for a SaveStore, the default
 * save) so the first client render matches the server HTML; React then
 * re-renders with the real save straight away.
 */
export function useStore<T, S>(store: HydratableStore<T>, selector: (state: T) => S): S {
  const subscribe = useCallback((onChange: () => void) => store.subscribe(onChange), [store]);
  // One memo per component for the client snapshot and one for the server snapshot,
  // created once (lazy useState initializer) and kept for the component's lifetime.
  const [selectClient] = useState(createSelectionMemo<T, S>);
  const [selectServer] = useState(createSelectionMemo<T, S>);
  const [serverState] = useState(() => (store.getServerSnapshot ? store.getServerSnapshot() : store.get()));

  return useSyncExternalStore(
    subscribe,
    () => selectClient(store.get(), selector),
    () => selectServer(serverState, selector),
  );
}

/**
 * Remembers the last (state, selector, result). It recomputes when either the
 * state or the selector changes, but hands back the previous result whenever
 * the new one is shallow-equal to it, so the returned reference stays stable.
 * (Exported only so it can be unit-tested without a DOM.)
 */
export function createSelectionMemo<T, S>(): (state: T, selector: (state: T) => S) => S {
  let memo: { state: T; selector: (state: T) => S; value: S } | null = null;
  return (state, selector) => {
    if (memo && Object.is(memo.state, state) && memo.selector === selector) return memo.value;
    const next = selector(state);
    const value = memo && shallowEqual(memo.value, next) ? memo.value : next;
    memo = { state, selector, value };
    return value;
  };
}

/** True for identical values, or for two objects/arrays with the same keys and identical values. */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  return aKeys.every((key) => Object.hasOwn(bRecord, key) && Object.is(aRecord[key], bRecord[key]));
}
