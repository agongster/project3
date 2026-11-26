"use client";

/**
 * The pause menu: resume, jump to the Workshop / bag / codex / wardrobe,
 * sound and screen-shake settings, a controls cheat-sheet, and "Leave world"
 * (with a confirm step, although progress is always saved).
 */
import { useState, type ReactNode } from "react";
import { KeyCap, Modal, PixelButton } from "@/components/ui/kit";
import { setSettings } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import type { OverlayProps, OverlayRequest } from "./types";

/** What each key does, for the cheat-sheet. Matches the engine's key bindings. */
const CONTROLS: readonly { action: string; keys: readonly string[] }[] = [
  { action: "Move", keys: ["WASD", "Arrows"] },
  { action: "Attack", keys: ["Space", "J", "Click"] },
  { action: "Dash", keys: ["Shift", "K"] },
  { action: "Interact / fix a glowing line", keys: ["E", "Enter"] },
  { action: "Bag", keys: ["I", "B"] },
  { action: "Codex", keys: ["C"] },
  { action: "Workshop", keys: ["F"] },
  { action: "Map", keys: ["M"] },
  { action: "Menu", keys: ["Esc", "Tab"] },
];

const SHORTCUTS: readonly { label: string; request: OverlayRequest; tone: "sky" | "grape" | "rose" }[] = [
  { label: "Bag", request: { kind: "bag" }, tone: "sky" },
  { label: "Codex", request: { kind: "codex" }, tone: "grape" },
  { label: "Wardrobe", request: { kind: "wardrobe" }, tone: "rose" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-bold text-ink-soft">{title}</h3>
      {children}
    </section>
  );
}

function VolumeSlider({ label, value, onChange, onRelease }: { label: string; value: number; onChange: (value: number) => void; onRelease?: () => void }) {
  const percent = Math.round(value * 100);
  return (
    <label className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-2">
      <span className="font-semibold">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        onPointerUp={onRelease}
        onKeyUp={onRelease}
        className="w-full accent-grape"
        aria-valuetext={`${percent}%`}
      />
      <span className="text-right font-bold tabular-nums">{percent}%</span>
    </label>
  );
}

export default function PauseOverlay({ ctx }: OverlayProps<"pause">) {
  const settings = useStore(ctx.save, (s) => s.settings);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Only the save is updated here: the app keeps the audio engine's volumes in sync
  // with the saved settings (see useAudioSetup), so the change is heard at once.
  const updateSettings = (patch: Partial<typeof settings>) => ctx.save.set((s) => setSettings(s, patch));

  const resume = () => {
    ctx.audio.sfx("uiBack");
    ctx.close();
  };

  return (
    <Modal label="Paused" onClose={resume} className="w-[min(720px,100%)] overflow-y-auto p-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="font-title text-pixel-md leading-relaxed">Paused</h2>
        <PixelButton onClick={resume}>Resume ▶</PixelButton>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Section title="Go to">
            <div className="flex flex-wrap">
              {SHORTCUTS.map((shortcut) => (
                <PixelButton
                  key={shortcut.label}
                  tone={shortcut.tone}
                  onClick={() => {
                    ctx.audio.sfx("uiSelect");
                    ctx.open(shortcut.request);
                  }}
                >
                  {shortcut.label}
                </PixelButton>
              ))}
              <PixelButton
                tone="cream"
                onClick={() => {
                  ctx.audio.sfx("uiSelect");
                  ctx.openWorkshop();
                }}
              >
                Workshop
              </PixelButton>
            </div>
          </Section>

          <Section title="Settings">
            <VolumeSlider label="Sound" value={settings.sfx} onChange={(sfx) => updateSettings({ sfx })} onRelease={() => ctx.audio.sfx("coin")} />
            <VolumeSlider label="Music" value={settings.music} onChange={(music) => updateSettings({ music })} />
            <label className="flex cursor-pointer items-center gap-2 font-semibold">
              <input type="checkbox" className="h-5 w-5 accent-grape" checked={settings.screenShake} onChange={(event) => updateSettings({ screenShake: event.target.checked })} />
              Screen shake
            </label>
          </Section>

          <div className="mt-auto border-t-4 border-cream-deep pt-3">
            {confirmLeave ? (
              <div className="anim-pop flex flex-col gap-1">
                <p className="font-semibold">Leave this world? Your progress is saved.</p>
                <div className="flex flex-wrap">
                  <PixelButton tone="cream" onClick={() => setConfirmLeave(false)}>
                    Stay
                  </PixelButton>
                  <PixelButton
                    tone="berry"
                    onClick={() => {
                      ctx.audio.sfx("uiBack");
                      ctx.exitToTitle();
                    }}
                  >
                    Leave world
                  </PixelButton>
                </div>
              </div>
            ) : (
              <PixelButton tone="berry" onClick={() => setConfirmLeave(true)}>
                Leave world…
              </PixelButton>
            )}
          </div>
        </div>

        <Section title="Controls">
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-[15px]">
            {CONTROLS.map((control) => (
              <div key={control.action} className="contents">
                <dt className="font-bold">{control.action}</dt>
                <dd className="flex flex-wrap items-center gap-y-1">
                  {control.keys.map((key) => (
                    <KeyCap key={key}>{key}</KeyCap>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </Modal>
  );
}
