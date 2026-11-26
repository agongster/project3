"use client";

/**
 * Every way to customise the hero: name, quick-start presets, five
 * sections of options (Body / Hair / Face / Outfit / Extras, see
 * lookSections.ts) and the hat, plus "Surprise me", a shuffle for the open
 * section and Undo (also Ctrl/Cmd+Z).
 *
 * It is "controlled": it shows the `look`/`hatId` it is given and reports
 * changes, so the creator can edit a draft while the wardrobe edits the
 * save directly.
 */
import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import type { AudioApi } from "@/game/bridge";
import { cx, PixelButton } from "@/components/ui/kit";
import { sanitizeName } from "@/lib/game";
import { HATS, getItem } from "@/lib/game/catalog";
import type { CharacterLook } from "@/lib/types";
import { HeroSwatch } from "./HeroSwatch";
import { getSection, shuffleSection, surpriseLook, type SectionId } from "./lookSections";
import { GroupFrame, OptionGroup, SWATCH_SCALE } from "./OptionGroup";
import { PresetStrip } from "./PresetStrip";
import { panelId, SectionTabs, tabId } from "./SectionTabs";
import { SwatchGrid } from "./SwatchGrid";
import { sameSnapshot, useLookHistory, type LookSnapshot } from "./useLookHistory";

/** Names are drawn above the hero's head and in the HUD, so keep them short. */
export const NAME_MAX_CHARS = 12;

/**
 * Height every section's panel gets (the Hair section, the tallest, needs
 * about this much), so switching tabs never makes the page or overlay jump.
 * In compact mode the panel may shrink below it and scroll instead; it is a
 * little taller there for the padding that keeps focus rings inside its
 * scroll box.
 */
const PANEL_HEIGHT = { page: "14.5rem", compact: "15.5rem" };

/** "Surprise me" leaves the hat off this often (a hat hides the new hair). */
const SURPRISE_NO_HAT_CHANCE = 0.5;

const randomSeed = () => Math.floor(Math.random() * 1_000_000);

interface Props {
  look: CharacterLook;
  hatId: string | null;
  /** Hats the player may wear (catalog ids). */
  ownedHatIds: readonly string[];
  onLookChange: (patch: Partial<CharacterLook>) => void;
  onHatChange: (hatId: string | null) => void;
  audio: AudioApi;
  /** Shown at the right end of the button row (e.g. a Done button). */
  footer?: ReactNode;
  /**
   * For the in-game wardrobe: no preset captions, and on small windows the
   * option panel scrolls inside the height the editor is given, so the name,
   * tabs and buttons always stay in view.
   */
  compact?: boolean;
  /** False where there is no room for the "Quick start" row (the presets stay in the hero creator). */
  showPresets?: boolean;
}

export function LookEditor({ look, hatId, ownedHatIds, onLookChange, onHatChange, audio, footer, compact = false, showPresets = true }: Props) {
  const [sectionId, setSectionId] = useState<SectionId>("body");
  const history = useLookHistory();
  const idPrefix = useId();
  const section = getSection(sectionId);
  // "No hat" first, then owned hats in catalog order.
  const hatOptions: (string | null)[] = [null, ...HATS.filter((hat) => ownedHatIds.includes(hat.id)).map((hat) => hat.id)];
  const randomHat = () => (Math.random() < SURPRISE_NO_HAT_CHANCE ? null : hatOptions[Math.floor(Math.random() * hatOptions.length)]);

  /** Applies a change, remembering the hero as it was so Undo can bring it back. */
  const change = (patch: Partial<CharacterLook>, nextHat: string | null = hatId) => {
    const before: LookSnapshot = { look, hatId };
    if (sameSnapshot(before, { look: { ...look, ...patch }, hatId: nextHat })) return;
    history.remember(before);
    if (Object.keys(patch).length > 0) onLookChange(patch);
    if (nextHat !== hatId) onHatChange(nextHat);
  };

  const pick = (patch: Partial<CharacterLook>, nextHat?: string | null) => {
    audio.sfx("uiMove");
    change(patch, nextHat);
  };

  const undo = () => {
    const before = history.takeBack();
    if (!before) return;
    audio.sfx("uiBack");
    onLookChange(before.look);
    if (before.hatId !== hatId) onHatChange(before.hatId);
  };

  const surprise = () => {
    audio.sfx("uiSelect");
    change(surpriseLook(look, randomSeed()), randomHat());
  };

  const shuffle = () => {
    audio.sfx("uiSelect");
    change(shuffleSection(sectionId, randomSeed()), section.hats ? randomHat() : hatId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Ctrl/Cmd+Z undoes the last change, except while typing a name (the text box has its own undo).
    const typing = event.target instanceof HTMLInputElement;
    if (!typing && (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    }
  };

  return (
    <div className={cx("flex flex-col gap-2", compact && "min-h-0")} onKeyDown={onKeyDown}>
      <div className="flex items-center gap-2">
        {/* `key` restarts the field's draft whenever the saved name changes elsewhere. */}
        <NameField key={look.name} name={look.name} onCommit={(name) => change({ name })} />
        <PixelButton tone="cream" small disabled={!history.canUndo} onClick={undo} aria-keyshortcuts="Control+Z Meta+Z" title="Undo the last change (Ctrl+Z)">
          ↶ Undo
        </PixelButton>
      </div>

      {showPresets && <PresetStrip name={look.name} compact={compact} onPick={(preset) => pick(preset)} />}

      <SectionTabs value={sectionId} onChange={setSectionId} idPrefix={idPrefix} />
      <div
        role="tabpanel"
        id={panelId(idPrefix, sectionId)}
        aria-labelledby={tabId(idPrefix, sectionId)}
        className={cx("flex flex-col gap-1.5", compact && "min-h-0 flex-1 overflow-y-auto p-1")}
        style={compact ? { flexBasis: PANEL_HEIGHT.compact } : { minHeight: PANEL_HEIGHT.page }}
      >
        {section.groups.map((group) => (
          <OptionGroup key={group.field} group={group} look={look} onPick={(patch) => pick(patch)} />
        ))}
        {section.hats && <HatGroup look={look} hatId={hatId} hatOptions={hatOptions} onPick={(id) => pick({}, id)} />}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t-4 border-cream-deep pt-2">
        <PixelButton tone="grape" onClick={surprise}>
          🎲 Surprise me
        </PixelButton>
        <PixelButton tone="sky" small onClick={shuffle}>
          Shuffle {section.label.toLowerCase()}
        </PixelButton>
        <div className="ml-auto">{footer}</div>
      </div>
    </div>
  );
}

interface HatGroupProps {
  look: CharacterLook;
  hatId: string | null;
  hatOptions: readonly (string | null)[];
  onPick: (hatId: string | null) => void;
}

/** The hats the player owns, previewed on the hero. More come from chests and the wishing well. */
function HatGroup({ look, hatId, hatOptions, onPick }: HatGroupProps) {
  const names = hatOptions.map((id) => (id ? (getItem(id)?.name ?? id) : "No hat"));
  const selected = Math.max(0, hatOptions.indexOf(hatId));
  return (
    <GroupFrame label="Hat" choiceName={names[selected]} position={selected} count={names.length}>
      <SwatchGrid
        label="Hat"
        names={names}
        selected={selected}
        onPick={(position) => onPick(hatOptions[position])}
        variant="tile"
        renderSwatch={(position) => <HeroSwatch look={look} hatId={hatOptions[position]} crop="head" scale={SWATCH_SCALE.head} />}
      />
      {hatOptions.length <= HATS.length && <p className="text-sm text-ink-soft">More hats hide in treasure chests and the wishing well.</p>}
    </GroupFrame>
  );
}

/**
 * The name box keeps what the player is typing locally and only commits it
 * on blur or Enter, because the save tidies names (an empty name becomes
 * "Hero"), which would fight the player mid-word if done on every keystroke.
 */
function NameField({ name, onCommit }: { name: string; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(name);

  const commit = () => {
    const clean = sanitizeName(draft);
    setDraft(clean);
    if (clean !== name) onCommit(clean);
  };

  return (
    <label className="flex min-w-0 flex-1 items-center gap-2">
      <span className="font-label text-xs text-ink-soft">Name</span>
      <input
        className="px-input min-w-0 flex-1"
        value={draft}
        maxLength={NAME_MAX_CHARS}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
    </label>
  );
}
