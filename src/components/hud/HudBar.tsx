/** A thin pixel bar sized in art pixels (XP, Repo Health, dash, boss HP). */
import { ap } from "./units";

interface Props {
  /** 0–1 */
  value: number;
  color: string;
  /** Width and height in art pixels. */
  width: number;
  height: number;
  label: string;
  className?: string;
}

export function HudBar({ value, color, width, height, label, className }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
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
      <div className="h-full bg-[#3a3152]">
        <div
          className="h-full transition-[width] duration-300 ease-[steps(6)]"
          style={{ width: `${pct}%`, background: color, boxShadow: `inset 0 ${ap(-1)} 0 0 rgb(0 0 0 / 0.25)` }}
        />
      </div>
    </div>
  );
}
