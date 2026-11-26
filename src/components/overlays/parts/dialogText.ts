/**
 * A dialog line may carry an attribution: villagers quoting the repo's code
 * say the words first and then where they come from, separated by
 * ATTRIBUTION_SEPARATOR ("“Bake a whole tray at once.”" + "# from bake_batch()
 * in bakery/oven.py"). The dialog box types the words and shows the
 * attribution in small code type underneath.
 */
import { ATTRIBUTION_SEPARATOR } from "@/lib/worldgen/repoWords";

export interface DialogLine {
  /** What is typed out. */
  body: string;
  /** Where the words come from, or null for an ordinary line. */
  note: string | null;
}

export function splitAttribution(line: string): DialogLine {
  const at = line.indexOf(ATTRIBUTION_SEPARATOR);
  if (at === -1) return { body: line, note: null };
  const note = line.slice(at + ATTRIBUTION_SEPARATOR.length).trim();
  return { body: line.slice(0, at), note: note === "" ? null : note };
}
