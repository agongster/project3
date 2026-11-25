// Dev helper: screenshot a page with headless Chromium so an agent (or you) can
// look at the result.  Usage:
//   node scripts/shot.mjs <url> <out.png> [--w 1280] [--h 800] [--wait 1500]
//        [--keys "ArrowRight:600,Space,e"] [--click "x,y"] [--eval "js"]
// --keys: comma list; "Key:ms" holds the key for ms, bare "Key" taps it.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [url, out, ...rest] = process.argv.slice(2);
if (!url || !out) {
  console.error("usage: node scripts/shot.mjs <url> <out.png> [--w N] [--h N] [--wait ms] [--keys list] [--click x,y] [--eval js]");
  process.exit(1);
}
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};
const width = Number(opt("w", 1280));
const height = Number(opt("h", 800));
const wait = Number(opt("wait", 1500));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
});
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(wait);

const click = opt("click", null);
if (click) {
  const [x, y] = click.split(",").map(Number);
  await page.mouse.click(x, y);
  await page.waitForTimeout(300);
}
const keys = opt("keys", null);
if (keys) {
  for (const part of keys.split(",")) {
    const [key, ms] = part.split(":");
    if (ms) {
      await page.keyboard.down(key);
      await page.waitForTimeout(Number(ms));
      await page.keyboard.up(key);
    } else {
      await page.keyboard.press(key);
    }
    await page.waitForTimeout(120);
  }
}
const js = opt("eval", null);
if (js) {
  const result = await page.evaluate(js);
  console.log("eval:", JSON.stringify(result));
  await page.waitForTimeout(300);
}
mkdirSync(dirname(out), { recursive: true });
await page.screenshot({ path: out });
await browser.close();
if (errors.length) console.log(errors.join("\n"));
console.log(`saved ${out}`);
