/**
 * The door to the editor library. CodeMirror is big, and most players never
 * open the Workshop, so it is downloaded with a dynamic import the first
 * time the Workshop opens (or is about to), never with the game itself.
 */
type EditorKit = typeof import("./kit");

let kitPromise: Promise<EditorKit> | null = null;

/** Starts (or reuses) the download of the editor; a failed download can be retried. */
export function loadEditorKit(): Promise<EditorKit> {
  if (!kitPromise) {
    kitPromise = import("./kit").catch((error: unknown) => {
      kitPromise = null;
      throw error;
    });
  }
  return kitPromise;
}
