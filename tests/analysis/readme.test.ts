/**
 * readmeBlurb: a README (Markdown, reStructuredText or plain text, often
 * full of badges, HTML and links) boiled down to its first real sentences.
 */
import { describe, expect, it } from "vitest";
import { DEMO_README } from "@/lib/analysis/demo";
import { MAX_README_BLURB, plainText, readmeBlurb } from "@/lib/analysis/readme";

describe("readmeBlurb", () => {
  it("skips the title, badges and images and keeps the first sentences", () => {
    const readme = [
      "# nanoGPT",
      "",
      "[![CI](https://img.shields.io/ci.svg)](https://ci.example) ![stars](https://img.shields.io/stars.svg)",
      "",
      "![nanoGPT](assets/nanogpt.jpg)",
      "",
      "The simplest, fastest repository for training/finetuning medium-sized GPTs. It is a rewrite of [minGPT](https://github.com/karpathy/minGPT) that prioritizes teeth over education.",
    ].join("\n");
    expect(readmeBlurb(readme)).toBe(
      "The simplest, fastest repository for training/finetuning medium-sized GPTs. It is a rewrite of minGPT that prioritizes teeth over education.",
    );
  });

  it("removes HTML, keeps the words inside tags and decodes entities", () => {
    const readme = '<p align="center"><img src="logo.png" width="200"></p>\n<h1>Tea</h1>\n\n<b>Tea</b> brews &amp; serves <i>perfect</i> cups&nbsp;of tea in under 3 minutes. <!-- hidden note -->';
    expect(readmeBlurb(readme)).toBe("Tea brews & serves perfect cups of tea in under 3 minutes.");
  });

  it("drops code blocks, tables, lists and setext headings", () => {
    const readme = [
      "Project Title",
      "=============",
      "",
      "```python",
      "print('this is not prose at all, it is code')",
      "```",
      "",
      "| a | b |",
      "|---|---|",
      "- install it with pip install thing please",
      "",
      "    indented code block with many words in it",
      "",
      "Finally a real paragraph about what this project does for you.",
    ].join("\n");
    expect(readmeBlurb(readme)).toBe("Finally a real paragraph about what this project does for you.");
  });

  it("understands reStructuredText headings, directives and links", () => {
    const readme = [
      "========",
      "Requests",
      "========",
      "",
      ".. image:: https://img.shields.io/pypi/v/requests.svg",
      "    :target: https://pypi.org/project/requests/",
      "",
      "**Requests** is a simple, yet elegant, HTTP library. See `the docs <https://requests.readthedocs.io>`_ for more.",
    ].join("\n");
    expect(readmeBlurb(readme)).toBe("Requests is a simple, yet elegant, HTTP library. See the docs for more.");
  });

  it("does not split sentences inside version numbers", () => {
    expect(readmeBlurb("Works with Python 3.10 and newer, on every platform. Second sentence here too.", 60)).toBe(
      "Works with Python 3.10 and newer, on every platform.",
    );
  });

  it(`clips a single very long sentence to ${MAX_README_BLURB} characters at a word boundary`, () => {
    const blurb = readmeBlurb(`This project ${"does many wonderful things ".repeat(30)}forever`);
    expect(blurb).not.toBeNull();
    expect(Array.from(blurb!).length).toBeLessThanOrEqual(MAX_README_BLURB);
    expect(blurb!.endsWith("…")).toBe(true);
    expect(blurb).not.toMatch(/\s…$/);
  });

  it("keeps emoji and CJK whole and never cuts an emoji in half", () => {
    const blurb = readmeBlurb(`${"🍰 甜点 cake shop with tasty treats ".repeat(12)}.`, 50)!;
    expect(Array.from(blurb).length).toBeLessThanOrEqual(50);
    expect(blurb).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/); // no lone high surrogate
    expect(readmeBlurb("这是一个用于训练中等规模语言模型的最简单最快的代码仓库。 它 很 好 用 啊 。")).toContain("这是一个");
  });

  it("returns null when there is no prose at all", () => {
    expect(readmeBlurb("")).toBeNull();
    expect(readmeBlurb("# Title only\n\n![badge](x.svg)\n\n```\ncode\n```")).toBeNull();
    expect(readmeBlurb("!!!! ???? .... ---- !!!! ////")).toBeNull();
    expect(readmeBlurb("\u0000\u0001\u0002 \t\t\n\n")).toBeNull();
  });

  it("survives hostile input quickly", () => {
    const started = Date.now();
    expect(readmeBlurb("[".repeat(50_000))).toBeNull();
    expect(readmeBlurb("<".repeat(50_000) + " words words words words words words")).toBeNull();
    readmeBlurb(`${"a".repeat(200_000)} b c d e f`);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("gives the demo kingdom its own welcome", () => {
    expect(readmeBlurb(DEMO_README)).toBe(
      "The friendliest bakery-and-potion shop in the kingdom, run entirely by Python scripts. We bake at dawn and brew at dusk. Please do not feed the cauldron.",
    );
  });
});

describe("plainText", () => {
  it("strips link and emphasis markup but keeps snake_case words", () => {
    expect(plainText("Call **load_data** from [the loader](https://x.y) — `fast` :rocket:")).toBe("Call load_data from the loader — fast");
  });
});
