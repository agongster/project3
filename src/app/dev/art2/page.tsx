"use client";
/**
 * /dev/art2 — gallery for the characters & loot art: monsters, item icons,
 * in-hand weapons, projectiles, pets, UI/FX sprites and the bitmap font.
 *
 * Query parameters (all optional):
 *   ?section=monsters|items|weapons|projectiles|pets|ui|font|all
 *   ?scale=4      integer zoom
 *   ?anim=1       play animations in place instead of listing frames
 *   ?only=a,b     show only these ids (monster kinds, item ids, sprite names...)
 */
import { use, useSyncExternalStore } from "react";
import { SECTIONS } from "./sections";

const subscribe = () => () => {};

export default function ArtGallery2Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = use(searchParams);
  // sprites need a real <canvas>, so render only in the browser
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : (sp[k] as string | undefined));
  const section = one("section") ?? "all";
  const scale = Math.max(1, Math.min(16, Number(one("scale")) || 4));
  const anim = one("anim") === "1";
  const only = one("only")?.split(",");
  const shown = SECTIONS.filter((s) => section === "all" || s.id === section);

  const link = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged: Record<string, string | undefined> = { section, scale: String(scale), anim: anim ? "1" : undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `?${q.toString()}`;
  };

  return (
    <main style={{ background: "#1d1a26", color: "#efe6ff", minHeight: "100vh", padding: 16, fontFamily: "ui-monospace, monospace" }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>Lintlands · characters &amp; loot gallery</h1>
      <nav style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, marginBottom: 12 }}>
        <a href={link({ section: "all" })}>all</a>
        {SECTIONS.map((s) => (
          <a key={s.id} href={link({ section: s.id })} style={{ fontWeight: s.id === section ? 700 : 400 }}>
            {s.id}
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
            <s.Component scale={scale} anim={anim} only={only} />
          </section>
        ))}
    </main>
  );
}
