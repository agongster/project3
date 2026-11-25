/**
 * GET /api/repo?repo=owner/name[&ref=branch] → RepoListing or ApiErrorBody.
 *
 * Runs on the server so the optional GITHUB_TOKEN stays secret. All the logic
 * lives in src/lib/repo/repoEndpoint.ts (unit-tested); this file only wires in
 * the environment.
 */
import type { NextRequest } from "next/server";
import { handleRepoRequest } from "@/lib/repo/repoEndpoint";

export async function GET(request: NextRequest): Promise<Response> {
  return handleRepoRequest(request.nextUrl.searchParams, { token: process.env.GITHUB_TOKEN });
}
