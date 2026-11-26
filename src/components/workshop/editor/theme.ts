/**
 * How the code looks: the game's night palette for the editor and its
 * syntax colours. The colours themselves are CSS variables defined once in
 * workshop.css (`--ws-…`), so the editor, the panels and the diff view all
 * share them; this file only says which part of the editor uses which.
 *
 * Code uses the system monospace font. The game's pixel fonts are for the
 * chrome around it: they are lovely for "+12 coins" and hard work for code.
 */
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

export const workshopTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "var(--ws-bg)",
      color: "var(--ws-text)",
      fontSize: "var(--ws-code-size)",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
      fontFamily: "var(--ws-code-font)",
      lineHeight: "1.6",
      scrollbarWidth: "thin",
      scrollbarColor: "var(--color-wood) transparent",
    },
    ".cm-content": { caretColor: "var(--color-gold)", padding: "6px 0 40vh" },
    ".cm-cursor, .cm-dropCursor": { borderLeft: "2px solid var(--color-gold)" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "var(--ws-select) !important",
    },
    ".cm-activeLine": { backgroundColor: "var(--ws-line)" },
    ".cm-gutters": {
      backgroundColor: "var(--ws-bg-deep)",
      color: "var(--ws-text-faint)",
      border: "none",
      boxShadow: "inset -2px 0 0 0 var(--ws-edge)",
    },
    ".cm-activeLineGutter": { backgroundColor: "var(--ws-line)", color: "var(--color-gold)" },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 10px 0 6px", minWidth: "3ch" },
    ".cm-foldGutter .cm-gutterElement": { color: "var(--ws-text-faint)", padding: "0 4px", cursor: "pointer" },
    ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
      backgroundColor: "rgb(255 201 60 / 0.22)",
      outline: "1px solid rgb(255 201 60 / 0.7)",
      color: "inherit",
    },
    ".cm-nonmatchingBracket": { backgroundColor: "rgb(229 72 77 / 0.35)" },
    ".cm-searchMatch": { backgroundColor: "rgb(110 198 255 / 0.25)", outline: "1px solid rgb(110 198 255 / 0.6)" },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "rgb(255 201 60 / 0.4)" },
    ".cm-selectionMatch": { backgroundColor: "rgb(155 107 255 / 0.25)" },
    ".cm-foldPlaceholder": { backgroundColor: "var(--ws-panel)", border: "none", color: "var(--color-gold)", padding: "0 6px" },
    ".cm-panels": { backgroundColor: "var(--ws-panel)", color: "var(--ws-text)", fontFamily: "var(--font-body), ui-monospace, monospace" },
    ".cm-panels.cm-panels-top": { borderBottom: "3px solid var(--ws-edge)" },
    ".cm-panels.cm-panels-bottom": { borderTop: "3px solid var(--ws-edge)" },
    ".cm-search": { padding: "6px 10px", fontSize: "15px" },
    ".cm-search label": { marginRight: "8px" },
    ".cm-textfield": {
      backgroundColor: "#fffdf5",
      color: "var(--color-ink)",
      border: "none",
      boxShadow: "0 0 0 2px var(--color-ink)",
      padding: "2px 6px",
      fontFamily: "var(--ws-code-font)",
      fontSize: "13px",
    },
    ".cm-textfield:focus-visible": { boxShadow: "0 0 0 2px var(--color-grape)", outline: "none" },
    ".cm-button": {
      backgroundImage: "none",
      backgroundColor: "var(--color-cream)",
      color: "var(--color-ink)",
      border: "none",
      boxShadow: "0 0 0 2px var(--color-ink), inset 0 -2px 0 0 var(--color-cream-deep)",
      borderRadius: "0",
      margin: "0 6px 0 2px",
      fontFamily: "var(--font-body), ui-monospace, monospace",
    },
    ".cm-button:focus-visible": { outline: "2px solid var(--color-gold)", outlineOffset: "2px" },
    ".cm-panel.cm-search [name=close]": { color: "var(--ws-text)", fontSize: "20px", right: "8px" },
    ".cm-tooltip": {
      backgroundColor: "var(--ws-panel)",
      color: "var(--ws-text)",
      border: "none",
      boxShadow: "0 0 0 2px var(--ws-edge), 0 4px 0 0 rgb(0 0 0 / 0.3)",
    },
    ".cm-tooltip-autocomplete > ul": { fontFamily: "var(--ws-code-font)", fontSize: "13px" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--ws-select)", color: "var(--ws-text)" },
  },
  { dark: true },
);

/** Syntax colours (Python first, but the tags are shared by every language pack). */
export const workshopHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.definitionKeyword, t.operatorKeyword], color: "var(--ws-tok-keyword)" },
    { tag: [t.function(t.definition(t.variableName)), t.function(t.variableName)], color: "var(--ws-tok-name)" },
    { tag: [t.definition(t.className), t.className, t.typeName], color: "var(--ws-tok-type)" },
    { tag: [t.string, t.special(t.string), t.regexp], color: "var(--ws-tok-string)" },
    { tag: [t.number, t.integer, t.float], color: "var(--ws-tok-number)" },
    { tag: [t.bool, t.null, t.self, t.atom], color: "var(--ws-tok-constant)" },
    { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--ws-tok-comment)", fontStyle: "italic" },
    { tag: [t.propertyName, t.attributeName], color: "var(--ws-tok-property)" },
    { tag: [t.operator, t.compareOperator, t.arithmeticOperator, t.logicOperator], color: "var(--ws-tok-operator)" },
    { tag: [t.punctuation, t.bracket, t.separator], color: "var(--ws-tok-punct)" },
    { tag: [t.meta, t.annotation, t.processingInstruction], color: "var(--ws-tok-meta)" },
    { tag: [t.tagName], color: "var(--ws-tok-keyword)" },
    { tag: t.heading, color: "var(--ws-tok-type)", fontWeight: "bold" },
    { tag: [t.link, t.url], color: "var(--ws-tok-name)", textDecoration: "underline" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strong, fontWeight: "bold" },
    { tag: t.invalid, color: "var(--color-berry)" },
  ]),
);
