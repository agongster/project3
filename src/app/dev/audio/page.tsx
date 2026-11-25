"use client";

/**
 * Sound test page (/dev/audio): audition every sound effect and music track,
 * try the theme tints and volume sliders, and run the offline self-test.
 * `window.__audioReport()` runs the same self-test from a script.
 */
import { useEffect, useState } from "react";
import type { AudioApi, MusicTrack, SfxName } from "@/game/bridge";
import type { ThemeId } from "@/lib/types";
import { THEMES } from "@/lib/game/catalog";
import * as audioLib from "@/game/audio";
import {
  createAudio,
  MUSIC_TRACKS,
  runAudioSelfTest,
  SFX_NAMES,
  SONGS,
  WebAudioEngine,
  type AudioReport,
} from "@/game/audio";

declare global {
  interface Window {
    __audioReport?: (options?: { fullLoops?: boolean }) => Promise<AudioReport>;
    __audio?: AudioApi;
    /** The whole audio module, for experiments in the browser console. */
    __audioLib?: typeof audioLib;
  }
}

const DEFAULT_SFX_VOLUME = 0.8;
const DEFAULT_MUSIC_VOLUME = 0.6;

// One audio engine for the page, created lazily in the browser (never during server rendering).
let audio: AudioApi | null = null;
function getAudio(): AudioApi {
  if (!audio) audio = createAudio();
  return audio;
}

const button =
  "rounded-md border-2 border-white/20 bg-[#2c2552] px-3 py-2 text-sm hover:bg-[#3b3270] active:translate-y-px disabled:opacity-40";
const activeButton = "rounded-md border-2 border-[#ffd166] bg-[#5a4a9e] px-3 py-2 text-sm";

export default function AudioTestPage() {
  const [status, setStatus] = useState("locked — click “Enable audio”");
  const [track, setTrack] = useState<MusicTrack | null>(null);
  const [theme, setTheme] = useState<ThemeId>("meadow");
  const [sfxVolume, setSfxVolume] = useState(DEFAULT_SFX_VOLUME);
  const [musicVolume, setMusicVolume] = useState(DEFAULT_MUSIC_VOLUME);
  const [report, setReport] = useState<AudioReport | null>(null);
  const [testing, setTesting] = useState(false);
  const [lastSfx, setLastSfx] = useState<SfxName | null>(null);

  useEffect(() => {
    const a = getAudio();
    a.setVolumes(DEFAULT_SFX_VOLUME, DEFAULT_MUSIC_VOLUME);
    window.__audio = a;
    window.__audioLib = audioLib;
    window.__audioReport = async (options) => {
      const result = await runAudioSelfTest(options);
      setReport(result);
      return result;
    };
    // Show the engine's state (locked / suspended / running, clock, track).
    const poll = setInterval(() => {
      if (a instanceof WebAudioEngine) {
        const d = a.debugInfo();
        setStatus(`${d.state} · clock ${d.time}s · track ${d.track ?? "none"} · ${d.activeTracks} active · theme ${d.theme}`);
      }
    }, 500);
    return () => {
      clearInterval(poll);
      a.music(null);
      delete window.__audioReport;
      delete window.__audio;
      delete window.__audioLib;
    };
  }, []);

  const playTrack = (t: MusicTrack | null) => {
    getAudio().music(t);
    setTrack(t);
  };

  const coinCombo = () => {
    for (let i = 0; i < 12; i++) {
      setTimeout(() => getAudio().sfx("coin", { pitch: 0.8 + (1.2 * i) / 11 }), i * 70);
    }
  };

  const runSelfTest = async (fullLoops: boolean) => {
    setTesting(true);
    try {
      setReport(await runAudioSelfTest({ fullLoops }));
    } finally {
      setTesting(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="font-[family-name:var(--font-title)] text-lg">Lintlands · Sound Test</h1>
        <p className="text-sm opacity-80">
          Everything is synthesized live with the Web Audio API. Browsers need a click before any sound can play.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button className={button} onClick={() => getAudio().unlock()}>
            🔊 Enable audio
          </button>
          <code className="text-xs opacity-70">{status}</code>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-bold">Sound effects</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {SFX_NAMES.map((name) => (
            <button
              key={name}
              className={lastSfx === name ? activeButton : button}
              onClick={() => {
                getAudio().sfx(name);
                setLastSfx(name);
              }}
            >
              {name}
            </button>
          ))}
          <button className={button} onClick={coinCombo}>
            coin combo ×12
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold">Music</h2>
        <div className="flex flex-wrap gap-2">
          {MUSIC_TRACKS.map((t) => (
            <button key={t} className={track === t ? activeButton : button} onClick={() => playTrack(t)}>
              {t}
            </button>
          ))}
          <button className={button} onClick={() => playTrack(null)}>
            ■ stop
          </button>
        </div>
        {track && <p className="text-sm opacity-80">{SONGS[track].about}</p>}

        <div className="flex flex-wrap items-center gap-6 pt-2 text-sm">
          <label className="flex items-center gap-2">
            Theme
            <select
              className="rounded-md border-2 border-white/20 bg-[#2c2552] px-2 py-1"
              value={theme}
              onChange={(e) => {
                const id = e.target.value as ThemeId;
                setTheme(id);
                getAudio().setTheme(id);
              }}
            >
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            SFX {Math.round(sfxVolume * 100)}%
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sfxVolume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSfxVolume(v);
                getAudio().setVolumes(v, musicVolume);
              }}
            />
          </label>
          <label className="flex items-center gap-2">
            Music {Math.round(musicVolume * 100)}%
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={musicVolume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMusicVolume(v);
                getAudio().setVolumes(sfxVolume, v);
              }}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold">Self-test</h2>
          <button className={button} onClick={() => runSelfTest(false)} disabled={testing}>
            {testing ? "Rendering…" : "Run self-test"}
          </button>
          <button className={button} onClick={() => runSelfTest(true)} disabled={testing}>
            + whole songs (slower)
          </button>
          {report && (
            <span className={report.allOk ? "text-green-300" : "text-red-300"}>
              {report.allOk ? "all checks passed" : `${report.rows.filter((r) => !r.ok).length} failing`}
            </span>
          )}
        </div>
        <p className="text-xs opacity-70">
          Renders every sound offline (no speakers needed) through the real mixer and checks: not silent, peak below 1.0
          (no clipping), no NaNs, length limits, and music RMS well below the sound effects.
        </p>
        {report && (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/20">
                <th className="py-1">group</th>
                <th>name</th>
                <th>peak</th>
                <th>rms</th>
                <th>seconds</th>
                <th>ok</th>
                <th>note</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={`${r.group}-${r.name}`} className="border-b border-white/5">
                  <td className="py-0.5 opacity-60">{r.group}</td>
                  <td>{r.name}</td>
                  <td>{r.peak.toFixed(3)}</td>
                  <td>{r.rms.toFixed(3)}</td>
                  <td>{r.seconds.toFixed(2)}</td>
                  <td className={r.ok ? "text-green-300" : "text-red-300"}>{r.ok ? "✓" : "✗"}</td>
                  <td className="opacity-70">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
