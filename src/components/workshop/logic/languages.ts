/**
 * Which syntax highlighting a file gets, decided by its name. The editor
 * loads the matching CodeMirror language pack only when such a file is
 * first opened (see editor/languages.ts).
 */
export type LanguageId = "python" | "markdown" | "json" | "javascript" | "typescript" | "html" | "css" | "yaml" | "plain";

/** Shown in the status bar. */
export const LANGUAGE_LABELS: Readonly<Record<LanguageId, string>> = {
  python: "Python",
  markdown: "Markdown",
  json: "JSON",
  javascript: "JavaScript",
  typescript: "TypeScript",
  html: "HTML",
  css: "CSS",
  yaml: "YAML",
  plain: "Plain text",
};

/** File extension (lower case, without the dot) → language. */
const BY_EXTENSION: Readonly<Record<string, LanguageId>> = {
  py: "python",
  pyi: "python",
  pyw: "python",
  md: "markdown",
  markdown: "markdown",
  rst: "plain",
  json: "json",
  ipynb: "json",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  html: "html",
  htm: "html",
  css: "css",
  yml: "yaml",
  yaml: "yaml",
};

/** The language for a path; anything unknown is plain text. */
export function languageForPath(path: string): LanguageId {
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "plain";
  return BY_EXTENSION[name.slice(dot + 1)] ?? "plain";
}
