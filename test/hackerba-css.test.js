import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const hackerBaCss = await readFile(
  new URL("../src/hackerba.css", import.meta.url),
  "utf8",
);

test("吧头封面固定 3:1 比例", () => {
  assert.match(hackerBaCss, /\.hb-card-cover\s*\{/);
  assert.match(hackerBaCss, /\.hb-card-banner\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*1/s);
  assert.match(hackerBaCss, /\.hb-card-cover\s*\{[^}]*object-fit:\s*cover/s);
});

test("吧头关注数和帖子数不受页面子元素颜色覆盖", () => {
  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <head>
        <style>${hackerBaCss}</style>
        <style>.hb-card-num em, .hb-card-num b { color: #000; }</style>
      </head>
      <body class="hackerba">
        <div class="hb-card-num">
          <span><em>关注：</em><b>1,165,754</b></span>
          <span><em>帖子：</em><b>6,099,649</b></span>
        </div>
      </body>
    </html>
  `);

  const { getComputedStyle } = dom.window;
  const expectedColor = "rgb(237, 244, 255)";
  assert.equal(getComputedStyle(dom.window.document.querySelector("em")).color, expectedColor);
  assert.equal(getComputedStyle(dom.window.document.querySelector("b")).color, expectedColor);
});
