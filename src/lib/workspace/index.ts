/**
 * Public API of the workspace: open a world, then read, check, edit and
 * export its files (the interface is in contract.ts).
 *
 *   const workspace = await openWorkspace({ kind: "demo" }, onProgress);
 *   workspace.analysis.get();                 // the world, with stored edits applied
 *   const report = await workspace.forge(path, text);
 *   saveStore.set((save) => applyForge(save, key, report).save);   // src/lib/game/forge.ts
 */
export type * from "./contract";
export { openWorkspace, README_GRACE_MS } from "./open";
export type { WorkspaceDeps, WorkspaceTarget } from "./open";
export { reconcileFindings, lineSimilarity, offendingLine, NEAR_SAME_LINE_SIMILARITY } from "./reconcile";
export type { Reconciliation } from "./reconcile";
export { isSuperseded, SupersededError } from "./latestOnly";
export { LinterUnavailableError } from "./linter";
export { SAFE_FIX_RULES } from "./liveCheck";
export { EDITS_STORAGE_KEY, MAX_EDITED_REPOS, MAX_STORED_EDIT_CHARS, MAX_STORED_FILE_CHARS } from "./storedEdits";
export { MAX_EDIT_CHARS } from "./limits";
export { gitQuotePath, PATCH_CONTEXT_LINES } from "./exportChanges";
