"use client";
/**
 * /dev/art — the pixel-art gallery. Shows every sprite the game can draw.
 *
 * Query parameters (all optional):
 *   ?section=world|props|buildings|characters|hero-hats|hero-back|hero-crowd|monsters|items|pets|ui|font
 *   ?theme=meadow|sakura|autumn|snow|beach|night   (default: all themes where it matters)
 *   ?scale=3                                         (integer zoom)
 *   ?anim=1                                          (animate frames in place)
 */
import { use, useSyncExternalStore } from "react";
import type { ThemeId } from "@/lib/types";
import { THEMES } from "@/lib/game/catalog";
import { SECTIONS } from "./sections";

const subscribe = () => () => {};

export default function ArtGalleryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = use(searchParams);
  // sprites need a real <canvas>, so render only in the browser
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : (sp[k] as string | undefined));
  const section = one("section");
  const themeParam = one("theme") as ThemeId | undefined;
  const themes: ThemeId[] = themeParam && THEMES.some((t) => t.id === themeParam) ? [themeParam] : THEMES.map((t) => t.id);
  const scale = Math.max(1, Math.min(12, Number(one("scale")) || 3));
  const anim = one("anim") === "1";
  const shown = SECTIONS.filter((s) => !section || s.id === section);

  const link = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged: Record<string, string | undefined> = { section, theme: themeParam, scale: String(scale), anim: anim ? "1" : undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `?${q.toString()}`;
  };

  return (
    <main style={{ background: "#1d1a26", color: "#efe6ff", minHeight: "100vh", padding: 16, fontFamily: "ui-monospace, monospace" }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>Lintlands · pixel-art gallery</h1>
      <nav style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, marginBottom: 12 }}>
        <a href={link({ section: undefined })}>all</a>
        {SECTIONS.map((s) => (
          <a key={s.id} href={link({ section: s.id })} style={{ fontWeight: s.id === section ? 700 : 400 }}>
            {s.id}
          </a>
        ))}
        <span style={{ opacity: 0.5 }}>|</span>
        <a href={link({ theme: undefined })}>all themes</a>
        {THEMES.map((t) => (
          <a key={t.id} href={link({ theme: t.id })} style={{ fontWeight: t.id === themeParam ? 700 : 400 }}>
            {t.id}
          </a>
        ))}
        <span style={{ opacity: 0.5 }}>|</span>
        {[1, 2, 3, 4, 6, 8].map((s) => (
          <a key={s} href={link({ scale: String(s) })} style={{ fontWeight: s === scale ? 700 : 400 }}>
            {s}×
          </a>
        ))}
        <span style={{ opacity: 0.5 }}>|</span>
        <a href={link({ anim: anim ? undefined : "1" })}>{anim ? "stop animation" : "animate"}</a>
      </nav>
      {isClient &&
        shown.map((s) => (
          <section key={s.id} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, borderBottom: "1px solid #3a3450", paddingBottom: 4, marginBottom: 8 }}>{s.title}</h2>
            <s.Component themes={themes} scale={scale} anim={anim} />
          </section>
        ))}
    </main>
  );
}
