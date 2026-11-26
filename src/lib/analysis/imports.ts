/**
 * Which outside packages a repo leans on most: the Town Square merchants
 * ("the numpy merchant") are named after them.
 *
 * Only third-party packages count. The standard library is left out with a
 * compact list of its common modules (STDLIB_MODULES), and so are the repo's
 * own packages and modules (an `import model` in a repo with a `model.py`
 * is the repo talking to itself).
 */
import type { AnalyzedFile } from "@/lib/types";

/**
 * The standard-library modules Python code imports most often. Not the full
 * list (that has 300+ entries); a rare stdlib module that slips through
 * only means one odd merchant.
 */
export const STDLIB_MODULES: ReadonlySet<string> = new Set([
  "__future__", "abc", "argparse", "array", "ast", "asyncio", "atexit", "base64", "binascii", "bisect",
  "builtins", "bz2", "calendar", "cmath", "codecs", "collections", "colorsys", "concurrent", "configparser",
  "contextlib", "contextvars", "copy", "cProfile", "csv", "ctypes", "curses", "dataclasses", "datetime",
  "decimal", "difflib", "dis", "distutils", "doctest", "email", "enum", "errno", "faulthandler", "fnmatch",
  "fractions", "ftplib", "functools", "gc", "getpass", "gettext", "glob", "gzip", "hashlib", "heapq", "hmac",
  "html", "http", "imaplib", "importlib", "inspect", "io", "ipaddress", "itertools", "json", "keyword",
  "linecache", "locale", "logging", "lzma", "math", "mimetypes", "mmap", "multiprocessing", "numbers",
  "operator", "optparse", "os", "pathlib", "pdb", "pickle", "pkgutil", "platform", "pprint", "profile",
  "pstats", "queue", "random", "re", "sched", "secrets", "select", "selectors", "shelve", "shlex", "shutil",
  "signal", "site", "smtplib", "socket", "socketserver", "sqlite3", "ssl", "stat", "statistics", "string",
  "struct", "subprocess", "sys", "sysconfig", "tarfile", "tempfile", "textwrap", "threading", "time",
  "timeit", "tkinter", "token", "tokenize", "tomllib", "traceback", "types", "typing", "unicodedata",
  "unittest", "urllib", "uuid", "venv", "warnings", "wave", "weakref", "webbrowser", "wsgiref", "xml",
  "xmlrpc", "zipfile", "zlib", "zoneinfo",
]);

/** One outside package and who uses it. */
export interface PackageUse {
  /** Top-level module name, e.g. "numpy". */
  name: string;
  /** Paths of the files that import it, biggest file first (ties by path). */
  importers: string[];
}

/** File and folder names of the repo itself: `src/models/gpt.py` gives "src", "models" and "gpt". */
export function ownModuleNames(files: readonly AnalyzedFile[]): Set<string> {
  const names = new Set<string>();
  for (const file of files) {
    const parts = file.path.split("/");
    const fileName = parts.pop() ?? "";
    for (const folder of parts) names.add(folder);
    names.add(fileName.replace(/\.pyi?$/, ""));
  }
  return names;
}

/** True for a module that is neither the standard library, private (`_thread`) nor part of the repo. */
function isOutsidePackage(name: string, own: ReadonlySet<string>): boolean {
  return name !== "" && !name.startsWith("_") && !STDLIB_MODULES.has(name) && !own.has(name);
}

/**
 * The repo's third-party packages, most-imported first (counted in files
 * that import them; ties alphabetical). Deterministic for a given repo.
 */
export function rankPackages(files: readonly AnalyzedFile[]): PackageUse[] {
  const own = ownModuleNames(files);
  const importers = new Map<string, AnalyzedFile[]>();
  for (const file of files) {
    if (file.status !== "ok") continue;
    for (const name of new Set(file.outline.imports)) {
      if (!isOutsidePackage(name, own)) continue;
      importers.set(name, [...(importers.get(name) ?? []), file]);
    }
  }
  const bySize = (a: AnalyzedFile, b: AnalyzedFile) => b.lineCount - a.lineCount || (a.path < b.path ? -1 : 1);
  return [...importers.entries()]
    .map(([name, users]) => ({ name, importers: [...users].sort(bySize).map((file) => file.path) }))
    .sort((a, b) => b.importers.length - a.importers.length || (a.name < b.name ? -1 : 1));
}
