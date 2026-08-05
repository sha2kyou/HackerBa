import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const contentScript = await readFile(
  new URL("../src/content-script.js", import.meta.url),
  "utf8",
);

function createDocument(body, url = "https://news.ycombinator.com/news") {
  return new JSDOM(`<!doctype html><html><body>${body}</body></html>`, {
    url,
    runScripts: "outside-only",
  }).window.document;
}

function enhanceHackerNews(document) {
  document.defaultView.eval(contentScript);
  return document.defaultView.HackerBa.enhanceHackerNews(document);
}

test("将 HN 列表重建为贴吧式帖子行：左侧回复数 + 标题 + 作者时间", () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title">
          <span class="titleline">
            <a href="https://example.com">A story</a>
            <span class="sitebit comhead"> (<a href="from?site=example.com"><span class="sitestr">example.com</span></a>)</span>
          </span>
        </td>
      </tr>
      <tr>
        <td class="subtext">
          <span class="score" id="score_1">12 points</span>
          by <a href="user?id=alice" class="hnuser">alice</a>
          <span class="age" title="2024-01-01"><a href="item?id=1">2 hours ago</a></span>
          <a href="item?id=1">48&nbsp;comments</a>
        </td>
      </tr>
    </table>
  `);

  enhanceHackerNews(document);

  const item = document.querySelector(".hb-thread-item");
  assert.ok(item);
  assert.equal(item.querySelector(".hb-rep-num").textContent, "48");
  assert.equal(item.querySelector(".hb-th-tit").textContent, "A story");
  assert.equal(item.querySelector(".hb-th-tit").getAttribute("href"), "https://example.com");
  assert.equal(item.querySelector(".hb-author").textContent, "alice");
  assert.match(item.querySelector(".hb-create-time").textContent, /2 hours ago/);
  assert.equal(document.querySelector(".itemlist, #hnmain .athing.submission")?.closest?.(".hb-hn-source")?.hidden || document.querySelector(".hb-hn-source")?.hidden, true);
});

test("创建贴吧吧页框架：顶栏、吧头统计、看帖导航、侧栏", () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="https://example.com">A story</a></span></td>
      </tr>
      <tr><td class="subtext"><a href="item?id=1">discuss</a></td></tr>
    </table>
  `);

  enhanceHackerNews(document);

  assert.equal(document.querySelector(".hb-topbar .hb-brand").textContent, "百度贴吧");
  assert.ok(document.querySelector(".hb-card-banner"));
  assert.match(document.querySelector(".hb-card-banner").textContent, /Hacker News 吧/);
  assert.match(document.querySelector(".hb-card-banner").textContent, /关注/);
  assert.equal(document.querySelector(".hb-tab-nav .hb-tab-focus").textContent, "看帖");
  assert.ok(document.querySelector(".hb-thread-list"));
  assert.ok(document.querySelector(".hb-aside"));
});

test("根据当前路径高亮对应 Tab 选中态", () => {
  const document = createDocument(
    `
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="https://example.com">A story</a></span></td>
      </tr>
      <tr><td class="subtext"><a href="item?id=1">3&nbsp;comments</a></td></tr>
    </table>
  `,
    "https://news.ycombinator.com/newest",
  );

  enhanceHackerNews(document);

  assert.equal(document.querySelector(".hb-tab-nav .hb-tab-focus").textContent, "最新");
  assert.equal(document.querySelectorAll(".hb-tab-nav .hb-tab-focus").length, 1);
});

test("为评论增加可访问的楼层折叠控件", () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr class="athing comtr" id="42">
        <td><img class="togg" alt="[-]"></td>
        <td class="default">
          <span class="comhead"><a class="hnuser" href="user?id=bob">bob</a> 1 hour ago</span>
          <div class="comment"><span>Useful answer.</span></div>
        </td>
      </tr>
    </table>
  `);

  enhanceHackerNews(document);

  const comment = document.querySelector(".comtr");
  const button = comment.querySelector(".hb-floor-toggle");
  assert.equal(comment.classList.contains("hb-floor"), true);
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.ok(comment.querySelector(".hb-floor-avatar"));

  button.click();
  assert.equal(comment.classList.contains("hb-floor-collapsed"), true);
  assert.equal(button.getAttribute("aria-expanded"), "false");
});

test("重复运行不会重复插入评论折叠控件与帖子列表", () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="item?id=1">One</a></span></td>
      </tr>
      <tr><td class="subtext"><a href="item?id=1">3&nbsp;comments</a></td></tr>
      <tr class="athing comtr" id="42">
        <td class="default"><div class="comment"><span>Text</span></div></td>
      </tr>
    </table>
  `);

  enhanceHackerNews(document);
  enhanceHackerNews(document);

  assert.equal(document.querySelectorAll(".hb-thread-list").length, 1);
  assert.equal(document.querySelectorAll(".hb-floor-toggle").length, 1);
});
