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

test("将 HN 列表重建为贴吧式帖子行：左侧回复数 + 标题进讨论 + 作者时间", () => {
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
  assert.equal(item.querySelector(".hb-th-tit").getAttribute("href"), "item?id=1");
  assert.equal(item.querySelector(".hb-th-site").textContent, "example.com");
  assert.equal(item.querySelector(".hb-th-site").getAttribute("href"), "https://example.com");
  assert.equal(item.querySelector(".hb-author").textContent, "alice");
  assert.match(item.querySelector(".hb-create-time").textContent, /2 hours ago/);
  assert.equal(item.querySelector(".hb-last-time").textContent.includes("2 hours ago"), true);
  assert.equal(item.querySelector(".hb-goto-item"), null);
  assert.equal(document.querySelector(".hb-hn-source")?.hidden, true);
});

test("顶栏使用 HackerBa 品牌，搜索在页内提交", () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="https://example.com">A story</a></span></td>
      </tr>
      <tr><td class="subtext"><a href="item?id=1">discuss</a></td></tr>
    </table>
  `);

  enhanceHackerNews(document);

  assert.match(document.querySelector(".hb-topbar .hb-brand").textContent, /Hacker/);
  assert.match(document.querySelector(".hb-topbar .hb-brand").textContent, /贴吧/);
  assert.ok(document.querySelector(".hb-brand-logo"));
  assert.equal(document.querySelector(".hb-brand-logo").textContent, "吧");
  assert.equal(document.querySelector(".hb-brand-baidu"), null);
  assert.equal(document.querySelector(".hb-search").getAttribute("data-hb-search"), "local");
  assert.equal(document.querySelector(".hb-search-btn").textContent, "搜索");
  assert.match(document.querySelector(".hb-search input").getAttribute("placeholder") || "", /Hacker News/);
});

test("Algolia 搜索结果映射为贴吧式帖子字段", () => {
  const document = createDocument(`<table id="hnmain"></table>`);
  document.defaultView.eval(contentScript);
  const threads = document.defaultView.HackerBa.mapAlgoliaHits([
    {
      objectID: "123",
      title: "Search hit",
      url: "https://example.com/a",
      author: "bob",
      points: 120,
      num_comments: 48,
      created_at_i: Math.floor(Date.now() / 1000) - 7200,
    },
  ]);

  assert.equal(threads.length, 1);
  assert.equal(threads[0].title, "Search hit");
  assert.equal(threads[0].itemHref, "item?id=123");
  assert.equal(threads[0].externalHref, "https://example.com/a");
  assert.equal(threads[0].site, "example.com");
  assert.equal(threads[0].replyNum, "48");
  assert.equal(threads[0].author, "bob");
});

test("搜索结果用贴吧列表样式渲染到主栏", async () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="https://example.com">A story</a></span></td>
      </tr>
      <tr><td class="subtext"><a href="item?id=1">3&nbsp;comments</a></td></tr>
    </table>
  `);
  document.defaultView.fetch = async () => ({
    ok: true,
    json: async () => ({
      hits: [
        {
          objectID: "99",
          title: "Typed results",
          url: "https://example.org/x",
          author: "carol",
          points: 12,
          num_comments: 7,
          created_at_i: Math.floor(Date.now() / 1000) - 3600,
        },
      ],
      nbHits: 1,
    }),
  });

  enhanceHackerNews(document);
  document.querySelector(".hb-search input").value = "typed";
  await document.defaultView.HackerBa.runLocalSearch(document, "typed");

  assert.equal(document.querySelector(".hb-thread-top .hb-thread-count").textContent, "搜索到 1 篇主题");
  assert.equal(document.querySelector(".hb-th-tit").textContent, "Typed results");
  assert.equal(document.querySelector(".hb-th-tit").getAttribute("href"), "item?id=99");
  assert.equal(document.querySelector(".hb-rep-num").textContent, "7");
  assert.match(document.querySelector(".hb-breadcrumb").textContent, /搜索/);
});

test("帖子行包含右侧最后回复区，并带列表工具条与面包屑", () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="https://example.com">A story</a></span></td>
      </tr>
      <tr>
        <td class="subtext">
          <span class="score">120 points</span>
          by <a href="user?id=alice" class="hnuser">alice</a>
          <span class="age"><a href="item?id=1">2 hours ago</a></span>
          <a href="item?id=1">48&nbsp;comments</a>
        </td>
      </tr>
    </table>
  `);

  enhanceHackerNews(document);

  const item = document.querySelector(".hb-thread-item");
  assert.ok(document.querySelector(".hb-breadcrumb"));
  assert.ok(document.querySelector(".hb-thread-top"));
  assert.equal(document.querySelector(".hb-thread-top .hb-sort-focus").textContent, "最新回复");
  assert.ok(item.querySelector(".hb-thread-right"));
  assert.match(item.querySelector(".hb-last-time").textContent, /2 hours ago/);
  assert.ok(item.querySelector(".hb-icon-hot"));
  assert.ok(document.querySelector(".hb-tab-post"));
  assert.equal(document.querySelector(".hb-btn-mini-post"), null);
});

test("列表页隐藏原版 HN 源内容，避免上下两段重叠", () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="https://example.com">A story</a></span></td>
      </tr>
      <tr>
        <td class="subtext">
          by <a href="user?id=alice" class="hnuser">alice</a>
          <a href="item?id=1">3&nbsp;comments</a>
          <form method="get" action="//hn.algolia.com/"><input name="q"></form>
        </td>
      </tr>
    </table>
  `);

  enhanceHackerNews(document);

  const source = document.querySelector(".hb-hn-source");
  assert.ok(document.querySelector(".hb-thread-list"));
  assert.equal(source.classList.contains("hb-source-hidden"), true);
  assert.equal(source.hidden, true);
});

test("未登录发帖页套上贴吧壳并美化登录提示", () => {
  const document = createDocument(`
    You have to be logged in to submit.<br><br>
    <b>Login</b><br><br>
    <form action="submit" method="post">
      <table border="0">
        <tr><td>username:</td><td><input type="text" name="acct"></td></tr>
        <tr><td>password:</td><td><input type="password" name="pw"></td></tr>
      </table>
      <input type="submit" value="login">
    </form>
    <b>Create Account</b><br><br>
    <form action="submit" method="post">
      <input type="hidden" name="creating" value="t">
      <table border="0">
        <tr><td>username:</td><td><input type="text" name="acct"></td></tr>
        <tr><td>password:</td><td><input type="password" name="pw"></td></tr>
      </table>
      <input type="submit" value="create account">
    </form>
  `, "https://news.ycombinator.com/submit");

  enhanceHackerNews(document);

  assert.ok(document.querySelector(".hb-wrap"));
  assert.ok(document.querySelector(".hb-auth-panel"));
  assert.match(document.querySelector(".hb-auth-title").textContent, /登录/);
  assert.equal(document.querySelectorAll(".hb-auth-card").length, 1);
  assert.equal(document.querySelector(".hb-auth-card input[type='submit']").value, "登录");
  assert.equal(document.querySelector(".hb-hn-source").classList.contains("hb-source-visible"), true);
});

test("登录页只显示登录卡，注册入口只显示注册卡", () => {
  const loginDoc = createDocument(
    `
    <b>Login</b><br><br>
    <form action="login" method="post">
      <table border="0">
        <tr><td>username:</td><td><input type="text" name="acct"></td></tr>
        <tr><td>password:</td><td><input type="password" name="pw"></td></tr>
      </table>
      <input type="submit" value="login">
    </form>
    <a href="forgot">Forgot your password?</a><br><br>
    <b>Create Account</b><br><br>
    <form action="login" method="post">
      <input type="hidden" name="creating" value="t">
      <table border="0">
        <tr><td>username:</td><td><input type="text" name="acct"></td></tr>
        <tr><td>password:</td><td><input type="password" name="pw"></td></tr>
      </table>
      <input type="submit" value="create account">
    </form>
  `,
    "https://news.ycombinator.com/login",
  );

  enhanceHackerNews(loginDoc);
  assert.equal(loginDoc.querySelector(".hb-auth-title").textContent, "登录");
  assert.equal(loginDoc.querySelectorAll(".hb-auth-card").length, 1);
  assert.equal(loginDoc.querySelector(".hb-auth-card h3").textContent, "登录");
  assert.equal(loginDoc.querySelector(".hb-auth-switch").getAttribute("href"), "login?mode=register");

  const registerDoc = createDocument(
    `
    <form action="login" method="post">
      <table border="0">
        <tr><td>username:</td><td><input type="text" name="acct"></td></tr>
        <tr><td>password:</td><td><input type="password" name="pw"></td></tr>
      </table>
      <input type="submit" value="login">
    </form>
    <form action="login" method="post">
      <input type="hidden" name="creating" value="t">
      <table border="0">
        <tr><td>username:</td><td><input type="text" name="acct"></td></tr>
        <tr><td>password:</td><td><input type="password" name="pw"></td></tr>
      </table>
      <input type="submit" value="create account">
    </form>
  `,
    "https://news.ycombinator.com/login?mode=register",
  );

  enhanceHackerNews(registerDoc);
  assert.equal(registerDoc.querySelector(".hb-auth-title").textContent, "注册");
  assert.equal(registerDoc.querySelectorAll(".hb-auth-card").length, 1);
  assert.equal(registerDoc.querySelector(".hb-auth-card h3").textContent, "注册账号");
  assert.equal(registerDoc.querySelector(".hb-auth-switch").getAttribute("href"), "login");
});

test("吧规页保留正文并以文档样式展示", () => {
  const document = createDocument(`
    <center>
      <table width="500">
        <tr><td bgcolor="#fafaf0">
          <b>Hacker News Guidelines</b>
          <p>On-Topic: Anything that good hackers would find interesting.</p>
          <b>In Comments</b>
          <p>Be kind. Don't be snarky.</p>
        </td></tr>
      </table>
    </center>
  `, "https://news.ycombinator.com/newsguidelines.html");

  enhanceHackerNews(document);

  assert.ok(document.querySelector(".hb-doc-panel"));
  assert.equal(document.querySelector(".hb-auth-panel"), null);
  assert.match(document.querySelector(".hb-doc-title").textContent, /Guidelines|吧规|规范/);
  assert.match(document.querySelector(".hb-doc-body").textContent, /On-Topic/);
  assert.match(document.querySelector(".hb-doc-body").textContent, /Be kind/);
  assert.equal(document.querySelector(".hb-bc-current").textContent, "吧规");
  assert.equal(document.querySelector(".hb-hn-source").classList.contains("hb-source-visible"), true);
});

test("根据当前路径高亮上层内容 Tab 与下层排序", () => {
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

  assert.equal(document.querySelector(".hb-tab-nav .hb-tab-focus").textContent, "看帖");
  assert.equal(document.querySelector(".hb-thread-top .hb-sort-focus").textContent, "最新发帖");
  assert.equal([...document.querySelectorAll(".hb-tab-nav a")].map((a) => a.textContent).join(","), "看帖,精品");
  assert.match(document.querySelector(".hb-aside-links").textContent, /问答/);
  assert.match(document.querySelector(".hb-aside-links").textContent, /作品/);
  assert.match(document.querySelector(".hb-aside-links").textContent, /招聘/);
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
