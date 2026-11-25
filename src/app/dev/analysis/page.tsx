"use client";

/**
 * Developer page for the analysis pipeline: run the demo kingdom or a real
 * repo and look at the raw RepoAnalysis (stats, grades, every finding).
 *
 * For scripted checks it exposes `window.__runAnalysis("demo" | "owner/repo")`,
 * which starts a run and returns a promise of the RepoAnalysis (the latest run
 * is also kept as `window.__analysis`), e.g.
 *   node scripts/shot.mjs http://localhost:3100/dev/analysis .shots/a.png \
 *     --eval "window.__runAnalysis('demo').then(a => a.stats)"
 */
import { useEffect, useRef, useState } from "react";
import { analyzeDemo } from "@/lib/analysis/demo";
import { analyzeRepo } from "@/lib/analysis/analyzeRepo";
import { AnalyzeError } from "@/lib/analysis/errors";
import { parseRepoInput } from "@/lib/repo/parseRepoInput";
import type { AnalyzeProgress, RepoAnalysis } from "@/lib/types";

declare global {
  interface Window {
    __analysis?: Promise<RepoAnalysis>;
    __runAnalysis?: (target: string) => Promise<RepoAnalysis>;
  }
}

type RunState = { status: "idle" } | { status: "running"; progress: AnalyzeProgress | null } | { status: "done"; analysis: RepoAnalysis; ms: number } | { status: "error"; message: string };

export default function AnalysisDevPage() {
  const [repoText, setRepoText] = useState("");
  const [state, setState] = useState<RunState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  function start(run: (onProgress: (p: AnalyzeProgress) => void, signal: AbortSignal) => Promise<RepoAnalysis>): Promise<RepoAnalysis> {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = performance.now();
    setState({ status: "running", progress: null });

    // Only the latest run may update the page (an older, cancelled one may still settle).
    const isLatest = () => abortRef.current === controller;
    const promise = run((progress) => isLatest() && setState({ status: "running", progress }), controller.signal);
    window.__analysis = promise;
    promise.then(
      (analysis) => isLatest() && setState({ status: "done", analysis, ms: Math.round(performance.now() - startedAt) }),
      (error: unknown) => {
        const message = error instanceof AnalyzeError ? `${error.code}: ${error.message}` : String(error);
        if (isLatest()) setState({ status: "error", message });
      },
    );
    return promise;
  }

  function runDemo(): Promise<RepoAnalysis> {
    return start((onProgress, signal) => analyzeDemo(onProgress, signal));
  }

  function runRepo(text: string): Promise<RepoAnalysis> {
    const parsed = parseRepoInput(text);
    if (!parsed.ok) return start(() => Promise.reject(new AnalyzeError("bad_input", parsed.message)));
    return start((onProgress, signal) => analyzeRepo({ owner: parsed.owner, repo: parsed.repo, ref: parsed.ref }, onProgress, signal));
  }

  // Hook for scripted checks (see the comment at the top of this file).
  useEffect(() => {
    window.__runAnalysis = (target) => (target === "demo" ? runDemo() : runRepo(target));
  });

  return (
    <main className="min-h-full bg-cream p-6 font-sans text-ink">
      <h1 className="mb-4 font-title text-lg">Analysis pipeline (dev)</h1>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="rounded bg-leaf px-3 py-1 font-semibold" onClick={runDemo}>
          Analyze demo
        </button>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            runRepo(repoText);
          }}
        >
          <input className="w-80 rounded border-2 border-ink px-2 py-1" placeholder="owner/repo or GitHub URL" value={repoText} onChange={(event) => setRepoText(event.target.value)} />
          <button className="rounded bg-sky px-3 py-1 font-semibold" type="submit">
            Analyze repo
          </button>
        </form>
        {state.status === "running" && (
          <button className="rounded bg-berry px-3 py-1 font-semibold text-cream" onClick={() => abortRef.current?.abort()}>
            Cancel
          </button>
        )}
      </div>

      {state.status === "running" && <p data-testid="progress">{state.progress?.label ?? "Starting…"}</p>}
      {state.status === "error" && <p className="font-semibold text-berry">{state.message}</p>}
      {state.status === "done" && <AnalysisReport analysis={state.analysis} ms={state.ms} />}
    </main>
  );
}

function AnalysisReport({ analysis, ms }: { analysis: RepoAnalysis; ms: number }) {
  const { repo, stats } = analysis;
  const findings = analysis.files.flatMap((file) => file.findings);
  return (
    <section className="space-y-4 text-sm">
      <p>
        <b>
          {repo.owner}/{repo.repo}@{repo.ref}
        </b>{" "}
        ({repo.sha.slice(0, 7)}) — {analysis.demo ? "demo" : `${analysis.stars} stars`} — analyzed in {ms} ms
      </p>
      <pre data-testid="stats" className="rounded bg-cream-deep p-2">
        {JSON.stringify(stats)}
      </pre>
      {analysis.warnings.length > 0 && (
        <ul className="list-disc pl-6 text-wood-deep">
          {analysis.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left">
            <th>File</th>
            <th>Kind</th>
            <th>Lines</th>
            <th>Monsters</th>
            <th>Grade</th>
            <th>Highlights</th>
          </tr>
        </thead>
        <tbody>
          {analysis.files.map((file) => (
            <tr key={file.path} className="border-t border-cream-deep">
              <td className="font-mono">{file.path}</td>
              <td>{file.kind}</td>
              <td>{file.lineCount}</td>
              <td>
                {file.status === "failed" ? "failed" : file.findings.length}
                {file.overflow > 0 && ` (+${file.overflow})`}
              </td>
              <td>
                {file.quality.grade} ({file.quality.score})
              </td>
              <td>{file.quality.highlights.join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left">
            <th>Where</th>
            <th>Code</th>
            <th>Monster</th>
            <th>Title</th>
            <th>Ruff says</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((finding) => (
            <tr key={finding.id} className="border-t border-cream-deep align-top">
              <td className="font-mono">
                {finding.path}:{finding.line}
              </td>
              <td className="font-mono">{finding.code}</td>
              <td>
                {finding.monster} ({finding.severity})
              </td>
              <td title={finding.tip}>{finding.title}</td>
              <td>{finding.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
