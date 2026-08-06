import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const hackerBaCss = await readFile(
  new URL("../src/hackerba.css", import.meta.url),
  "utf8",
);

test("吧头封面固定 4:1 比例", () => {
  assert.match(hackerBaCss, /\.hb-card-cover\s*\{/);
  assert.match(hackerBaCss, /\.hb-card-banner-clip\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*1/s);
  assert.match(hackerBaCss, /\.hb-card-cover\s*\{[^}]*object-fit:\s*cover/s);
});

test("关闭首图时回退白底信息卡吧头", () => {
  assert.match(
    hackerBaCss,
    /\[data-hb-banner-cover="0"\][\s\S]*?\.hb-card-cover[\s\S]*?display:\s*none/s,
  );
  assert.match(
    hackerBaCss,
    /\[data-hb-banner-cover="0"\][\s\S]*?\.hb-card-head\s*\{[^}]*background:/s,
  );
});

test("回复数使用现代圆角徽章而非气泡三角", () => {
  assert.doesNotMatch(hackerBaCss, /\.hb-rep-num::before/);
  assert.doesNotMatch(hackerBaCss, /\.hb-rep-num::after/);
  assert.match(hackerBaCss, /\.hb-rep-num\s*\{[^}]*border-radius:\s*6px/s);
  assert.match(hackerBaCss, /\.hb-rep-zero/);
  assert.match(hackerBaCss, /\.hb-rep-hot/);
});

test("开启首图时吧头像上叠封面", () => {
  assert.match(
    hackerBaCss,
    /\[data-hb-banner-cover="1"\][\s\S]*?\.hb-card-avatar\s*\{[^}]*margin-top:\s*-36px/s,
  );
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
  assert.equal(getComputedStyle(dom.window.document.querySelector("em")).color, "rgb(138, 145, 153)");
  assert.equal(getComputedStyle(dom.window.document.querySelector("b")).color, "rgb(31, 35, 41)");
});
