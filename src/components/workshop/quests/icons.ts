/**
 * Which existing sprite stands for what in the quest UI. Plain data (drawn by
 * ArtIcon), defined once here so every icon object keeps the same identity
 * between renders and ArtIcon only redraws when the picture really changes.
 */
import type { AchievementIcon } from "@/lib/game/achievements";
import type { Quest, QuestKind } from "@/lib/game/quests";
import { MONSTER_KINDS } from "@/lib/types";
import type { MonsterKind } from "@/lib/types";

/** A quest's picture when it is not about one monster. */
const KIND_ICONS: Readonly<Record<QuestKind, AchievementIcon>> = {
  fix: { type: "item", id: "bugNet" },
  document: { type: "item", id: "docScarf" },
  grade: { type: "ui", name: "star" },
  purify: { type: "item", id: "halo" },
  tidy: { type: "item", id: "lintRoller" },
};

const MONSTER_ICONS = Object.fromEntries(MONSTER_KINDS.map((kind) => [kind, { type: "monster", kind }])) as Record<MonsterKind, AchievementIcon>;

export const COIN_ICON: AchievementIcon = { type: "ui", name: "coinBig" };
export const XP_ICON: AchievementIcon = { type: "ui", name: "xpGem" };
export const CHECK_ICON: AchievementIcon = { type: "ui", name: "checkmark" };
export const STREAK_ICON: AchievementIcon = { type: "item", id: "refactorHammer" };
export const LEVEL_ICON: AchievementIcon = { type: "ui", name: "star" };

/** A "Fix it for real" quest shows its monster; the others show their kind's picture. */
export function questIcon(quest: Pick<Quest, "kind" | "monster">): AchievementIcon {
  return quest.monster ? MONSTER_ICONS[quest.monster] : KIND_ICONS[quest.kind];
}
