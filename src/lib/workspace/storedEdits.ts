/**
 * The player's saved edits, remembered in localStorage so a returning player
 * finds their edited world again.
 *
 * One storage key holds every repo's edits, as plain JSON:
 *
 *   { "owner/repo@1a2b3c4d5e6f": { "pkg/mod.py": "…saved text…", … }, … }
 *
 * keyed by commit (`repoKey`), kept apart from the game save (store.ts) so a
 * big edit can never crowd out the player's coins and items. Only files whose
 * saved text differs from the original are stored.
 *
 * It is bounded: at most MAX_EDITED_REPOS repos and MAX_STORED_EDIT_CHARS
 * characters in all; the repo edited least recently is forgotten first. When
 * the browser refuses to store (quota full, storage disabled), edits keep
 * working in memory and last until the tab closes, with one console warning.
 * What is read back is treated as untrusted (see `loadEdits`).
 */

/** localStorage key. The `v1` would change if the stored shape ever had to. */
export const EDITS_STORAGE_KEY = "lintlands:edits:v1";
/** All stored edits together are kept under this many characters (localStorage holds about 5 million). */
export const MAX_STORED_EDIT_CHARS = 2_000_000;
/** Edits of at most this many repos (commits) are remembered. */
export const MAX_EDITED_REPOS = 8;
/** A single file's saved text longer than this is never stored (nor loaded). */
export const MAX_STORED_FILE_CHARS = 500_000;

/** The Storage methods used. Tests pass a fake; the browser uses localStorage. */
export type EditStorage = Pick<Storage, "getItem" | "setItem">;

/** One repo's edits: path → saved text. */
export type RepoEdits = Map<string, string>;

export interface EditStore {
  /**
   * The stored edits of one repo, sanitized: only paths in `knownPaths`, only
   * strings, each at most MAX_STORED_FILE_CHARS long, MAX_STORED_EDIT_CHARS in all.
   */
  load(repoKey: string, knownPaths: ReadonlySet<string>): RepoEdits;
  /** Remembers `text` as the saved text of `path` (null forgets the file: it is back to the original). */
  save(repoKey: string, path: string, text: string | null): void;
}

/**
 * The edit store on top of `storage` (localStorage by default; null keeps
 * nothing, so edits last until the tab closes).
 */
export function createEditStore(storage: EditStorage | null = browserStorage()): EditStore {
  let warned = false;
  function warnOnce(error?: unknown): void {
    if (warned) return;
    warned = true;
    console.warn("Lintlands: your edits can't be stored in this browser, so they last until the tab closes.", error ?? "");
  }

  return {
    load(repoKey, knownPaths) {
      const repo = readAll(storage).get(repoKey);
      const edits: RepoEdits = new Map();
      let total = 0;
      for (const [path, text] of repo ?? []) {
        if (!knownPaths.has(path) || total + text.length > MAX_STORED_EDIT_CHARS) continue;
        edits.set(path, text);
        total += text.length;
      }
      return edits;
    },

    save(repoKey, path, text) {
      if (storage === null) return warnOnce();
      const all = readAll(storage);
      const repo = all.get(repoKey) ?? new Map<string, string>();
      if (text === null) repo.delete(path);
      else if (text.length <= MAX_STORED_FILE_CHARS) repo.set(path, text);
      else {
        repo.delete(path); // never leave an older version behind to come back on reload
        warnOnce(`${path} is too long to store.`);
      }
      // Re-inserting puts this repo last: the Map's order is least → most recently edited.
      all.delete(repoKey);
      if (repo.size > 0) all.set(repoKey, repo);
      if (!fitInBudget(all)) warnOnce("Too many edits to store.");
      try {
        storage.setItem(EDITS_STORAGE_KEY, JSON.stringify(Object.fromEntries([...all].map(([key, files]) => [key, Object.fromEntries(files)]))));
      } catch (error) {
        warnOnce(error);
      }
    },
  };
}

/**
 * Drops the least recently edited repos until the caps hold. Returns false
 * when even the most recent repo alone is too big (then nothing of it is kept).
 */
function fitInBudget(all: Map<string, RepoEdits>): boolean {
  let fits = true;
  while (all.size > MAX_EDITED_REPOS || (all.size > 0 && totalChars(all) > MAX_STORED_EDIT_CHARS)) {
    const oldest = all.keys().next().value as string;
    if (all.size === 1) fits = false;
    all.delete(oldest);
  }
  return fits;
}

function totalChars(all: ReadonlyMap<string, RepoEdits>): number {
  let total = 0;
  for (const files of all.values()) for (const text of files.values()) total += text.length;
  return total;
}

/**
 * Everything stored, as Maps (so a hostile key such as "__proto__" is just a
 * string). Anything that isn't an object of objects of strings is skipped;
 * unreadable storage or broken JSON reads as "no edits".
 */
function readAll(storage: EditStorage | null): Map<string, RepoEdits> {
  const all = new Map<string, RepoEdits>();
  let parsed: unknown;
  try {
    const text = storage?.getItem(EDITS_STORAGE_KEY);
    parsed = text ? JSON.parse(text) : null;
  } catch {
    return all;
  }
  for (const [repoKey, files] of Object.entries(asRecord(parsed))) {
    const repo: RepoEdits = new Map();
    for (const [path, text] of Object.entries(asRecord(files))) {
      if (typeof text === "string" && text.length <= MAX_STORED_FILE_CHARS) repo.set(path, text);
    }
    if (repo.size > 0) all.set(repoKey, repo);
  }
  return all;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** localStorage, or null on the server / when the browser blocks it (some private modes throw on access). */
function browserStorage(): EditStorage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}
