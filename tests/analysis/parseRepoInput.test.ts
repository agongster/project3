import { describe, expect, it } from "vitest";
import { isValidRef, parseRepoInput } from "@/lib/repo/parseRepoInput";

describe("parseRepoInput", () => {
  it.each([
    ["owner/repo", { owner: "owner", repo: "repo" }],
    ["  psf/requests  ", { owner: "psf", repo: "requests" }],
    ["psf/requests.git", { owner: "psf", repo: "requests" }],
    ["https://github.com/psf/requests", { owner: "psf", repo: "requests" }],
    ["http://www.github.com/psf/requests/", { owner: "psf", repo: "requests" }],
    ["github.com/psf/requests/", { owner: "psf", repo: "requests" }],
    ["https://github.com/psf/requests.git", { owner: "psf", repo: "requests" }],
    ["https://github.com/psf/requests/issues?q=is%3Aopen#top", { owner: "psf", repo: "requests" }],
    ["git@github.com:psf/requests.git", { owner: "psf", repo: "requests" }],
    ["https://github.com/psf/requests/tree/main", { owner: "psf", repo: "requests", ref: "main" }],
    ["github.com/a-b/c.d_e/tree/feature/login-page", { owner: "a-b", repo: "c.d_e", ref: "feature/login-page" }],
    ["owner/repo/tree/v2.0", { owner: "owner", repo: "repo", ref: "v2.0" }],
  ])("accepts %j", (input, expected) => {
    expect(parseRepoInput(input)).toEqual({ ok: true, ...expected });
  });

  it.each([
    "",
    "   ",
    "requests",
    "owner/",
    "/repo",
    "owner repo",
    "own er/repo",
    "-owner/repo",
    "owner/re po",
    "owner/..",
    "owner/repo/blob", // bare paths must be exactly owner/repo
    "https://gitlab.com/owner/repo",
    "gitlab.com/owner/repo",
    "https://github.com/owner",
    "https://github.com/owner/repo/tree/bad..ref",
  ])("rejects %j with a friendly message", (input) => {
    const result = parseRepoInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/owner\/repo/);
  });
});

describe("isValidRef", () => {
  it("accepts ordinary branch and tag names", () => {
    for (const ref of ["main", "feature/x", "v1.2.3", "release-2024_10"]) expect(isValidRef(ref)).toBe(true);
  });
  it("rejects names git would refuse", () => {
    for (const ref of ["has space", "a..b", "x~1", "/lead", "trail/", "what?"]) expect(isValidRef(ref)).toBe(false);
  });
});
