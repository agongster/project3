/**
 * What the Workshop refuses to open or save, and the friendly messages it
 * shows instead. Repo text is untrusted: a huge, binary or garbled file must
 * produce a clear message, never a hung tab.
 */
import { MAX_STORED_FILE_CHARS } from "./storedEdits";

/** Longest text the Workshop opens, checks or forges (the same limit as storing it, so every forge can be stored). */
export const MAX_EDIT_CHARS = MAX_STORED_FILE_CHARS;
/**
 * A downloaded file in which more than this share of the characters are
 * U+FFFD (what the browser puts in place of bytes that aren't valid UTF-8)
 * is not UTF-8 text.
 */
export const MAX_GARBLED_SHARE = 0.01;

export const MESSAGES = {
  unknownFile: "There's no such file in this repo.",
  notDownloaded: "This file couldn't be downloaded from GitHub, so it can't be opened. Reload the world to try again.",
  tooLong: `That's too much text for the Workshop (over ${MAX_EDIT_CHARS.toLocaleString("en-US")} characters).`,
  binary: "This file looks like binary data, so the Workshop can't open it.",
  garbled: "This file isn't UTF-8 text, so the Workshop can't open it.",
  pythonOnly: "Only Python files are checked for bugs.",
  notLinted: "The bug detector couldn't read this text, so it wasn't forged. Your text is still in the editor: change it a little and try again.",
  notChecked: "The bug detector couldn't read this text.",
  notFormatted: "The formatter can't tidy this code while it has a syntax error. Fix that first (look for the Glitch King), then try again.",
  closed: "This world was closed.",
} as const;

/** Rejects text too long to edit. */
export function assertEditable(text: string): void {
  if (text.length > MAX_EDIT_CHARS) throw new Error(MESSAGES.tooLong);
}

/** Checks a downloaded non-Python file before the Workshop opens it. Throws with a friendly message. */
export function assertOpenable(text: string): void {
  assertEditable(text);
  if (text.includes("\u0000")) throw new Error(MESSAGES.binary);
  const garbled = text.split("�").length - 1;
  if (garbled > 0 && garbled > text.length * MAX_GARBLED_SHARE) throw new Error(MESSAGES.garbled);
}
