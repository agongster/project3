/**
 * Quest news in the WORLD (outside the Workshop) is shown as the game's own
 * small toasts, in the HUD's bounded toast stack, never as a new layer: a
 * quest completed by fighting, an achievement for a wish… (Inside the
 * Workshop the Quests panel's own news component shows them.)
 */
import type { Toast } from "@/components/hud/feed";
import { newsLine, type QuestNewsItem } from "@/lib/game";

/** The HUD toast for one piece of quest news, or null when it is not worth one. */
export function questToast(item: QuestNewsItem): Omit<Toast, "id" | "leaving"> | null {
  const text = newsLine(item);
  if (text === null) return null;
  const coins = item.type === "quest" ? item.quest.reward.coins : item.type === "achievement" || item.type === "streak" ? item.reward.coins : 0;
  return { text, tone: "good", icon: { type: "star" }, ...(coins > 0 && { coins }) };
}
