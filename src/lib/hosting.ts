/**
 * Where the app is hosted. Two build-time switches (set in
 * .github/workflows/pages.yml) let the same code run on a static host such as
 * GitHub Pages, which has no server and serves the site from a sub-folder:
 *
 *   NEXT_PUBLIC_STATIC_HOST=1          there is no /api/repo: the browser asks GitHub itself
 *   NEXT_PUBLIC_BASE_PATH=/project3    the folder the site lives in ("" at the root)
 *
 * With neither set (local dev, Vercel) nothing changes.
 */
export const STATIC_HOST = process.env.NEXT_PUBLIC_STATIC_HOST === "1";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
