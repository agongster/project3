"use client";

/**
 * Everything drawn over the code: the first-run help or "pick a file" when
 * no file is open, the loading / failed state of a file (with Retry), the
 * forge moment and purified banner, and warnings (Polish on broken code).
 */
import { useState } from "react";
import type { ShownMoment, Tick } from "../hooks/useForging";
import { markHelpSeen, useHelpSeen } from "../hooks/useHelpSeen";
import { ForgeMomentCard, PurifiedBanner } from "./ForgeMoment";
import { HelpPanel } from "./HelpPanel";

interface EditorLayersProps {
  active: string | null;
  loaded: boolean;
  loadError: string | null;
  onRetry: (path: string) => void;
  moment: ShownMoment | null;
  onMomentDone: () => void;
  tick: Tick | null;
}

export function EditorLayers({ active, loaded, loadError, onRetry, moment, onMomentDone, tick }: EditorLayersProps) {
  const helpSeen = useHelpSeen();
  const [bannerDone, setBannerDone] = useState<number | null>(null);
  const showBanner = moment !== null && moment.moment.purified.length > 0 && bannerDone !== moment.id;

  return (
    <>
      {active === null && (
        <div className="ws-editor-state ws-editor-empty">
          {helpSeen ? (
            <p>Pick a file in the village on the left, or press Ctrl/Cmd+P to open one by name.</p>
          ) : (
            <HelpPanel onDismiss={markHelpSeen} dismissLabel="Got it" />
          )}
        </div>
      )}
      {active !== null && !loaded && (
        <div className="ws-editor-state">
          {loadError ? (
            <>
              <p className="ws-load-error">{loadError}</p>
              <button type="button" className="px-btn gold small" onClick={() => onRetry(active)}>
                Retry
              </button>
            </>
          ) : (
            <p className="ws-faint">Unrolling the scroll…</p>
          )}
        </div>
      )}
      {moment && <ForgeMomentCard key={moment.id} shown={moment} onDone={onMomentDone} />}
      {showBanner && <PurifiedBanner key={`banner-${moment.id}`} shown={moment} onDone={() => setBannerDone(moment.id)} />}
      {tick?.tone === "warn" && (
        <p key={tick.id} className="ws-toast" role="alert">
          {tick.text}
        </p>
      )}
    </>
  );
}
