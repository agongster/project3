/**
 * Decides what kind of building a Python file becomes in the world:
 * tests become watchtowers, `__init__.py` files become lanterns or small
 * cottages, runnable scripts and ordinary modules become houses.
 */
import type { FileKind } from "@/lib/types";

/** Directory names whose files are all tests. */
const TEST_DIRECTORIES = new Set(["tests", "test"]);
/** Files that are run directly rather than imported. */
const SCRIPT_FILE_NAMES = new Set(["setup.py", "manage.py"]);
/** `if __name__ == "__main__":` with either kind of quotes. */
const MAIN_GUARD = /^if\s+__name__\s*==\s*["']__main__["']\s*:/m;

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** True for pytest/unittest-style test files and anything under tests/ or test/. */
export function isTestPath(path: string): boolean {
  const name = fileName(path);
  if (name.startsWith("test_") || name.endsWith("_test.py") || name === "conftest.py") return true;
  const directories = path.split("/").slice(0, -1);
  return directories.some((dir) => TEST_DIRECTORIES.has(dir));
}

/**
 * Classifies a file. `source` may be null when the file could not be
 * downloaded; then only the path is used.
 */
export function classifyFile(path: string, source: string | null): FileKind {
  const name = fileName(path);
  // Checked before tests: tests/__init__.py is a package marker, not a test.
  if (name === "__init__.py") return "init";
  if (isTestPath(path)) return "test";
  if (SCRIPT_FILE_NAMES.has(name)) return "script";
  if (source !== null && MAIN_GUARD.test(source)) return "script";
  return "module";
}
