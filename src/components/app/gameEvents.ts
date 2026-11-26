/**
 * What the game screen does with each event the engine emits. Three kinds:
 *
 *  - "pausing" events open an overlay (the engine has already paused itself),
 *  - the "workshop" event (also pausing) opens the Workshop instead,
 *  - "news" events show a toast or banner over the running game.
 *
 * Also here: the words of the one-time lesson the first time a monster is
 * subdued in a save (`teachSubdued`; lessons.ts remembers it was taught).
 */
import type { AudioApi, GameEvent, WorkshopTarget } from "@/game/bridge";
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
      return event.edit ? { kind: "dialog", speaker: event.speaker, lines: event.lines, edit: event.edit } : { kind: "dialog", speaker: event.speaker, lines: event.lines };
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

/** Where to open the Workshop for a "workshop" event, or null for every other event. */
export function workshopForEvent(event: GameEvent): WorkshopTarget | null {
  return event.type === "workshop" ? event.target : null;
}

/** The banner when the last fighting monster of a dungeon is subdued. */
export const QUIET_BANNER = { title: "THE DUNGEON IS QUIET", subtitle: "now fix its lines" };

/**
 * The lesson the first time a monster is subdued in a save: the loop in a
 * banner and two toasts (fight → stand on the glowing line → E → fix → Forge).
 */
export const SUBDUED_LESSON = {
  banner: { title: "SUBDUED!", subtitle: "its bug is still in the code" },
  toasts: [
    { text: "Stand on its glowing line, press E", detail: "the Workshop opens right on that line" },
    { text: "Fix the line, then Forge (Ctrl/Cmd+S)", detail: "that defeats the monster for good" },
  ],
} as const;

/** Shows the first-subdue lesson (the caller remembers that it was taught). */
export function teachSubdued(feed: Feed): void {
  feed.banner({ ...SUBDUED_LESSON.banner, tone: "quiet" });
  for (const toast of SUBDUED_LESSON.toasts) feed.toast({ ...toast, tone: "info", icon: { type: "star" } });
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
        text: `${event.finding.title} subdued!`,
        detail: `${event.finding.code} · fix line ${event.finding.line} to finish it`,
        tone: "good",
        icon: { type: "monster", kind: event.finding.monster },
        coins: event.coins,
      });
      break;
    case "quiet":
      feed.banner({ title: QUIET_BANNER.title, subtitle: QUIET_BANNER.subtitle, tone: "quiet" });
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
