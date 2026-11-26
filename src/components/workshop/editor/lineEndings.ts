/**
 * Keeping a file's own line endings.
 *
 * Inside the editor every line break is just "a new line": CodeMirror splits
 * text on "\r\n", "\r" and "\n" alike, which is also how Ruff counts lines,
 * and what makes pasting code from anywhere work. But text handed back to
 * the Workshop must use the file's own separator: a Windows file ("\r\n")
 * returned with "\n" would have every line changed, and its patch would
 * rewrite the whole file. So each editor state remembers its file's
 * separator, and `textOf` joins the lines with it.
 */
import { Facet, type EditorState, type Extension } from "@codemirror/state";
import { lineSeparatorOf } from "../logic/positions";

/** The line separator of the file a state holds (its first value wins). */
const fileLineBreak = Facet.define<string, string>({ combine: (values) => values[0] ?? "\n" });

/** Remember the line separator `text` uses. */
export function lineEndingsOf(text: string): Extension {
  return fileLineBreak.of(lineSeparatorOf(text));
}

/** The document's text with the file's own line endings. */
export function textOf(state: EditorState): string {
  return state.doc.sliceString(0, state.doc.length, state.facet(fileLineBreak));
}
