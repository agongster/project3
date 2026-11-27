"use client";

/**
 * The Workshop's top bar: where you are (repo › folders › file), what you
 * have (coins and level from the save, ticking up when a forge pays), and
 * the big actions (Forge, Forge all, Polish, Back to the world), each with
 * its shortcut printed on it.
 */
import { PixelSprite } from "@/components/overlays/parts/PixelSprite";
import { uiIcon } from "@/components/overlays/parts/sprites";
import { useTweenedNumber } from "@/components/hud/useTweenedNumber";
import { PixelButton } from "@/components/ui/kit";
import type { MouseEvent } from "react";
import { levelForXp } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import type { SaveData, Store } from "@/lib/types";
import { ShortcutKeys, clip, useShortcutText } from "./bits";

/** Longest repo name and path part drawn in the breadcrumbs. */
const MAX_CRUMB_LENGTH = 40;

interface TopBarProps {
  repoName: string;
  activePath: string | null;
  save: Store<SaveData>;
  /** A file is open and loaded. */
  canForge: boolean;
  /** The file in front has unforged typing: the Forge button glows. */
  hot: boolean;
  /** How many files have unforged typing. */
  dirtyCount: number;
  canPolish: boolean;
  busy: boolean;
  onForge: () => void;
  onForgeAll: () => void;
  onPolish: () => void;
  onHelp: () => void;
  onBack: () => void;
}

/** Clicking a toolbar button leaves the keyboard where it was (in the code), like a desktop editor; Tab still reaches the buttons. */
function keepFocus(event: MouseEvent) {
  event.preventDefault();
}

function Breadcrumbs({ repoName, path }: { repoName: string; path: string | null }) {
  const parts = path ? path.split("/").filter(Boolean) : [];
  return (
    <ol className="ws-crumbs" aria-label="Location">
      <li className="ws-crumb-repo">{clip(repoName, MAX_CRUMB_LENGTH)}</li>
      {parts.map((part, i) => (
        <li key={`${i}:${part}`} className={i === parts.length - 1 ? "ws-crumb-file" : undefined}>
          {clip(part, MAX_CRUMB_LENGTH)}
        </li>
      ))}
    </ol>
  );
}

function Purse({ save }: { save: Store<SaveData> }) {
  const coins = useStore(save, (s) => s.coins);
  const xp = useStore(save, (s) => s.xp);
  const shownCoins = useTweenedNumber(coins);
  const level = levelForXp(xp);
  return (
    <div className="ws-purse" aria-label={`${coins} coins, level ${level.level}`}>
      <span className="ws-purse-coins">
        <PixelSprite sprite={uiIcon("coin")} scale={2} />
        <span className="tabular-nums">{shownCoins}</span>
      </span>
      <span className="ws-purse-level" title={level.title}>
        Lv {level.level}
      </span>
    </div>
  );
}

export function TopBar(props: TopBarProps) {
  const { repoName, activePath, save, canForge, hot, dirtyCount, canPolish, busy } = props;
  const forgeText = useShortcutText("forge");
  const forgeAllText = useShortcutText("forgeAll");
  const polishText = useShortcutText("polish");
  return (
    <header className="ws-top">
      <div className="ws-top-title">
        <span className="font-title ws-logo">Workshop</span>
        <Breadcrumbs repoName={repoName} path={activePath} />
      </div>
      <Purse save={save} />
      <div className="ws-actions" role="toolbar" aria-label="Workshop actions">
        <PixelButton
          tone="gold"
          small
          className={hot ? "ws-forge-hot" : undefined}
          disabled={!canForge}
          aria-busy={busy}
          onMouseDown={keepFocus}
          onClick={props.onForge}
          title={`Save: stores your code, checks it again and updates the world (${forgeText})`}
          data-ws-primary
        >
          {busy ? "Saving…" : "Save"} <ShortcutKeys command="forge" />
        </PixelButton>
        {dirtyCount > 1 && (
          <PixelButton tone="cream" small onMouseDown={keepFocus} onClick={props.onForgeAll} title={`Save every file with unsaved typing (${forgeAllText})`}>
            Save all {dirtyCount} <ShortcutKeys command="forgeAll" />
          </PixelButton>
        )}
        <PixelButton tone="sky" small disabled={!canPolish} onMouseDown={keepFocus} onClick={props.onPolish} title={`Polish: format the code with Ruff (${polishText})`}>
          Polish <ShortcutKeys command="polish" />
        </PixelButton>
        <PixelButton tone="cream" small onClick={props.onHelp} aria-label="How the Workshop works" title="How the Workshop works">
          ?
        </PixelButton>
        <PixelButton tone="rose" small onClick={props.onBack} title={dirtyCount > 0 ? "Your unsaved typing stays here for next time" : "Back to the world"}>
          Back to the world <ShortcutKeys command="back" />
        </PixelButton>
      </div>
    </header>
  );
}
