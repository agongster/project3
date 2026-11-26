"use client";

/**
 * The town notice board: a friendly infographic of the repo analysis,
 * pinned up as paper notes on a wooden board, topped by up to three WANTED
 * posters (bounties on monsters, quoting the line of code they hide at).
 * Its numbers follow the code as it is now: a bug fixed in the Workshop is
 * no longer found, and the region bars count it as dealt with.
 */
import type { ReactNode } from "react";
import { Modal, PixelBar, PixelPanel } from "@/components/ui/kit";
import { getProgress } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import type { AnalyzedFile } from "@/lib/types";
import { mostCursedFiles, monstersBySeverity, regionRows, tidiestFiles } from "./parts/boardData";
import { findFinding } from "./parts/codexData";
import { BountyNotices } from "./parts/BountyNotices";
import { GradeBadge } from "./parts/GradeBadge";
import { MonsterIcon } from "./parts/MonsterIcon";
import { SEVERITIES, SEVERITY_INFO } from "./parts/monsterText";
import { PanelHeader } from "./parts/PanelHeader";
import { PANEL_LARGE } from "./parts/panelSizes";
import type { OverlayProps } from "./types";

/** Big enough for a 32 px boss at 1× (smaller monsters get 2×). */
const SEVERITY_ICON_BOX = 32;
const SHORT_SHA = 7;

export default function BoardOverlay({ ctx }: OverlayProps<"board">) {
  const { analysis } = ctx;
  const progress = useStore(ctx.save, (save) => getProgress(save, ctx.repoKey));
  const { stats, repo } = analysis;
  const regions = regionRows(analysis, progress);
  const monsterKinds = monstersBySeverity(analysis);
  const { bounties } = ctx;
  const biggestSeverity = Math.max(1, ...SEVERITIES.map((severity) => stats.bySeverity[severity]));

  return (
    <Modal label="Notice board" tone="wood" onClose={ctx.close} className={PANEL_LARGE}>
      <PanelHeader title="Notice Board" subtitle={`${repo.owner}/${repo.repo} · ${analysis.stars} stars`} onClose={ctx.close} />

      <div className="px-scroll grid min-h-0 flex-1 grid-cols-2 content-start gap-3 pr-1">
        {bounties.length > 0 && (
          <Note title="Wanted — bounties" wide>
            <BountyNotices
              bounties={bounties}
              progress={progress}
              onFix={(bounty) => {
                const finding = findFinding(analysis, bounty.findingId);
                if (finding) ctx.openWorkshop({ path: finding.path, line: finding.line });
              }}
            />
          </Note>
        )}

        <Note title="About this repo">
          <p className="font-bold">{analysis.description ?? "No description on GitHub."}</p>
          {analysis.readme && <p className="mt-1 break-words text-sm italic">“{analysis.readme}”</p>}
          <p className="mt-1 text-sm">
            Branch <code className="font-mono">{repo.ref}</code>, commit <code className="font-mono">{repo.sha.slice(0, SHORT_SHA)}</code>
            {analysis.demo && " · the built-in demo kingdom"}
          </p>
        </Note>

        <Note title="By the numbers">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat value={stats.fileCount} label="Python files" />
            <Stat value={stats.lineCount} label="lines" />
            <Stat value={stats.findingCount} label="bugs found" />
            <Stat value={stats.cleanFiles} label="clean files" />
            <Stat value={stats.buggyFiles} label="cursed files" />
            <Stat value={regions.length} label="regions" />
          </div>
        </Note>

        <Note title="Monsters by severity">
          <ul className="flex flex-col gap-2">
            {SEVERITIES.map((severity) => (
              <li key={severity} className="grid grid-cols-[64px_104px_minmax(0,1fr)_28px] items-center gap-2 text-sm">
                <span className="font-bold" style={{ color: SEVERITY_INFO[severity].color }}>
                  {SEVERITY_INFO[severity].plural}
                </span>
                <span className="flex">
                  {monsterKinds[severity].slice(0, 3).map((kind) => (
                    <MonsterIcon key={kind} kind={kind} box={SEVERITY_ICON_BOX} />
                  ))}
                </span>
                <PixelBar value={stats.bySeverity[severity] / biggestSeverity} color={SEVERITY_INFO[severity].color} className="h-3" />
                <span className="text-right font-bold tabular-nums">{stats.bySeverity[severity]}</span>
              </li>
            ))}
          </ul>
        </Note>

        <Note title="Regions">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase opacity-70">
                <th className="font-bold">Region</th>
                <th className="font-bold">Files</th>
                <th className="font-bold">Bugs</th>
                <th className="w-1/3 font-bold">Squashed</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((row) => (
                <tr key={row.name}>
                  <td className="max-w-0 truncate pr-2 font-bold">{row.name}</td>
                  <td className="tabular-nums">{row.files}</td>
                  <td className="tabular-nums">{row.bugs}</td>
                  <td className="py-1">
                    {row.bugs + row.fixed === 0 ? (
                      <span className="text-xs font-bold text-leaf-deep">Spotless!</span>
                    ) : (
                      <PixelBar
                        value={(row.defeated + row.fixed) / (row.bugs + row.fixed)}
                        className="h-2"
                        label={row.fixed === 0 ? `${row.defeated} of ${row.bugs} squashed` : `${row.defeated} squashed and ${row.fixed} fixed in the code, of ${row.bugs + row.fixed}`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Note>

        <Note title="Tidiest scrolls">
          <FileList files={tidiestFiles(analysis)} empty="No file is completely bug-free yet." render={(file) => <TidyFile file={file} />} />
        </Note>

        <Note title="Most cursed">
          <FileList files={mostCursedFiles(analysis)} empty="No curses anywhere. Spotless!" render={(file) => <CursedFile file={file} />} />
        </Note>

        {analysis.warnings.length > 0 && (
          <Note title="Notices" wide>
            <ul className="list-inside list-disc text-sm">
              {analysis.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Note>
        )}

        <Note title="How this world was made" wide>
          <p className="text-sm leading-relaxed">
            Lintlands only reads a repo&apos;s Python files. They were downloaded from GitHub and checked right here in your
            browser by Ruff, a real Python linter. Every top-level folder became a region and every file a building. Each
            problem Ruff found became one monster in that file&apos;s dungeon; the more serious the problem, the tougher the
            monster. Files with no findings became treasure houses, and their chest is better the higher the file&apos;s
            quality grade (S to C), which comes from docstrings, type hints, helpful comments and how short and simple the
            functions are.
          </p>
        </Note>
      </div>
    </Modal>
  );
}

/** A cream paper note pinned to the board. */
function Note({ title, wide, children }: { title: string; wide?: boolean; children: ReactNode }) {
  return (
    <PixelPanel className={wide ? "col-span-2 p-3" : "p-3"}>
      <span aria-hidden="true" className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 bg-berry shadow-[0_2px_0_0_#8a2f33]" />
      <h3 className="mb-2 font-title text-[10px] uppercase leading-normal">{title}</h3>
      {children}
    </PixelPanel>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-cream-deep/70 py-1">
      <p className="font-title text-sm tabular-nums">{value.toLocaleString()}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

interface FileListProps {
  files: AnalyzedFile[];
  empty: string;
  render: (file: AnalyzedFile) => ReactNode;
}

function FileList({ files, empty, render }: FileListProps) {
  if (files.length === 0) return <p className="text-sm">{empty}</p>;
  return (
    <ol className="flex flex-col gap-2">
      {files.map((file) => (
        <li key={file.path}>{render(file)}</li>
      ))}
    </ol>
  );
}

function TidyFile({ file }: { file: AnalyzedFile }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <GradeBadge grade={file.quality.grade} size="sm" />
      <div className="min-w-0">
        <p className="truncate font-bold">{file.path}</p>
        <p className="text-xs">{file.quality.highlights.join(" · ") || "Nothing for Ruff to complain about"}</p>
      </div>
    </div>
  );
}

function CursedFile({ file }: { file: AnalyzedFile }) {
  const count = file.findings.length + file.overflow;
  const worst = file.findings.find((finding) => finding.severity === "boss") ?? file.findings[0];
  return (
    <div className="flex items-center gap-2 text-sm">
      {worst && <MonsterIcon kind={worst.monster} box={SEVERITY_ICON_BOX} />}
      <p className="min-w-0 flex-1 truncate font-bold">{file.path}</p>
      <p className="shrink-0 font-bold text-berry">
        {count} bug{count === 1 ? "" : "s"}
      </p>
    </div>
  );
}
