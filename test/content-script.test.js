import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const i18nScript = await readFile(
  new URL("../src/i18n.js", import.meta.url),
  "utf8",
);
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

function loadScripts(document) {
  document.defaultView.eval(i18nScript);
  document.defaultView.eval(contentScript);
}

function enhanceHackerNews(document) {
  loadScripts(document);
  return document.defaultView.HackerBa.enhanceHackerNews(document);
}

test("开启首图时通过扩展 URL 注入封面", async () => {
  const document = createDocument(`
    <center><table id="hnmain"><tr><td></td></tr></table></center>
  `);
  const extensionUrl = "chrome-extension://hb-test/src/icons/banner-process.jpg";
  document.defaultView.chrome = {
    runtime: {
      getURL(path) {
        return `chrome-extension://hb-test/${path}`;
      },
    },
    storage: {
      sync: {
        async get(defaults) {
          return { ...defaults, showBannerCover: true };
        },
      },
    },
  };

  loadScripts(document);
  await document.defaultView.HackerBa.applyPreferences(document);
  document.defaultView.HackerBa.enhanceHackerNews(document);

  const cover = document.querySelector(".hb-card-cover");
  assert.ok(cover);
  assert.equal(cover.getAttribute("src"), extensionUrl);
  assert.equal(
    document.defaultView.HackerBa.BANNER_COVER_PATH,
    "src/icons/banner-process.jpg",
  );
  assert.equal(document.documentElement.dataset.hbBannerCover, "1");
});

test("默认关闭首图时不注入封面", async () => {
  const document = createDocument(`
    <center><table id="hnmain"><tr><td></td></tr></table></center>
  `);
  document.defaultView.chrome = {
    runtime: {
      getURL(path) {
        return `chrome-extension://hb-test/${path}`;
      },
    },
  };

  loadScripts(document);
  await document.defaultView.HackerBa.applyPreferences(document);
  document.defaultView.HackerBa.enhanceHackerNews(document);

  const cover = document.querySelector(".hb-card-cover");
  assert.ok(cover);
  assert.equal(cover.hidden, true);
  assert.equal(cover.getAttribute("src"), null);
  assert.equal(document.documentElement.dataset.hbBannerCover, "0");
});

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
  assert.equal(item.querySelector(".hb-rep-num")?.classList.contains("hb-rep-zero"), false);
  assert.equal(item.querySelector(".hb-rep-num")?.classList.contains("hb-rep-hot"), false);
  assert.equal(item.querySelector(".hb-th-tit").textContent, "A story");
  assert.equal(item.querySelector(".hb-th-tit").getAttribute("href"), "item?id=1");
  assert.equal(item.querySelector(".hb-th-tit").getAttribute("target"), "_blank");
  assert.equal(item.querySelector(".hb-th-tit").getAttribute("rel"), "noopener noreferrer");
  assert.match(item.querySelector(".hb-thread-abs").textContent, /example\.com/);
  assert.equal(item.querySelector(".hb-th-site").textContent, "example.com");
  assert.equal(item.querySelector(".hb-th-site").getAttribute("href"), "https://example.com");
  assert.ok(item.querySelector(".hb-icon-author"));
  assert.equal(item.querySelector(".hb-author").textContent, "alice");
  assert.match(item.querySelector(".hb-create-time").textContent, /2 hours ago/);
  assert.equal(item.querySelector(".hb-last-time"), null);
  assert.equal(item.querySelector(".hb-goto-item"), null);
  assert.equal(document.querySelector(".hb-hn-source")?.hidden, true);
  assert.equal(document.documentElement.dataset.hbTitleDiscussion, "1");
  assert.equal(document.documentElement.dataset.hbDiscussionBlank, "1");
  assert.ok(document.querySelector(".hb-card-banner-clip"));
  assert.equal(document.querySelector('.hb-card-btns a.hb-btn-checkin[href="login"]')?.textContent, "Check in");
});

test("关闭详情新窗口时标题在当前页打开讨论", () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title">
          <span class="titleline">
            <a href="https://example.com">A story</a>
          </span>
        </td>
      </tr>
      <tr>
        <td class="subtext">
          <span class="score" id="score_1">12 points</span>
          by <a href="user?id=alice" class="hnuser">alice</a>
          <a href="item?id=1">3&nbsp;comments</a>
        </td>
      </tr>
    </table>
  `);
  loadScripts(document);
  document.querySelector(".hb-wrap")?.remove();
  document.body.classList.remove("hackerba");
  document.documentElement.classList.remove("hackerba-page", "hb-boot");
  document.documentElement.dataset.hbTitleDiscussion = "1";
  document.documentElement.dataset.hbDiscussionBlank = "0";
  document.defaultView.HackerBa.enhanceHackerNews(document);

  const title = document.querySelector(".hb-th-tit");
  assert.equal(title.getAttribute("href"), "item?id=1");
  assert.equal(title.getAttribute("target"), null);
});

test("关闭标题打开讨论时标题指向原文，分数旁显示进入讨论", () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title">
          <span class="titleline">
            <a href="https://example.com/x">A story</a>
            <span class="sitebit comhead"> (<a href="from?site=example.com"><span class="sitestr">example.com</span></a>)</span>
          </span>
        </td>
      </tr>
      <tr>
        <td class="subtext">
          <span class="score" id="score_1">12 points</span>
          <a href="item?id=1">3&nbsp;comments</a>
        </td>
      </tr>
    </table>
  `);
  loadScripts(document);
  document.querySelector(".hb-wrap")?.remove();
  document.body.classList.remove("hackerba");
  document.documentElement.classList.remove("hackerba-page", "hb-boot");
  document.documentElement.dataset.hbTitleDiscussion = "0";
  document.defaultView.HackerBa.enhanceHackerNews(document);

  const title = document.querySelector(".hb-th-tit");
  assert.equal(title.getAttribute("href"), "https://example.com/x");
  assert.equal(title.getAttribute("target"), "_blank");
  const goto = document.querySelector(".hb-goto-item");
  assert.ok(goto);
  assert.equal(goto.getAttribute("href"), "item?id=1");
  assert.equal(goto.getAttribute("target"), "_blank");
  assert.match(goto.textContent, /Discuss|进入讨论/);
  assert.match(document.querySelector(".hb-thread-abs").textContent, /12/);
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
  assert.match(document.querySelector(".hb-topbar .hb-brand").textContent, /Ba/);
  assert.equal(document.querySelector(".hb-brand-logo"), null);
  assert.equal(document.querySelector(".hb-brand-baidu"), null);
  assert.equal(document.querySelector(".hb-search").getAttribute("data-hb-search"), "local");
  assert.equal(document.querySelector(".hb-search-btn").textContent, "Search");
  assert.match(document.querySelector(".hb-search input").getAttribute("placeholder") || "", /Hacker News/);
});

test("Algolia 搜索结果映射为贴吧式帖子字段", () => {
  const document = createDocument(`<table id="hnmain"></table>`);
  loadScripts(document);
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

  assert.equal(document.querySelector(".hb-thread-top .hb-thread-count").textContent, "Found 1 topics");
  assert.equal(document.querySelector(".hb-th-tit").textContent, "Typed results");
  assert.equal(document.querySelector(".hb-th-tit").getAttribute("href"), "item?id=99");
  assert.equal(document.querySelector(".hb-rep-num").textContent, "7");
  assert.match(document.querySelector(".hb-breadcrumb").textContent, /Search/);
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
  assert.equal(document.querySelector(".hb-thread-top .hb-sort-focus").textContent, "Default");
  assert.ok(item.querySelector(".hb-thread-author-meta"));
  assert.match(item.querySelector(".hb-create-time").textContent, /2 hours ago/);
  assert.equal(item.querySelector(".hb-thread-reply-meta"), null);
  assert.ok(item.querySelector(".hb-thread-abs"));
  assert.ok(item.querySelector(".hb-icon-good"));
  assert.equal(item.querySelector(".hb-icon-hot"), null);
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
  assert.ok(document.querySelector(".hb-modal-overlay"));
  assert.ok(document.querySelector(".hb-modal .hb-auth-panel"));
  assert.match(document.querySelector(".hb-auth-title").textContent, /Log in/);
  assert.equal(document.querySelectorAll(".hb-auth-card").length, 1);
  assert.equal(document.querySelector(".hb-auth-card input[type='submit']").value, "Log in");
  assert.equal(document.body.classList.contains("hb-popup-page"), true);
  assert.equal(document.body.classList.contains("hb-popup-standalone"), true);
  assert.equal(document.querySelector(".hb-tab-nav a.hb-tab-focus"), null);
  assert.equal(document.querySelector(".hb-hn-source .hb-auth-panel"), null);
});

test("已登录发帖页渲染为独立发帖表单", () => {
  const document = createDocument(
    `
    <form method="post" action="r">
      <input type="hidden" name="fnid" value="abc">
      <input type="hidden" name="fnop" value="submit-page">
      <table border="0">
        <tr><td>title</td><td><input type="text" name="title" value="" size="50"></td></tr>
        <tr><td>url</td><td><input type="url" name="url" value="" size="50"></td></tr>
        <tr><td></td><td><b>or</b></td></tr>
        <tr><td>text</td><td><textarea name="text" rows="4" cols="49"></textarea></td></tr>
        <tr><td></td><td><input type="submit" value="submit"></td></tr>
        <tr><td></td><td><a href="formatdoc">help</a></td></tr>
      </table>
    </form>
  `,
    "https://news.ycombinator.com/submit",
  );

  enhanceHackerNews(document);

  assert.ok(document.querySelector(".hb-modal .hb-compose-panel"));
  assert.equal(document.querySelector(".hb-compose-title")?.textContent, "New post");
  assert.equal(document.querySelector(".hb-auth-panel"), null);
  assert.equal(document.querySelector('.hb-compose-field input[name="title"]')?.classList.contains("hb-compose-input"), true);
  assert.equal(document.querySelector('.hb-compose-field input[name="url"]')?.classList.contains("hb-compose-input"), true);
  assert.equal(document.querySelector('.hb-compose-field input[name="url"]')?.getAttribute("type"), "text");
  assert.equal(document.querySelector('.hb-compose-field input[name="url"]')?.getAttribute("inputmode"), "url");
  assert.equal(document.querySelector('.hb-compose-field textarea[name="text"]')?.classList.contains("hb-compose-textarea"), true);
  assert.equal(document.querySelector('.hb-compose-field input[name="title"]')?.getAttribute("size"), null);
  assert.equal(document.querySelector('.hb-compose-field textarea[name="text"]')?.getAttribute("cols"), null);
  assert.equal(document.querySelector(".hb-compose-or")?.textContent, "or");
  assert.equal(document.querySelector(".hb-compose-panel .hb-form-actions .hb-primary-btn")?.value, "Submit");
  assert.equal(document.querySelector(".hb-compose-help")?.textContent, "Formatting help");
  assert.equal(document.querySelector('input[name="fnid"]')?.value, "abc");
  assert.equal(document.querySelector(".hb-bc-current")?.textContent, "New post");
  assert.equal(document.querySelector(".hb-tab-nav a.hb-tab-focus"), null);
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
  assert.equal(loginDoc.querySelector(".hb-auth-title").textContent, "Log in");
  assert.equal(loginDoc.querySelectorAll(".hb-auth-card").length, 1);
  assert.equal(loginDoc.querySelector(".hb-auth-card h3").textContent, "Log in");
  assert.equal(loginDoc.querySelector(".hb-auth-switch").getAttribute("href"), "login?mode=register");
  assert.ok(loginDoc.querySelector(".hb-modal .hb-auth-panel"));
  assert.ok(loginDoc.querySelector(".hb-auth-card .hb-form-actions .hb-primary-btn"));
  assert.ok(loginDoc.querySelector(".hb-auth-card .hb-form-actions-left .hb-auth-forgot"));
  assert.equal(loginDoc.body.classList.contains("hb-popup-page"), true);
  assert.equal(loginDoc.body.classList.contains("hb-popup-standalone"), true);
  assert.equal(loginDoc.querySelector(".hb-tab-nav a.hb-tab-focus"), null);

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
  assert.equal(registerDoc.querySelector(".hb-auth-title").textContent, "Sign up");
  assert.equal(registerDoc.querySelectorAll(".hb-auth-card").length, 1);
  assert.equal(registerDoc.querySelector(".hb-auth-card h3").textContent, "Create account");
  assert.equal(registerDoc.querySelector(".hb-auth-switch").getAttribute("href"), "login");
  assert.ok(registerDoc.querySelector(".hb-modal .hb-auth-panel"));
  assert.equal(registerDoc.body.classList.contains("hb-popup-page"), true);
  assert.equal(registerDoc.body.classList.contains("hb-popup-standalone"), true);
});

test("吧规页以弹层展示，不挂在看帖主栏", () => {
  const document = createDocument(`
    <center>
      <br><br>
      <table width="500">
        <tr><td bgcolor="#fafaf0">
          <img src="yc500.gif" width="500">
          <br><br>
          <b>Hacker News Guidelines</b>
          <br><br>
          <b>What to Submit</b>
          <p>On-Topic: Anything that good hackers would find interesting.</p>
          <b>In Comments</b>
          <p>Be kind. Don't be snarky.</p>
          <br><br><br>
          <table width="100%" bgcolor="#ff6600" cellpadding="0"><tr><td></td></tr></table>
          <p align="center"><span class="foot"><br><br></span></p>
        </td></tr>
      </table>
    </center>
  `, "https://news.ycombinator.com/newsguidelines.html");

  enhanceHackerNews(document);

  assert.ok(document.querySelector(".hb-doc-panel"));
  assert.ok(document.querySelector(".hb-modal .hb-doc-panel"));
  assert.equal(document.querySelector(".hb-auth-panel"), null);
  assert.equal(document.querySelector(".hb-hn-source .hb-doc-panel"), null);
  assert.match(document.querySelector(".hb-doc-title").textContent, /Guidelines|吧规|规范/);
  assert.match(document.querySelector(".hb-doc-body").textContent, /On-Topic/);
  assert.match(document.querySelector(".hb-doc-body").textContent, /Be kind/);
  assert.equal(document.querySelector(".hb-doc-body img"), null);
  assert.equal(document.querySelector(".hb-doc-body .foot"), null);
  assert.equal(document.querySelector('.hb-doc-body table[bgcolor="#ff6600"]'), null);
  assert.doesNotMatch(document.querySelector(".hb-doc-body").innerHTML, /^(?:\s*<br\s*\/?>)+/i);
  assert.equal(document.querySelector(".hb-bc-current").textContent, "Rules");
  assert.equal(document.body.classList.contains("hb-popup-page"), true);
  assert.equal(document.body.classList.contains("hb-popup-standalone"), true);
  assert.equal(document.querySelector(".hb-tab-nav a.hb-tab-focus"), null);
});

test("列表页点击登录/吧规为页内弹框，关闭不跳转", async () => {
  const document = createDocument(
    `
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="https://example.com">A story</a></span></td>
      </tr>
      <tr>
        <td class="subtext">
          <span class="score">10 points</span>
          by <a href="user?id=alice" class="hnuser">alice</a>
          <span class="age" title="2024-01-01T00:00:00">1 hour ago</span>
          <a href="item?id=1">3&nbsp;comments</a>
        </td>
      </tr>
    </table>
  `,
    "https://news.ycombinator.com/news",
  );

  enhanceHackerNews(document);

  const loginHtml = `
    <b>Login</b>
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
  `;
  const rulesHtml = `
    <center><table width="500"><tr><td bgcolor="#fafaf0">
      <b>Hacker News Guidelines</b>
      <p>On-Topic: Anything that good hackers would find interesting.</p>
    </td></tr></table></center>
  `;
  const submitHtml = `
    <form method="post" action="r">
      <input type="hidden" name="fnid" value="abc">
      <input type="hidden" name="fnop" value="submit-page">
      <table border="0">
        <tr><td>title</td><td><input type="text" name="title" size="50"></td></tr>
        <tr><td>url</td><td><input type="url" name="url" size="50"></td></tr>
        <tr><td></td><td><b>or</b></td></tr>
        <tr><td>text</td><td><textarea name="text" rows="4" cols="49"></textarea></td></tr>
        <tr><td></td><td><input type="submit" value="submit"></td></tr>
      </table>
    </form>
  `;

  document.defaultView.fetch = async (url) => {
    const href = String(url);
    if (href.includes("login")) {
      return {
        ok: true,
        text: async () => loginHtml,
      };
    }
    if (href.includes("guidelines")) {
      return {
        ok: true,
        text: async () => rulesHtml,
      };
    }
    if (href.includes("submit")) {
      return {
        ok: true,
        text: async () => submitHtml,
      };
    }
    return { ok: false, status: 404, text: async () => "" };
  };

  const loginLink = document.querySelector('.hb-userbar a[href="login"]');
  assert.ok(loginLink);
  loginLink.dispatchEvent(
    new document.defaultView.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    }),
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(document.defaultView.location.pathname, "/news");
  assert.ok(document.querySelector(".hb-modal .hb-auth-panel"));
  assert.equal(document.body.classList.contains("hb-popup-page"), true);
  assert.equal(document.body.classList.contains("hb-popup-standalone"), false);
  assert.ok(document.querySelector('.hb-tab-nav a[data-hb-tab="posts"].hb-tab-focus'));

  document.querySelector(".hb-modal-close").click();
  assert.equal(document.querySelector(".hb-modal-overlay"), null);
  assert.equal(document.body.classList.contains("hb-popup-page"), false);
  assert.equal(document.defaultView.location.pathname, "/news");
  assert.ok(document.querySelector(".hb-thread-list"));

  const rulesLink = document.querySelector('.hb-aside-link[href="newsguidelines.html"]');
  assert.ok(rulesLink);
  rulesLink.dispatchEvent(
    new document.defaultView.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(document.defaultView.location.pathname, "/news");
  assert.ok(document.querySelector(".hb-modal .hb-doc-panel"));
  assert.match(document.querySelector(".hb-doc-body").textContent, /On-Topic/);

  document.querySelector(".hb-modal-close").click();
  assert.equal(document.querySelector(".hb-modal-overlay"), null);

  const postLink = document.querySelector("a.hb-tab-post[href='submit']");
  assert.ok(postLink);
  assert.equal(document.defaultView.HackerBa.isPopupHref("submit", document), true);
  postLink.dispatchEvent(
    new document.defaultView.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(document.defaultView.location.pathname, "/news");
  assert.ok(document.querySelector(".hb-modal .hb-compose-panel"));
  assert.equal(document.querySelector(".hb-compose-title")?.textContent, "New post");
  assert.equal(document.body.classList.contains("hb-popup-standalone"), false);
  assert.ok(document.querySelector('.hb-compose-field input[name="title"]'));
});

test("用户信息页以弹层展示，不点亮看帖 Tab", () => {
  const document = createDocument(
    `
    <table id="hnmain">
      <tr>
        <td bgcolor="#ff6600">
          <table><tr><td><b>Hacker News</b></td><td>login</td></tr></table>
        </td>
      </tr>
      <tr>
        <td>
          <form method="post" action="x">
            <table>
              <tr><td>user:</td><td>alice</td></tr>
              <tr><td>created:</td><td>10 years ago</td></tr>
              <tr><td>karma:</td><td>1234</td></tr>
              <tr><td>about:</td><td><textarea name="about">Hello from alice</textarea></td></tr>
              <tr><td></td><td><input type="submit" value="update"></td></tr>
            </table>
          </form>
        </td>
      </tr>
    </table>
  `,
    "https://news.ycombinator.com/user?id=alice",
  );

  enhanceHackerNews(document);

  assert.ok(document.querySelector(".hb-modal-overlay"));
  assert.ok(document.querySelector(".hb-modal .hb-user-panel"));
  assert.equal(document.querySelector(".hb-doc-title").textContent, "alice");
  assert.match(document.querySelector(".hb-doc-body").textContent, /Hello from alice/);
  assert.match(document.querySelector(".hb-doc-body").textContent, /Karma/);
  assert.equal(document.querySelector(".hb-profile-karma")?.textContent, "1234");
  assert.equal(document.querySelector(".hb-profile-level")?.textContent, "Lv.7");
  assert.equal(document.querySelector(".hb-user-panel .hb-primary-btn")?.value, "Update profile");
  assert.ok(document.querySelector(".hb-user-panel .hb-form-actions .hb-primary-btn"));
  assert.equal(document.querySelector(".hb-user-panel .hb-form-actions-row"), null);
  assert.doesNotMatch(document.querySelector(".hb-doc-body").textContent, /login/);
  assert.equal(document.querySelector(".hb-bc-current").textContent, "alice");
  assert.equal(document.body.classList.contains("hb-popup-page"), true);
  assert.equal(document.body.classList.contains("hb-popup-standalone"), true);
  assert.equal(document.querySelector(".hb-tab-nav a.hb-tab-focus"), null);
  assert.equal(document.querySelector(".hb-hn-source").classList.contains("hb-source-hidden"), true);
});

test("中文语言下个人资料标签本地化", () => {
  const document = createDocument(
    `
    <table id="hnmain">
      <tr>
        <td>
          <form method="post" action="x">
            <table>
              <tr><td>user:</td><td>alice</td></tr>
              <tr><td>created:</td><td>10 years ago</td></tr>
              <tr><td>karma:</td><td>1234</td></tr>
              <tr><td>about:</td><td><textarea name="about">简介内容</textarea></td></tr>
              <tr><td></td><td><a href="submitted?id=alice">submissions</a></td></tr>
              <tr><td></td><td><a href="threads?id=alice">comments</a></td></tr>
              <tr><td></td><td><a href="favorites?id=alice">favorites</a></td></tr>
              <tr><td></td><td><input type="submit" value="update"></td></tr>
            </table>
          </form>
        </td>
      </tr>
    </table>
  `,
    "https://news.ycombinator.com/user?id=alice",
  );
  loadScripts(document);
  document.querySelector(".hb-wrap")?.remove();
  document.body.classList.remove("hackerba", "hb-popup-page", "hb-popup-standalone");
  document.documentElement.classList.remove("hackerba-page", "hb-boot");
  document.documentElement.dataset.hbLang = "zh";
  document.defaultView.HackerBa.enhanceHackerNews(document);

  const bodyText = document.querySelector(".hb-doc-body")?.textContent || "";
  assert.match(bodyText, /用户：/);
  assert.match(bodyText, /注册：/);
  assert.match(bodyText, /声望：/);
  assert.match(bodyText, /简介：/);
  assert.match(bodyText, /10 年前/);
  assert.ok(document.querySelector(".hb-profile-links"));
  assert.equal(
    [...document.querySelectorAll(".hb-profile-link")].map((a) => a.textContent).join(","),
    "提交,评论,收藏",
  );
  assert.equal(document.querySelector(".hb-user-panel .hb-primary-btn")?.value, "更新资料");
});

test("列表页点击用户链接能弹出用户详情", async () => {
  const document = createDocument(
    `
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="https://example.com">A story</a></span></td>
      </tr>
      <tr>
        <td class="subtext">
          <span class="score">10 points</span>
          by <a href="user?id=alice" class="hnuser">alice</a>
          <span class="age" title="2024-01-01T00:00:00">1 hour ago</span>
          <a href="item?id=1">3&nbsp;comments</a>
        </td>
      </tr>
    </table>
  `,
    "https://news.ycombinator.com/news",
  );

  enhanceHackerNews(document);

  const userHtml = `
    <html><head><title>Profile: alice | Hacker News</title></head><body>
    <table id="hnmain">
      <tr>
        <td bgcolor="#ff6600"><table><tr><td><b>Hacker News</b></td><td>login</td></tr></table></td>
      </tr>
      <tr>
        <td>
          <form method="post" action="x">
            <table>
              <tr><td>user:</td><td>alice</td></tr>
              <tr><td>created:</td><td>10 years ago</td></tr>
              <tr><td>karma:</td><td>1234</td></tr>
              <tr><td>about:</td><td><textarea name="about">Hello from alice</textarea></td></tr>
              <tr><td></td><td><input type="submit" value="update"></td></tr>
            </table>
          </form>
        </td>
      </tr>
    </table>
    </body></html>
  `;

  document.defaultView.fetch = async () => ({
    ok: true,
    text: async () => userHtml,
  });

  const author = document.querySelector(".hb-author");
  assert.ok(author);
  author.dispatchEvent(
    new document.defaultView.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(document.defaultView.location.pathname, "/news");
  assert.ok(document.querySelector(".hb-modal .hb-user-panel"));
  assert.equal(document.querySelector(".hb-doc-title").textContent, "alice");
  assert.match(document.querySelector(".hb-doc-body").textContent, /Hello from alice/);
  assert.doesNotMatch(document.querySelector(".hb-doc-body").textContent, /^\s*Hacker News\s*login/s);
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
    "Posts,Ask,Show,Jobs,Best",
  );
  assert.equal(document.querySelector(".hb-tab-nav .hb-tab-focus").textContent, "Posts");
  assert.equal(document.querySelector(".hb-thread-top .hb-sort-focus").textContent, "Newest posts");
  assert.equal(
    [...document.querySelectorAll(".hb-thread-sort a")].map((a) => a.textContent).join(","),
    "Default,Newest posts",
  );
  assert.equal(document.querySelector(".hb-aside-links"), null);
  assert.ok(document.querySelector(".hb-aside-box .hb-aside-link"));
  assert.equal(document.querySelectorAll(".hb-aside-box").length, 1);
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

  assert.equal(document.querySelector(".hb-tab-nav .hb-tab-focus").textContent, "Ask");
  assert.equal(document.querySelector(".hb-thread-sort a"), null);
  assert.equal(document.querySelector(".hb-thread-sort .hb-sort-focus").textContent, "Ask");
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
  assert.equal(document.body.classList.contains("hb-item-page"), true);
  assert.equal(document.querySelector(".hb-tab-bar")?.hidden, true);
  assert.equal(document.querySelector(".hb-tab-nav a.hb-tab-focus"), null);
  assert.ok(main);
  assert.ok(document.querySelector(".hb-core-title"));
  assert.match(document.querySelector(".hb-core-title-txt").textContent, /Main post/);
  assert.match(document.querySelector(".hb-core-meta").textContent, /Replies: 1/);
  assert.equal(document.querySelector(".hb-core-title-ctrl"), null);
  assert.equal(main.querySelector(".hb-floor-no").textContent, "1F");
  assert.equal(main.querySelector(".hb-floor-name").textContent, "alice");
  assert.ok(main.querySelector(".hb-louzhu"));
  assert.ok(main.querySelector(".hb-floor-level"));
  assert.ok(main.querySelector(".hb-share-link"));
  assert.equal(main.querySelector(".hb-main-title"), null);
  assert.equal(main.querySelector(".hb-reply-box form"), null);
  assert.equal(document.querySelector(".hb-reply-panel-title")?.textContent, "Post a reply");
  assert.equal(document.querySelector('.hb-reply-box input[type="submit"]')?.value, "Submit");
  assert.ok(document.querySelector(".hb-reply-box .hb-form-actions .hb-primary-btn"));
  assert.equal(card.querySelector(".hb-floor-no").textContent, "2F");
  assert.equal(card.querySelector(".hb-floor-name").textContent, "bob");
  assert.match(card.querySelector(".hb-floor-content").textContent, /Useful answer/);
  assert.equal(card.querySelector(".hb-floor-reply").textContent, "Reply");
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
  assert.equal(document.querySelector(".hb-floor-list .hb-floor-no").textContent, "2F");
  const lzl = document.querySelector(".hb-lzl");
  assert.ok(lzl);
  assert.equal(lzl.querySelector(".hb-lzl-num").textContent, "2");
  const items = [...lzl.querySelectorAll(".hb-lzl-item")];
  assert.equal(items.length, 2);
  assert.match(items[0].textContent, /carol/);
  assert.match(items[0].textContent, /Nested/);
  assert.equal(items[0].querySelector(".hb-lzl-to"), null);
  assert.match(items[1].querySelector(".hb-lzl-to").textContent, /Reply to carol/);
  assert.match(items[1].textContent, /Deeper/);
});

test("楼中楼超过 3 条时默认折叠其余回复", () => {
  const replies = Array.from({ length: 7 }, (_, i) => {
    const n = i + 1;
    return `
      <tr class="athing comtr">
        <td class="ind" indent="1"></td>
        <td class="default">
          <span class="comhead"><a class="hnuser" href="user?id=u${n}">u${n}</a></span>
          <div class="comment"><span class="commtext">Reply ${n}</span></div>
        </td>
      </tr>
    `;
  }).join("");

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
              | <a href="item?id=1">8&nbsp;comments</a>
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
          ${replies}
        </table>
      </td></tr>
    </table>
  `,
    "https://news.ycombinator.com/item?id=1",
  );

  enhanceHackerNews(document);

  const lzl = document.querySelector(".hb-lzl");
  assert.ok(lzl);
  assert.equal(lzl.querySelector(".hb-lzl-num").textContent, "7");
  const items = [...lzl.querySelectorAll(".hb-lzl-item")];
  assert.equal(items.length, 7);
  assert.equal(items.filter((item) => item.classList.contains("hb-lzl-item-folded")).length, 4);
  assert.ok(items[2].classList.contains("hb-lzl-preview-last"));

  const more = lzl.querySelector(".hb-lzl-more");
  assert.ok(more);
  assert.match(more.textContent, /Show 4 more replies/);

  more.click();
  assert.equal(lzl.querySelector(".hb-lzl-more"), null);
  assert.equal(lzl.querySelectorAll(".hb-lzl-item-folded").length, 0);
  assert.equal(lzl.querySelector(".hb-lzl-preview-last"), null);
});

test("楼中楼预览设为不限制时全部展示", async () => {
  const replies = Array.from({ length: 6 }, (_, i) => {
    const n = i + 1;
    return `
      <tr class="athing comtr">
        <td class="ind" indent="1"></td>
        <td class="default">
          <span class="comhead"><a class="hnuser" href="user?id=u${n}">u${n}</a></span>
          <div class="comment"><span class="commtext">Reply ${n}</span></div>
        </td>
      </tr>
    `;
  }).join("");

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
              | <a href="item?id=1">7&nbsp;comments</a>
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
          ${replies}
        </table>
      </td></tr>
    </table>
  `,
    "https://news.ycombinator.com/item?id=1",
  );
  document.defaultView.chrome = {
    storage: {
      sync: {
        async get(defaults) {
          return { ...defaults, lzlPreviewLimit: "unlimited" };
        },
      },
    },
  };

  loadScripts(document);
  await document.defaultView.HackerBa.applyPreferences(document);
  document.defaultView.HackerBa.enhanceHackerNews(document);

  const lzl = document.querySelector(".hb-lzl");
  assert.ok(lzl);
  assert.equal(document.documentElement.dataset.hbLzlPreview, "unlimited");
  assert.equal(lzl.querySelectorAll(".hb-lzl-item-folded").length, 0);
  assert.equal(lzl.querySelector(".hb-lzl-more"), null);
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
  assert.match(page1.querySelector(".hb-thread-count").textContent, /This page: 1 topics · Page 1/);
  assert.equal(page1.querySelector(".hb-pager-disabled")?.textContent, "< Prev");
  assert.equal(page1.querySelector(".hb-pager-info")?.textContent, "Page 1");
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
  assert.match(page2.querySelector(".hb-thread-count").textContent, /Page 2/);
  assert.equal(page2.querySelector(".hb-pager-prev")?.getAttribute("href"), "news");
  assert.equal(page2.querySelector(".hb-pager-info")?.textContent, "Page 2");
  assert.equal(page2.querySelector(".hb-pager-next")?.getAttribute("href"), "?p=3");
});

test("已登录时顶栏显示用户名与退出", () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr>
        <td><span class="pagetop"><b><a href="news">Hacker News</a></b></span></td>
        <td><span class="pagetop"><a href="user?id=alice">alice</a> (3) | <a href="logout?auth=x">logout</a></span></td>
      </tr>
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="https://example.com">A</a></span></td>
      </tr>
      <tr><td class="subtext"><a href="item?id=1">1&nbsp;comment</a></td></tr>
    </table>
  `);

  enhanceHackerNews(document);

  assert.equal(document.querySelector(".hb-user-name")?.textContent, "alice");
  assert.equal(document.querySelector(".hb-user-name")?.getAttribute("href"), "user?id=alice");
  assert.equal(document.querySelector('.hb-userbar a[href^="logout"]')?.textContent, "Log out");
  assert.equal(document.querySelector('.hb-userbar a[href="login"]'), null);
  assert.equal(document.querySelector(".hb-card-level")?.dataset.hbUser, "alice");
  assert.equal(document.querySelector(".hb-card-level")?.textContent, "Lv.1");
  assert.equal(document.querySelector(".hb-btn-attention.hb-btn-followed")?.textContent, "Following");
  assert.equal(document.querySelector(".hb-btn-checkin.hb-btn-checked")?.textContent, "Checked in");
  assert.equal(document.querySelector('.hb-card-btns a.hb-btn-attention[href="login"]'), null);
});

test("顶栏提供插件设置入口", async () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="https://example.com">A</a></span></td>
      </tr>
      <tr><td class="subtext"><a href="item?id=1">1&nbsp;comment</a></td></tr>
    </table>
  `);
  const stored = {};
  let reloaded = false;
  document.defaultView.chrome = {
    runtime: {
      getManifest() {
        return { version: "0.2.0" };
      },
    },
    storage: {
      sync: {
        async get(defaults) {
          return { ...defaults, ...stored };
        },
        async set(values) {
          Object.assign(stored, values);
        },
      },
    },
  };
  document.defaultView.hbReloadPage = () => {
    reloaded = true;
  };

  enhanceHackerNews(document);

  const link = document.querySelector(".hb-userbar .hb-settings-link");
  assert.ok(link);
  assert.equal(link.getAttribute("href"), "#");
  assert.equal(link.textContent, "Settings");

  link.dispatchEvent(
    new document.defaultView.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
  );

  const panel = document.querySelector(".hb-modal .hb-settings-panel");
  assert.ok(panel);
  assert.equal(panel.querySelector(".hb-settings-title")?.textContent, "Settings");
  assert.ok(panel.querySelector("#hb-preferences"));
  assert.ok(panel.querySelector(".hb-settings-section-title"));
  assert.ok(panel.querySelector(".hb-settings-toggle"));

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(panel.querySelector("#theme")?.value, "light");
  assert.equal(panel.querySelector("#accentColor")?.value, "blue");
  assert.equal(panel.querySelector("#lzlPreviewLimit")?.value, "3");

  panel.querySelector("#theme").value = "dark";
  panel.querySelector("#accentColor").value = "orange";
  panel.querySelector("#lzlPreviewLimit").value = "10";
  panel.querySelector("#showBannerCover").checked = true;
  panel.querySelector("#hb-preferences").dispatchEvent(
    new document.defaultView.Event("submit", { bubbles: true, cancelable: true }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(stored.theme, "dark");
  assert.equal(stored.accentColor, "orange");
  assert.equal(stored.lzlPreviewLimit, "10");
  assert.equal(stored.showBannerCover, true);
  assert.equal(reloaded, true);
});

test("未登录时吧等级为占位", () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="https://example.com">A</a></span></td>
      </tr>
      <tr><td class="subtext"><a href="item?id=1">1&nbsp;comment</a></td></tr>
    </table>
  `);

  enhanceHackerNews(document);

  assert.equal(document.querySelector(".hb-card-level")?.textContent, "Lv.—");
  assert.equal(document.querySelector(".hb-card-level")?.dataset.hbUser, undefined);
  assert.equal(document.querySelector(".hb-btn-attention.hb-btn-followed"), null);
  assert.equal(document.querySelector('.hb-card-btns a.hb-btn-attention[href="login"]')?.textContent, "Follow");
  assert.equal(document.querySelector('.hb-card-btns a.hb-btn-checkin[href="login"]')?.textContent, "Check in");
});

test("当前用户回复显示我标识，楼主优先", () => {
  const document = createDocument(
    `
    <table id="hnmain">
      <tr>
        <td><span class="pagetop"><b><a href="news">Hacker News</a></b></span></td>
        <td><span class="pagetop"><a href="user?id=bob">bob</a> (1) | <a href="logout?auth=x">logout</a></span></td>
      </tr>
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
              <div class="comment"><span class="commtext">Mine</span></div>
            </td>
          </tr>
          <tr class="athing comtr">
            <td class="ind" indent="1"></td>
            <td class="default">
              <span class="comhead"><a class="hnuser" href="user?id=bob">bob</a></span>
              <div class="comment"><span class="commtext">Also mine</span></div>
            </td>
          </tr>
          <tr class="athing comtr">
            <td class="ind" indent="1"></td>
            <td class="default">
              <span class="comhead"><a class="hnuser" href="user?id=alice">alice</a></span>
              <div class="comment"><span class="commtext">OP reply</span></div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  `,
    "https://news.ycombinator.com/item?id=1",
  );

  enhanceHackerNews(document);

  const main = document.querySelector(".hb-main-floor");
  assert.ok(main.querySelector(".hb-louzhu"));
  assert.equal(main.querySelector(".hb-me"), null);

  const myFloor = document.querySelector(".hb-floor-list .hb-floor");
  assert.ok(myFloor.classList.contains("hb-floor-me"));
  assert.ok(myFloor.querySelector(".hb-me"));
  assert.equal(myFloor.querySelector(".hb-louzhu"), null);
  assert.equal(myFloor.querySelector(".hb-me").textContent, "Me");

  const lzlItems = [...document.querySelectorAll(".hb-lzl-item")];
  assert.equal(lzlItems.length, 2);
  assert.ok(lzlItems[0].classList.contains("hb-lzl-me"));
  assert.equal(lzlItems[0].querySelector(".hb-lzl-me-tag")?.textContent, "Me");
  assert.equal(lzlItems[0].querySelector(".hb-lzl-lz-tag"), null);
  assert.equal(lzlItems[1].querySelector(".hb-lzl-lz-tag")?.textContent, "OP");
  assert.equal(lzlItems[1].querySelector(".hb-lzl-me-tag"), null);
});

test("cursor 分页只显示下一页", () => {
  const document = createDocument(
    `
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="https://example.com">A</a></span></td>
      </tr>
      <tr><td class="subtext"><a href="item?id=1">1&nbsp;comment</a></td></tr>
      <tr><td class="title"><a href="newest?next=abc" class="morelink" rel="next">More</a></td></tr>
    </table>
  `,
    "https://news.ycombinator.com/newest?next=xyz",
  );

  enhanceHackerNews(document);

  assert.equal(document.querySelector(".hb-pager-prev"), null);
  assert.equal(document.querySelector(".hb-pager-disabled"), null);
  assert.equal(document.querySelector(".hb-pager-info"), null);
  assert.equal(document.querySelector(".hb-pager-next")?.getAttribute("href"), "newest?next=abc");
});

test("看帖页搜索会移除帖子区", async () => {
  const document = createDocument(
    `
    <table id="hnmain">
      <tr><td>
        <table class="fatitem">
          <tr class="athing">
            <td class="title"><span class="titleline"><a href="https://example.com">Main</a></span></td>
          </tr>
          <tr>
            <td class="subtext">
              by <a class="hnuser" href="user?id=alice">alice</a>
              <span class="age">1 hour ago</span>
              | <a href="item?id=1">1&nbsp;comment</a>
            </td>
          </tr>
          <tr>
            <td><form action="comment"><textarea name="text"></textarea><input type="submit" value="add comment"></form></td>
          </tr>
        </table>
        <table class="comment-tree">
          <tr class="athing comtr">
            <td class="ind" indent="0"></td>
            <td class="default">
              <span class="comhead"><a class="hnuser" href="user?id=bob">bob</a></span>
              <div class="comment"><span class="commtext">Hi</span></div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  `,
    "https://news.ycombinator.com/item?id=1",
  );

  enhanceHackerNews(document);
  assert.ok(document.querySelector(".hb-post-wrap"));

  document.defaultView.fetch = async () => ({
    ok: true,
    json: async () => ({
      hits: [
        {
          objectID: "9",
          title: "Found",
          url: "https://example.com/f",
          author: "carol",
          points: 1,
          num_comments: 0,
          created_at_i: Math.floor(Date.now() / 1000),
        },
      ],
      nbHits: 1,
    }),
  });

  await document.defaultView.HackerBa.runLocalSearch(document, "Found");

  assert.equal(document.querySelector(".hb-post-wrap"), null);
  assert.equal(document.body.classList.contains("hb-item-page"), false);
  assert.equal(document.querySelector(".hb-th-tit")?.textContent, "Found");
  assert.match(document.querySelector(".hb-thread-count").textContent, /Found 1/);
});

test("搜索竞态只采用最后一次结果", async () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="https://example.com">A</a></span></td>
      </tr>
      <tr><td class="subtext"><a href="item?id=1">1&nbsp;comment</a></td></tr>
    </table>
  `);
  enhanceHackerNews(document);

  let releaseSlow;
  const slowReady = new Promise((resolve) => {
    releaseSlow = resolve;
  });

  document.defaultView.fetch = async (url) => {
    if (String(url).includes("slow")) {
      await slowReady;
      return {
        ok: true,
        json: async () => ({
          hits: [{ objectID: "1", title: "SLOW", author: "a", points: 1, num_comments: 0, created_at_i: 1 }],
          nbHits: 1,
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        hits: [{ objectID: "2", title: "FAST", author: "b", points: 1, num_comments: 0, created_at_i: 1 }],
        nbHits: 1,
      }),
    };
  };

  const slow = document.defaultView.HackerBa.runLocalSearch(document, "slow");
  const fast = document.defaultView.HackerBa.runLocalSearch(document, "fast");
  await fast;
  releaseSlow();
  await slow;

  assert.equal(document.querySelector(".hb-th-tit")?.textContent, "FAST");
  assert.match(document.querySelector(".hb-thread-count").textContent, /Found 1/);
});

test("主题跟随系统会解析为 light 或 dark", () => {
  const document = createDocument(`<table id="hnmain"></table>`);
  loadScripts(document);
  const { resolveTheme } = document.defaultView.HackerBa;
  assert.equal(resolveTheme("light"), "light");
  assert.equal(resolveTheme("dark"), "dark");
  assert.equal(resolveTheme("system", {
    matchMedia: () => ({ matches: true }),
  }), "dark");
  assert.equal(resolveTheme("system", {
    matchMedia: () => ({ matches: false }),
  }), "light");
});

test("语言偏好 zh 时界面为中文", () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr class="athing submission" id="1">
        <td class="title"><span class="titleline"><a href="https://example.com">A story</a></span></td>
      </tr>
      <tr>
        <td class="subtext">
          <span class="score">10 points</span>
          by <a class="hnuser" href="user?id=alice">alice</a>
          <span class="age"><a href="item?id=1">0 minutes ago</a></span>
          | <a href="item?id=1">3&nbsp;comments</a>
        </td>
      </tr>
    </table>
  `);
  loadScripts(document);
  document.querySelector(".hb-wrap")?.remove();
  document.body.classList.remove("hackerba");
  document.documentElement.classList.remove("hackerba-page", "hb-boot");
  document.documentElement.dataset.hbLang = "zh";
  document.defaultView.HackerBa.enhanceHackerNews(document);

  assert.match(document.querySelector(".hb-brand").textContent, /贴吧/);
  assert.equal(document.querySelector(".hb-brand").getAttribute("title"), "Hacker贴吧");
  assert.equal(document.querySelector(".hb-breadcrumb a")?.textContent, "Hacker贴吧");
  assert.equal(document.querySelector(".hb-search-btn").textContent, "搜索");
  assert.match(document.querySelector(".hb-footer")?.textContent || "", /Hacker贴吧/);
  assert.equal(
    [...document.querySelectorAll(".hb-tab-nav a")].map((a) => a.textContent).join(","),
    "看帖,问答,作品,招聘,精品",
  );
  assert.equal(document.querySelector(".hb-create-time")?.textContent, "刚刚");
});

test("中文下列表相对时间本地化", () => {
  const document = createDocument(`
    <table id="hnmain">
      <tr class="athing" id="1">
        <td class="title"><span class="titleline"><a href="item?id=1">A</a></span></td>
      </tr>
      <tr>
        <td class="subtext">
          <a class="hnuser" href="user?id=a">a</a>
          <span class="age">2 hours ago</span>
          | <a href="item?id=1">1&nbsp;comment</a>
        </td>
      </tr>
      <tr class="athing" id="2">
        <td class="title"><span class="titleline"><a href="item?id=2">B</a></span></td>
      </tr>
      <tr>
        <td class="subtext">
          <a class="hnuser" href="user?id=b">b</a>
          <span class="age">1 minute ago</span>
          | <a href="item?id=2">discuss</a>
        </td>
      </tr>
    </table>
  `);
  loadScripts(document);
  document.documentElement.dataset.hbLang = "zh";
  document.defaultView.HackerBa.enhanceHackerNews(document);

  const ages = [...document.querySelectorAll(".hb-create-time")].map((el) => el.textContent);
  assert.deepEqual(ages, ["2 小时前", "1 分钟前"]);
});

test("karma 对数曲线无上限，参考点约 Lv.12", () => {
  const document = createDocument("<div></div>");
  loadScripts(document);
  const { userLevelFromKarma, KARMA_LEVEL_REF, KARMA_LEVEL_AT_REF } = document.defaultView.HackerBa;

  assert.equal(userLevelFromKarma(0), 0);
  assert.equal(userLevelFromKarma(-10), 0);
  assert.equal(userLevelFromKarma(KARMA_LEVEL_REF), KARMA_LEVEL_AT_REF);
  assert.ok(userLevelFromKarma(KARMA_LEVEL_REF * 10) > KARMA_LEVEL_AT_REF);
  assert.ok(userLevelFromKarma(100) < userLevelFromKarma(1000));
  assert.ok(userLevelFromKarma(1000) < userLevelFromKarma(10000));
  assert.ok(userLevelFromKarma(0) >= 0);
});
