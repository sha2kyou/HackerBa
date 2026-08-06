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
  assert.match(hackerBaCss, /\.hb-rep-num\s*\{[^}]*border-radius:\s*var\(--hb-radius-xs\)/s);
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
  assert.match(hackerBaCss, /\.hb-card-num\s+em\s*\{[^}]*color:\s*var\(--hb-muted\)\s*!important/s);
  assert.match(hackerBaCss, /\.hb-card-num\s+b\s*\{[^}]*color:\s*var\(--hb-text\)\s*!important/s);

  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <head>
        <style>
          :root { --hb-muted: #8a9199; --hb-text: #1f2329; }
          ${hackerBaCss}
        </style>
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
  const emColor = getComputedStyle(dom.window.document.querySelector("em")).color;
  const bColor = getComputedStyle(dom.window.document.querySelector("b")).color;
  assert.ok(
    emColor === "rgb(138, 145, 153)" || emColor === "var(--hb-muted)",
    `unexpected em color: ${emColor}`,
  );
  assert.ok(
    bColor === "rgb(31, 35, 41)" || bColor === "var(--hb-text)",
    `unexpected b color: ${bColor}`,
  );
});

test("控件与表单使用统一 design token", () => {
  assert.match(hackerBaCss, /--hb-accent:\s*#3370ff/);
  assert.match(hackerBaCss, /\[data-hb-accent="orange"\]\s*\{[^}]*--hb-accent:\s*#ff6600/s);
  assert.match(hackerBaCss, /--hb-orange:\s*var\(--hb-accent\)/);
  assert.match(hackerBaCss, /--hb-blue:\s*var\(--hb-accent\)/);
  assert.match(hackerBaCss, /--hb-search:\s*var\(--hb-accent\)/);
  assert.match(hackerBaCss, /--hb-btn-h:\s*34px/);
  assert.match(hackerBaCss, /--hb-control-h:\s*36px/);
  assert.match(hackerBaCss, /--hb-radius-xs:\s*6px/);
  assert.match(hackerBaCss, /\.hb-primary-btn[\s\S]*?background:\s*var\(--hb-orange\)/s);
  assert.match(hackerBaCss, /\.hb-primary-btn:hover[\s\S]*?background:\s*var\(--hb-orange-hover\)/s);
  assert.match(hackerBaCss, /\.hb-tab-post:hover\s*\{[^}]*var\(--hb-orange-hover\)/s);
  assert.match(hackerBaCss, /\.hb-core-quick-reply:hover\s*\{[^}]*var\(--hb-orange-hover\)/s);
  assert.match(hackerBaCss, /\.hb-form-actions\s*\{[^}]*border-top:\s*1px\s+solid\s+var\(--hb-line\)/s);
  assert.match(hackerBaCss, /\.hb-auth-title,\s*\nbody\.hackerba\s+\.hb-doc-title/);
  assert.doesNotMatch(hackerBaCss, /\.hb-auth-card[\s\S]*float:\s*right/s);
  assert.doesNotMatch(hackerBaCss, /\.hb-btn-mini-post/);
});

test("登录与资料输入框高度统一且带 focus", () => {
  assert.match(
    hackerBaCss,
    /\.hb-auth-card input\[type="text"\][\s\S]*?height:\s*var\(--hb-control-h\)/s,
  );
  assert.match(
    hackerBaCss,
    /\.hb-auth-card input\[type="text"\]:focus[\s\S]*?box-shadow:\s*var\(--hb-focus-ring\)/s,
  );
  assert.match(
    hackerBaCss,
    /\.hb-modal\s+\.hb-modal-loading\s*\{[^}]*padding:\s*36px\s+24px/s,
  );
});
