/**
 * Syntax highlighting per language. Python comes with the editor; every
 * other language pack is downloaded the first time a file of that kind is
 * opened, so opening the Workshop on a Python file does not pay for the HTML,
 * CSS and JavaScript grammars.
 */
import { indentUnit } from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import type { Extension } from "@codemirror/state";
import type { LanguageId } from "../logic/languages";

/** Python's own indentation: four spaces per level. */
export const PYTHON_INDENT = "    ";
/** Everything else gets two. */
const DEFAULT_INDENT = "  ";

const LOADERS: Readonly<Record<LanguageId, () => Promise<Extension>>> = {
  python: async () => [python(), indentUnit.of(PYTHON_INDENT)],
  markdown: async () => (await import("@codemirror/lang-markdown")).markdown(),
  json: async () => (await import("@codemirror/lang-json")).json(),
  javascript: async () => (await import("@codemirror/lang-javascript")).javascript({ jsx: true }),
  typescript: async () => (await import("@codemirror/lang-javascript")).javascript({ jsx: true, typescript: true }),
  html: async () => (await import("@codemirror/lang-html")).html(),
  css: async () => (await import("@codemirror/lang-css")).css(),
  yaml: async () => (await import("@codemirror/lang-yaml")).yaml(),
  plain: async () => [],
};

const loaded = new Map<LanguageId, Promise<Extension>>();

/**
 * The editor extension for a language (cached). A language pack that fails
 * to download falls back to plain text: the file still opens.
 */
export function loadLanguage(id: LanguageId): Promise<Extension> {
  let promise = loaded.get(id);
  if (!promise) {
    promise = LOADERS[id]()
      .then((extension) => (id === "python" ? extension : [extension, indentUnit.of(DEFAULT_INDENT)]))
      .catch(() => {
        loaded.delete(id);
        return [];
      });
    loaded.set(id, promise);
  }
  return promise;
}
