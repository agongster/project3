/**
 * What the game screen does with each event the engine emits. Two kinds:
 *
 *  - "pausing" events open an overlay (the engine has already paused itself),
 *  - "news" events show a toast or banner over the running game.
 */
import type { AudioApi, GameEvent } from "@/game/bridge";
import type { OverlayRequest } from "@/components/overlays/types";
import type { Feed } from "@/components/hud/feed";

/** The overlay a pausing event asks for, or null for news events. */
export function overlayForEvent(event: GameEvent): OverlayRequest | null {
  switch (event.type) {
    case "chest":
      return { kind: "chest", source: event.source, path: event.path };
    case "gacha":
      return { kind: "gacha" };
    case "wardrobe":
      return { kind: "wardrobe" };
    case "board":
      return { kind: "board" };
    case "dialog":
      return { kind: "dialog", speaker: event.speaker, lines: event.lines };
    case "bugCard":
      return { kind: "bugCard", finding: event.finding };
    case "finisher":
      return { kind: "finisher", finding: event.finding };
    case "victory":
      return { kind: "victory" };
    case "menu":
      return { kind: "pause" };
    default:
      return null;
  }
}

/** The file name without its folders, which fits nicely in a banner. */
function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Shows the toast / banner (and plays the sound) for a news event. Pausing events are ignored. */
export function announceEvent(event: GameEvent, feed: Feed, audio: AudioApi): void {
  switch (event.type) {
    case "squashed":
      feed.toast({
        text: `${event.finding.title} squashed!`,
        detail: event.finding.code,
        tone: "good",
        icon: { type: "monster", kind: event.finding.monster },
        coins: event.coins,
      });
      break;
    case "purified":
      audio.sfx("purify");
      feed.banner({ title: "DUNGEON PURIFIED!", subtitle: baseName(event.path), tone: "purify" });
      break;
    case "levelUp":
      audio.sfx("levelUp");
      feed.banner({ title: "LEVEL UP!", subtitle: `Level ${event.level} — ${event.title}`, tone: "level" });
      break;
    case "toast":
      feed.toast({ text: event.text, tone: event.tone });
      break;
    default:
      break;
  }
}
