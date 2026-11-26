/**
 * "Only the newest answer counts": the rule behind `Workspace.check`.
 *
 * The editor asks for a check every time the player pauses typing, and Ruff
 * may still be busy with the previous one. Answers must never arrive for
 * text that is already out of date without the caller being able to tell.
 * So, per key (a file path):
 *
 *   - at most one request runs at a time, and at most one waits behind it;
 *   - a new request replaces the waiting one, which rejects with SupersededError;
 *   - a request that finishes after a newer one was made also rejects with
 *     SupersededError instead of delivering its (stale) answer.
 *
 * A request that resolves is therefore always the newest one for its key,
 * and callers can simply ignore SupersededError.
 */

/** A newer request for the same file replaced this one; its answer would be out of date. */
export class SupersededError extends Error {
  constructor() {
    super("A newer check of this file replaced this one.");
    this.name = "SupersededError";
  }
}

/** True for the error a replaced check rejects with (safe to ignore). */
export function isSuperseded(error: unknown): boolean {
  return error instanceof SupersededError;
}

interface Request<T> {
  input: string;
  ticket: number;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

interface Slot<T> {
  running: boolean;
  waiting: Request<T> | null;
  /** Ticket of the newest request made for this key. */
  newest: number;
}

/** Wraps `run` so that, per key, only the newest request delivers an answer (see the top of this file). */
export function latestOnly<T>(run: (key: string, input: string) => Promise<T>): (key: string, input: string) => Promise<T> {
  const slots = new Map<string, Slot<T>>();

  function start(key: string, slot: Slot<T>, request: Request<T>): void {
    slot.running = true;
    run(key, request.input).then(
      (value) => finish(key, slot, request, () => request.resolve(value)),
      (error: unknown) => finish(key, slot, request, () => request.reject(error)),
    );
  }

  function finish(key: string, slot: Slot<T>, request: Request<T>, deliver: () => void): void {
    slot.running = false;
    if (request.ticket === slot.newest) deliver();
    else request.reject(new SupersededError());

    const next = slot.waiting;
    slot.waiting = null;
    if (next) start(key, slot, next);
    else slots.delete(key);
  }

  return (key, input) =>
    new Promise<T>((resolve, reject) => {
      const slot = slots.get(key) ?? { running: false, waiting: null, newest: 0 };
      slots.set(key, slot);
      const request: Request<T> = { input, ticket: ++slot.newest, resolve, reject };
      if (!slot.running) {
        start(key, slot, request);
        return;
      }
      slot.waiting?.reject(new SupersededError());
      slot.waiting = request;
    });
}
