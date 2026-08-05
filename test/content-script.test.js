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
  assert.match(item.querySelector(".hb-thread-abs").textContent, /example\.com/);
  assert.equal(item.querySelector(".hb-th-site").textContent, "example.com");
  assert.equal(item.querySelector(".hb-th-site").getAttribute("href"), "https://example.com");
  assert.equal(item.querySelector(".hb-author").textContent, "alice");
  assert.match(item.querySelector(".hb-create-time").textContent, /2 hours ago/);
  assert.equal(item.querySelector(".hb-last-time"), null);
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
  assert.equal(document.querySelector(".hb-brand-logo"), null);
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
  assert.ok(item.querySelector(".hb-thread-author-meta"));
  assert.match(item.querySelector(".hb-create-time").textContent, /2 hours ago/);
  assert.equal(item.querySelector(".hb-thread-reply-meta"), null);
  assert.ok(item.querySelector(".hb-thread-abs"));
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

test("导航职责分离：分区在 Tab，排序仅看帖，侧栏不含重复入口", () => {
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

  assert.equal(
    [...document.querySelectorAll(".hb-tab-nav a")].map((a) => a.textContent).join(","),
    "看帖,问答,作品,招聘,精品",
  );
  assert.equal(document.querySelector(".hb-tab-nav .hb-tab-focus").textContent, "看帖");
  assert.equal(document.querySelector(".hb-thread-top .hb-sort-focus").textContent, "最新发帖");
  assert.equal(
    [...document.querySelectorAll(".hb-thread-sort a")].map((a) => a.textContent).join(","),
    "最新回复,最新发帖",
  );
  assert.equal(document.querySelector(".hb-aside-links"), null);
  assert.ok(document.querySelector(".hb-aside-box .hb-aside-link"));
});

test("非看帖分区不显示排序条", () => {
  const document = createDocument(
    `
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="https://example.com">Ask HN</a></span></td>
      </tr>
      <tr><td class="subtext"><a href="item?id=1">2&nbsp;comments</a></td></tr>
    </table>
  `,
    "https://news.ycombinator.com/ask",
  );

  enhanceHackerNews(document);

  assert.equal(document.querySelector(".hb-tab-nav .hb-tab-focus").textContent, "问答");
  assert.equal(document.querySelector(".hb-thread-sort a"), null);
  assert.equal(document.querySelector(".hb-thread-sort .hb-sort-focus").textContent, "问答");
});

test("为评论重建贴吧楼层卡片与折叠控件", () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr><td>
        <table class="fatitem">
          <tr class="athing">
            <td class="title"><span class="titleline"><a href="https://example.com">Main post</a></span></td>
          </tr>
          <tr>
            <td class="subtext">
              <span class="score">10 points</span>
              by <a class="hnuser" href="user?id=alice">alice</a>
              <span class="age">2 hours ago</span>
            </td>
          </tr>
          <tr>
            <td><form action="comment"><textarea name="text"></textarea><input type="submit" value="add comment"></form></td>
          </tr>
        </table>
        <table class="comment-tree">
          <tr class="athing comtr" id="42">
            <td class="ind" indent="0"></td>
            <td class="default">
              <span class="comhead"><a class="hnuser" href="user?id=bob">bob</a> <span class="age">1 hour ago</span></span>
              <div class="comment"><span class="commtext">Useful answer.</span><div class="reply"><a href="reply?id=42">reply</a></div></div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  `, "https://news.ycombinator.com/item?id=1");

  enhanceHackerNews(document);

  const main = document.querySelector(".hb-main-floor");
  const card = document.querySelector(".hb-floor-list .hb-floor");
  const button = card.querySelector(".hb-floor-toggle");
  assert.ok(document.querySelector(".hb-post-wrap"));
  assert.ok(document.querySelector(".hb-hn-source")?.hidden);
  assert.ok(main);
  assert.ok(document.querySelector(".hb-core-title"));
  assert.match(document.querySelector(".hb-core-title-txt").textContent, /Main post/);
  assert.match(document.querySelector(".hb-core-meta").textContent, /回复贴：1/);
  assert.equal(main.querySelector(".hb-floor-no").textContent, "1楼");
  assert.equal(main.querySelector(".hb-floor-name").textContent, "alice");
  assert.ok(main.querySelector(".hb-louzhu"));
  assert.ok(main.querySelector(".hb-floor-level"));
  assert.ok(main.querySelector(".hb-share-link"));
  assert.equal(main.querySelector(".hb-main-title"), null);
  assert.equal(main.querySelector(".hb-reply-box form"), null);
  assert.equal(document.querySelector(".hb-reply-panel-title")?.textContent, "发表回复");
  assert.equal(document.querySelector('.hb-reply-box input[type="submit"]')?.value, "发表");
  assert.equal(card.querySelector(".hb-floor-no").textContent, "2楼");
  assert.equal(card.querySelector(".hb-floor-name").textContent, "bob");
  assert.match(card.querySelector(".hb-floor-content").textContent, /Useful answer/);
  assert.equal(card.querySelector(".hb-floor-reply").textContent, "回复");
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.ok(card.querySelector(".hb-floor-avatar"));

  button.click();
  assert.equal(card.classList.contains("hb-floor-collapsed"), true);
  assert.equal(button.getAttribute("aria-expanded"), "false");
});

test("嵌套评论收进楼中楼", () => {
  const document = createDocument(
    `
    <table id="hnmain">
      <tr><td>
        <table class="fatitem">
          <tr class="athing">
            <td class="title"><span class="titleline"><a href="https://example.com">T</a></span></td>
          </tr>
          <tr>
            <td class="subtext">
              by <a class="hnuser" href="user?id=alice">alice</a>
              <span class="age">1 hour ago</span>
              | <a href="item?id=1">3&nbsp;comments</a>
            </td>
          </tr>
        </table>
        <table class="comment-tree">
          <tr class="athing comtr">
            <td class="ind" indent="0"></td>
            <td class="default">
              <span class="comhead"><a class="hnuser" href="user?id=bob">bob</a></span>
              <div class="comment"><span class="commtext">Top</span></div>
            </td>
          </tr>
          <tr class="athing comtr">
            <td class="ind" indent="1"></td>
            <td class="default">
              <span class="comhead"><a class="hnuser" href="user?id=carol">carol</a></span>
              <div class="comment"><span class="commtext">Nested</span></div>
            </td>
          </tr>
          <tr class="athing comtr">
            <td class="ind" indent="2"></td>
            <td class="default">
              <span class="comhead"><a class="hnuser" href="user?id=dave">dave</a></span>
              <div class="comment"><span class="commtext">Deeper</span></div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  `,
    "https://news.ycombinator.com/item?id=1",
  );

  enhanceHackerNews(document);

  assert.equal(document.querySelectorAll(".hb-floor-list .hb-floor").length, 1);
  assert.equal(document.querySelector(".hb-floor-list .hb-floor-no").textContent, "2楼");
  const lzl = document.querySelector(".hb-lzl");
  assert.ok(lzl);
  assert.equal(lzl.querySelector(".hb-lzl-num").textContent, "2");
  const items = [...lzl.querySelectorAll(".hb-lzl-item")];
  assert.equal(items.length, 2);
  assert.match(items[0].textContent, /carol/);
  assert.match(items[0].textContent, /Nested/);
  assert.equal(items[0].querySelector(".hb-lzl-to"), null);
  assert.match(items[1].querySelector(".hb-lzl-to").textContent, /回复 carol/);
  assert.match(items[1].textContent, /Deeper/);
});

test("重复运行不会重复插入评论折叠控件与帖子列表", () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="item?id=1">One</a></span></td>
      </tr>
      <tr><td class="subtext"><a href="item?id=1">3&nbsp;comments</a></td></tr>
    </table>
  `);

  enhanceHackerNews(document);
  enhanceHackerNews(document);

  assert.equal(document.querySelectorAll(".hb-thread-list").length, 1);
  assert.equal(document.querySelectorAll(".hb-post-wrap").length, 0);
});

test("分页展示上一页/页码/下一页，并保留 morelink", () => {
  const page1 = createDocument(`
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="https://example.com">A</a></span></td>
      </tr>
      <tr><td class="subtext"><a href="item?id=1">2&nbsp;comments</a></td></tr>
      <tr><td class="title"><a href="?p=2" class="morelink" rel="next">More</a></td></tr>
    </table>
  `);
  enhanceHackerNews(page1);
  assert.match(page1.querySelector(".hb-thread-count").textContent, /本页 1 篇主题 · 第 1 页/);
  assert.equal(page1.querySelector(".hb-pager-disabled")?.textContent, "< 上一页");
  assert.equal(page1.querySelector(".hb-pager-info")?.textContent, "第 1 页");
  assert.equal(page1.querySelector(".hb-pager-next")?.getAttribute("href"), "?p=2");

  const page2 = createDocument(
    `
    <table id="hnmain">
      <tr class="athing submission" id="2">
        <td class="title"><span class="titleline"><a href="https://example.com">B</a></span></td>
      </tr>
      <tr><td class="subtext"><a href="item?id=2">1&nbsp;comment</a></td></tr>
      <tr><td class="title"><a href="?p=3" class="morelink" rel="next">More</a></td></tr>
    </table>
  `,
    "https://news.ycombinator.com/news?p=2",
  );
  enhanceHackerNews(page2);
  assert.match(page2.querySelector(".hb-thread-count").textContent, /第 2 页/);
  assert.equal(page2.querySelector(".hb-pager-prev")?.getAttribute("href"), "news");
  assert.equal(page2.querySelector(".hb-pager-info")?.textContent, "第 2 页");
  assert.equal(page2.querySelector(".hb-pager-next")?.getAttribute("href"), "?p=3");
});
