/**
 * Monsters in the gutter: every live finding of the file shown becomes its
 * monster's sprite next to the line number, plus a stitched underline under
 * the code it is about.
 *
 *   setFindings effect ──► monsterField (findings with editor positions)
 *                              ├── underlines + line tints   (decorations)
 *                              └── one sprite per line       (gutter markers)
 *   poof effect ──────────► poofField (sparkles where a monster just left)
 *
 * Positions follow the player's typing (CodeMirror maps them through every
 * change), so markers stay on their line until the next live check replaces
 * them.
 */
import { RangeSet, StateEffect, StateField, type EditorState, type Range } from "@codemirror/state";
import { Decoration, EditorView, GutterMarker, gutter, type DecorationSet } from "@codemirror/view";
import { lookFromId, monsterFrame, spriteUrl, uiIcon } from "@/components/overlays/parts/sprites";
import { MONSTERS } from "@/lib/game/catalog";
import type { MonsterKind, Severity } from "@/lib/types";
import { rangeToOffsets } from "../logic/positions";
import type { EditorFinding, MarkerJuice } from "./types";

/** A finding placed in the document. */
interface Placed {
  finding: EditorFinding;
  from: number;
  to: number;
  fresh: boolean;
}

interface MonsterState {
  placed: Placed[];
  decorations: DecorationSet;
  markers: RangeSet<GutterMarker>;
}

const SEVERITY_RANK: Readonly<Record<Severity, number>> = { boss: 0, elite: 1, minion: 2 };

// ───────────────────────────── Gutter markers ─────────────────────────────

/** The sprite of the worst monster on a line, with a count when there are several. */
class MonsterMarker extends GutterMarker {
  constructor(
    readonly monster: MonsterKind,
    /** The finding drawn: its id decides the monster's look (variant). */
    readonly findingId: string,
    readonly count: number,
    readonly fresh: boolean,
    readonly label: string,
  ) {
    super();
  }

  eq(other: GutterMarker): boolean {
    return other instanceof MonsterMarker && other.monster === this.monster && other.findingId === this.findingId && other.count === this.count && other.fresh === this.fresh && other.label === this.label;
  }

  toDOM(): HTMLElement {
    const marker = document.createElement("span");
    marker.className = `ws-monster ws-sev-${MONSTERS[this.monster].severity}${this.fresh ? " ws-monster-fresh" : ""}`;
    marker.title = this.label;
    const sprite = monsterFrame(this.monster, 0, lookFromId(this.findingId, this.monster));
    if (sprite) marker.style.backgroundImage = `url(${spriteUrl(sprite)})`;
    if (this.count > 1) {
      const count = document.createElement("span");
      count.className = "ws-monster-count";
      count.textContent = String(this.count);
      marker.appendChild(count);
    }
    return marker;
  }
}

/** A sparkle left behind where a monster just disappeared. */
class PoofMarker extends GutterMarker {
  toDOM(): HTMLElement {
    const poof = document.createElement("span");
    poof.className = "ws-poof";
    const sprite = uiIcon("sparkle");
    if (sprite) poof.style.backgroundImage = `url(${spriteUrl(sprite)})`;
    return poof;
  }
}

const POOF = new PoofMarker();

// ───────────────────────────── Building the state ─────────────────────────────

/** A zero-width range gets one character, so its underline is visible. */
function visibleRange(state: EditorState, from: number, to: number): { from: number; to: number } {
  if (to > from) return { from, to };
  const line = state.doc.lineAt(from);
  if (from < line.to) return { from, to: from + 1 };
  if (from > line.from) return { from: from - 1, to: from };
  return { from, to };
}

function buildDecorations(state: EditorState, placed: readonly Placed[]): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  for (const { finding, from, to } of placed) {
    const severity = finding.severity;
    const line = state.doc.lineAt(from);
    ranges.push(Decoration.line({ class: `ws-bug-line ws-bug-line-${severity}` }).range(line.from));
    const shown = visibleRange(state, from, to);
    if (shown.to > shown.from) ranges.push(Decoration.mark({ class: `ws-bug ws-bug-${severity}` }).range(shown.from, shown.to));
  }
  return Decoration.set(ranges, true);
}

function buildMarkers(state: EditorState, placed: readonly Placed[]): RangeSet<GutterMarker> {
  const byLine = new Map<number, Placed[]>();
  for (const item of placed) {
    const lineStart = state.doc.lineAt(item.from).from;
    byLine.set(lineStart, [...(byLine.get(lineStart) ?? []), item]);
  }
  const markers: Range<GutterMarker>[] = [];
  for (const [lineStart, items] of byLine) {
    const worst = [...items].sort((a, b) => SEVERITY_RANK[a.finding.severity] - SEVERITY_RANK[b.finding.severity])[0];
    const names = items.map((item) => `${MONSTERS[item.finding.monster].name}: ${item.finding.title}`).join("\n");
    markers.push(new MonsterMarker(worst.finding.monster, worst.finding.id, items.length, items.some((item) => item.fresh), names).range(lineStart));
  }
  return RangeSet.of(markers, true);
}

function withPlaced(state: EditorState, placed: Placed[]): MonsterState {
  return { placed, decorations: buildDecorations(state, placed), markers: buildMarkers(state, placed) };
}

// ───────────────────────────── Fields and effects ─────────────────────────────

/** Replaces the findings. `findings` must have been checked against the current text. */
export const setFindingsEffect = StateEffect.define<{ findings: readonly EditorFinding[]; juice: MarkerJuice }>();
const addPoofsEffect = StateEffect.define<readonly number[]>();
/** Removes the sparkles again (dispatched POOF_MS after they appear). */
export const clearPoofsEffect = StateEffect.define<null>();

export const monsterField = StateField.define<MonsterState>({
  create: () => ({ placed: [], decorations: Decoration.none, markers: RangeSet.empty }),
  update(value, tr) {
    let next = value;
    if (tr.docChanged) {
      next = {
        placed: value.placed.map((item) => ({ ...item, from: tr.changes.mapPos(item.from), to: tr.changes.mapPos(item.to) })),
        decorations: value.decorations.map(tr.changes),
        markers: value.markers.map(tr.changes),
      };
    }
    for (const effect of tr.effects) {
      if (!effect.is(setFindingsEffect)) continue;
      const fresh = new Set(effect.value.juice.freshIds);
      const placed = effect.value.findings.map((finding) => ({ finding, ...rangeToOffsets(tr.state.doc, finding.range), fresh: fresh.has(finding.id) }));
      next = withPlaced(tr.state, placed);
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

const poofField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(value, tr) {
    let next = value.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(clearPoofsEffect)) next = RangeSet.empty;
      if (effect.is(addPoofsEffect)) {
        const lineStarts = [...new Set(effect.value.map((pos) => tr.state.doc.lineAt(Math.min(pos, tr.state.doc.length)).from))];
        next = next.update({ add: lineStarts.map((start) => POOF.range(start)), sort: true });
      }
    }
    return next;
  },
});

/**
 * The effects that replace the findings, plus sparkles where the gone ones
 * were (their positions are read before the replacement).
 */
export function findingEffects(state: EditorState, findings: readonly EditorFinding[], juice: MarkerJuice): StateEffect<unknown>[] {
  const gone = new Set(juice.goneIds);
  const poofs = state.field(monsterField).placed.filter((item) => gone.has(item.finding.id)).map((item) => item.from);
  const effects: StateEffect<unknown>[] = [setFindingsEffect.of({ findings, juice })];
  if (poofs.length > 0) effects.push(addPoofsEffect.of(poofs));
  return effects;
}

/** Finding ids whose marker is on this 1-based line. */
export function findingIdsOnLine(state: EditorState, lineNumber: number): string[] {
  const line = state.doc.line(Math.min(Math.max(1, lineNumber), state.doc.lines));
  return state.field(monsterField).placed.filter((item) => state.doc.lineAt(item.from).number === line.number).map((item) => item.finding.id);
}

/** Sorted 1-based line numbers that have a monster. */
export function monsterLines(state: EditorState): number[] {
  const lines = new Set(state.field(monsterField).placed.map((item) => state.doc.lineAt(item.from).number));
  return [...lines].sort((a, b) => a - b);
}

/**
 * The gutter column with the sprites. `onClick` gets the 1-based line and
 * the ids of the findings drawn there.
 */
export function monsterGutter(onClick: (view: EditorView, line: number, ids: string[]) => void) {
  return [
    monsterField,
    poofField,
    gutter({
      class: "ws-monster-gutter",
      markers: (view) => [view.state.field(monsterField).markers, view.state.field(poofField)],
      initialSpacer: () => POOF,
      domEventHandlers: {
        mousedown(view, block) {
          const line = view.state.doc.lineAt(block.from).number;
          const ids = findingIdsOnLine(view.state, line);
          if (ids.length === 0) return false;
          onClick(view, line, ids);
          return true;
        },
      },
    }),
  ];
}
