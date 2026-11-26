/**
 * Word-wrapping for speech bubbles: a saying is broken into at most a few
 * lines no wider than the bubble, and anything that does not fit ends in
 * "…". Pure (the caller passes the text measurer), so it is unit-tested
 * without a canvas.
 */

const ELLIPSIS = "…";

/** Shortens one line until it (plus an ellipsis) fits in `maxWidth`. */
function withEllipsis(line: string, maxWidth: number, measure: (text: string) => number): string {
  let kept = line;
  while (kept.length > 0 && measure(`${kept}${ELLIPSIS}`) > maxWidth) kept = kept.slice(0, -1);
  return `${kept.trimEnd()}${ELLIPSIS}`;
}

/**
 * Splits `text` into at most `maxLines` lines of at most `maxWidth` pixels,
 * breaking at spaces. A word wider than a whole line is cut, and text left
 * over after the last line is replaced by "…". Empty text gives no lines.
 */
export function wrapBubbleText(text: string, maxWidth: number, maxLines: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  let current = "";
  let leftOver = false;
  for (const word of text.split(" ").filter((w) => w !== "")) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current !== "") lines.push(current);
    if (lines.length >= maxLines) {
      leftOver = true;
      current = "";
      break;
    }
    current = word;
  }
  if (current !== "") lines.push(current);
  return lines.map((line, i) => {
    const isLast = i === lines.length - 1;
    if (measure(line) > maxWidth || (isLast && leftOver)) return withEllipsis(line, maxWidth, measure);
    return line;
  });
}
