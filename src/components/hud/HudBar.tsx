/**
 * A thin pixel bar sized in art pixels (XP, Repo Health, dash, boss HP).
 * An optional `after` segment follows the main fill in its own colour: the
 * Repo Health bar uses it for the bugs that are subdued but not fixed yet.
 */
import { ap } from "./units";

interface Props {
  /** 0–1 */
  value: number;
  color: string;
  /** A second, lighter segment right after the main fill (0–1 of the whole bar). */
  after?: { value: number; color: string };
  /** Width and height in art pixels. */
  width: number;
  height: number;
  label: string;
  className?: string;
}

const clampPercent = (value: number) => Math.max(0, Math.min(1, value)) * 100;

export function HudBar({ value, color, after, width, height, label, className }: Props) {
  const pct = clampPercent(value);
  const afterPct = after ? Math.min(100 - pct, clampPercent(after.value)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={className}
      style={{ width: ap(width), height: ap(height), background: "#0f0b1f", padding: ap(1) }}
    >
      <div className="flex h-full bg-[#3a3152]">
        <div
          className="h-full transition-[width] duration-300 ease-[steps(6)]"
          style={{ width: `${pct}%`, background: color, boxShadow: `inset 0 ${ap(-1)} 0 0 rgb(0 0 0 / 0.25)` }}
        />
        {after && afterPct > 0 && <div className="h-full transition-[width] duration-300 ease-[steps(6)]" style={{ width: `${afterPct}%`, background: after.color }} />}
      </div>
    </div>
  );
}
