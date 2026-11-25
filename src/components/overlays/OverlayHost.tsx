"use client";

/**
 * Renders whichever overlay is currently requested (or nothing).
 * One switch statement = one place to see every overlay the game has.
 */
import BagOverlay from "./BagOverlay";
import BoardOverlay from "./BoardOverlay";
import BugCardOverlay from "./BugCardOverlay";
import ChestOverlay from "./ChestOverlay";
import CodexOverlay from "./CodexOverlay";
import DialogOverlay from "./DialogOverlay";
import GachaOverlay from "./GachaOverlay";
import PauseOverlay from "./PauseOverlay";
import VictoryOverlay from "./VictoryOverlay";
import WardrobeOverlay from "./WardrobeOverlay";
import type { OverlayContext, OverlayRequest } from "./types";

interface Props {
  request: OverlayRequest | null;
  ctx: OverlayContext;
}

export function OverlayHost({ request, ctx }: Props) {
  if (!request) return null;
  switch (request.kind) {
    case "chest":
      // `key` remounts the overlay when a different chest is opened back-to-back.
      return <ChestOverlay key={`${request.source}:${request.path}`} request={request} ctx={ctx} />;
    case "gacha":
      return <GachaOverlay request={request} ctx={ctx} />;
    case "bag":
      return <BagOverlay request={request} ctx={ctx} />;
    case "wardrobe":
      return <WardrobeOverlay request={request} ctx={ctx} />;
    case "codex":
      return <CodexOverlay request={request} ctx={ctx} />;
    case "board":
      return <BoardOverlay request={request} ctx={ctx} />;
    case "bugCard":
      return <BugCardOverlay key={request.finding.id} request={request} ctx={ctx} />;
    case "victory":
      return <VictoryOverlay request={request} ctx={ctx} />;
    case "dialog":
      return <DialogOverlay key={`${request.speaker}:${request.lines[0] ?? ""}`} request={request} ctx={ctx} />;
    case "pause":
      return <PauseOverlay request={request} ctx={ctx} />;
  }
}
