function enhanceHackerNews(document) {
  if (!document?.body || document.body.classList.contains("hackerba")) {
    return;
  }

  document.body.classList.add("hackerba");
  document.documentElement.classList.add("hackerba-page");
  buildCommunityShell(document);
  highlightActiveTab(document);
  rebuildThreadList(document);
  revealSourceIfNeeded(document);
  enhanceComments(document);
  applyPreferences(document);
}

function buildCommunityShell(document) {
  const hnMain = document.querySelector("#hnmain");
  if (!hnMain || document.querySelector(".hb-wrap")) {
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "hb-wrap";
  wrap.innerHTML = `
    <div class="hb-topbar">
      <div class="hb-topbar-inner">
        <a class="hb-brand" href="news">百度贴吧</a>
        <a class="hb-top-link" href="news">Hacker News 吧</a>
        <form class="hb-search" action="https://hn.algolia.com/" method="get">
          <input name="q" type="search" placeholder="请输入搜索关键词" aria-label="搜索">
          <button type="submit">百度一下</button>
        </form>
        <div class="hb-userbar">
          <a href="login">登录</a>
          <span>|</span>
          <a href="login?goto=submit">注册</a>
        </div>
      </div>
    </div>
    <div class="hb-card-banner">
      <div class="hb-card-head">
        <div class="hb-card-avatar" aria-hidden="true">HN</div>
        <div class="hb-card-info">
          <h1 class="hb-card-title">Hacker News 吧</h1>
          <div class="hb-card-num">
            <span><em>关注：</em>1,234,567</span>
            <span><em>帖子：</em>98,765</span>
          </div>
          <p class="hb-card-slogan">专注分享、讨论科技与创业的社区</p>
        </div>
        <div class="hb-card-btns">
          <button type="button" class="hb-btn-attention">关注</button>
          <a class="hb-btn-post" href="submit">发帖</a>
        </div>
      </div>
    </div>
    <div class="hb-content clearfix">
      <div class="hb-main">
        <ul class="hb-tab-nav">
          <li><a href="news">看帖</a></li>
          <li><a href="newest">最新</a></li>
          <li><a href="best">精品</a></li>
          <li><a href="ask">问答</a></li>
          <li><a href="show">作品</a></li>
          <li><a href="jobs">招聘</a></li>
        </ul>
        <div class="hb-thread-panel"></div>
      </div>
      <aside class="hb-aside">
        <div class="hb-aside-box">
          <div class="hb-aside-title">本吧信息</div>
          <div class="hb-aside-body">
            <p>吧主：Y Combinator</p>
            <p>目录：科技 / 创业 / 极客</p>
            <p>创建：2007 年</p>
            <a class="hb-aside-link" href="https://news.ycombinator.com/newsguidelines.html">吧规</a>
          </div>
        </div>
        <div class="hb-aside-box">
          <div class="hb-aside-title">吧内导航</div>
          <div class="hb-aside-body hb-aside-links">
            <a href="submit">发表新帖</a>
            <a href="newest">最新讨论</a>
            <a href="best">热门主题</a>
            <a href="front">往日精华</a>
          </div>
        </div>
        <div class="hb-aside-box">
          <div class="hb-aside-title">温馨提示</div>
          <div class="hb-aside-body">
            <p>HackerBa 仅美化 Hacker News 页面，数据与账号仍走原站。</p>
          </div>
        </div>
      </aside>
    </div>
  `;

  document.body.insertBefore(wrap, document.body.firstChild);

  const source = document.createElement("div");
  source.className = "hb-hn-source";
  source.hidden = true;
  source.append(hnMain);
  wrap.querySelector(".hb-thread-panel").append(source);

  hnMain.querySelector(".pagetop")?.closest("tr")?.classList.add("hb-original-header");
}

function getCurrentTabKey(document) {
  const path = document.defaultView?.location?.pathname?.replace(/^\//, "") || "news";
  if (!path || path === "news" || path === "front" || path === "") {
    return "news";
  }
  return path.split("/")[0];
}

function highlightActiveTab(document) {
  const tabs = document.querySelectorAll(".hb-tab-nav a");
  if (tabs.length === 0) {
    return;
  }

  const current = getCurrentTabKey(document);
  let matched = false;

  tabs.forEach((tab) => {
    const key = (tab.getAttribute("href") || "").replace(/^\//, "");
    const active = key === current;
    tab.classList.toggle("hb-tab-focus", active);
    matched = matched || active;
  });

  if (!matched) {
    document.querySelector('.hb-tab-nav a[href="news"]')?.classList.add("hb-tab-focus");
  }
}

function isForumListPage(document) {
  if (document.querySelector(".fatitem, .comment-tree")) {
    return false;
  }
  return document.querySelectorAll(".athing:not(.comtr)").length > 0;
}

function revealSourceIfNeeded(document) {
  const source = document.querySelector(".hb-hn-source");
  if (!source) {
    return;
  }
  source.hidden = Boolean(document.querySelector(".hb-thread-list"));
}

function rebuildThreadList(document) {
  if (document.querySelector(".hb-thread-list") || !isForumListPage(document)) {
    return;
  }

  const panel = document.querySelector(".hb-thread-panel");
  const stories = [...document.querySelectorAll(".athing:not(.comtr)")];
  if (!panel || stories.length === 0) {
    return;
  }

  const list = document.createElement("ul");
  list.className = "hb-thread-list";

  for (const story of stories) {
    const metaRow = story.nextElementSibling;
    const titleLink = story.querySelector(".titleline > a");
    if (!titleLink || !metaRow) {
      continue;
    }

    const author = metaRow.querySelector(".hnuser")?.textContent?.trim() || "匿名";
    const age = metaRow.querySelector(".age")?.textContent?.trim() || "";
    const commentsLink = [...metaRow.querySelectorAll("a")].find((link) =>
      /comment|discuss|讨论/i.test(link.textContent),
    );
    const replyText = commentsLink?.textContent?.replace(/\u00a0/g, " ").trim() || "0";
    const replyMatch = replyText.match(/(\d+)/);
    const replyNum = replyMatch ? replyMatch[1] : "0";
    const itemHref = commentsLink?.getAttribute("href") || titleLink.getAttribute("href");
    const site = story.querySelector(".sitestr")?.textContent?.trim();

    const item = document.createElement("li");
    item.className = "hb-thread-item";
    item.innerHTML = `
      <div class="hb-thread-left">
        <span class="hb-rep-num" title="回复">${replyNum}</span>
      </div>
      <div class="hb-thread-center">
        <div class="hb-thread-title">
          <a class="hb-th-tit" href="${escapeAttr(titleLink.getAttribute("href"))}" ${
            /^https?:/i.test(titleLink.getAttribute("href") || "") ? 'target="_blank" rel="noopener noreferrer"' : ""
          }>${escapeHtml(titleLink.textContent.trim())}</a>
          ${site ? `<span class="hb-th-site">${escapeHtml(site)}</span>` : ""}
        </div>
        <div class="hb-thread-detail">
          <span class="hb-author">${escapeHtml(author)}</span>
          <span class="hb-sep">·</span>
          <span class="hb-create-time">${escapeHtml(age)}</span>
          <a class="hb-goto-item" href="${escapeAttr(itemHref)}">查看讨论</a>
        </div>
      </div>
    `;
    list.append(item);
  }

  const moreLink = document.querySelector(".morelink");
  if (moreLink) {
    const pager = document.createElement("div");
    pager.className = "hb-pager";
    const next = document.createElement("a");
    next.href = moreLink.getAttribute("href");
    next.textContent = "下一页 >";
    pager.append(next);
    panel.append(list, pager);
  } else {
    panel.append(list);
  }
}

function enhanceComments(document) {
  document.querySelectorAll(".comtr").forEach((comment, index) => {
    comment.classList.add("hb-floor");
    comment.dataset.hbFloor = String(index + 1);

    if (!comment.querySelector(".hb-floor-avatar")) {
      const avatar = document.createElement("div");
      avatar.className = "hb-floor-avatar";
      const user = comment.querySelector(".hnuser")?.textContent?.trim() || "?";
      avatar.textContent = user.slice(0, 1).toUpperCase();
      comment.prepend(avatar);
    }

    if (comment.querySelector(".hb-floor-toggle")) {
      return;
    }

    const toggle = document.createElement("button");
    toggle.className = "hb-floor-toggle";
    toggle.type = "button";
    toggle.textContent = "收起";
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "收起该楼层");
    toggle.addEventListener("click", () => {
      const collapsed = comment.classList.toggle("hb-floor-collapsed");
      toggle.textContent = collapsed ? "展开" : "收起";
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.setAttribute("aria-label", `${collapsed ? "展开" : "收起"}该楼层`);
    });

    const head = comment.querySelector(".comhead") || comment.querySelector(".default") || comment;
    head.append(toggle);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value || "#");
}

async function applyPreferences(document) {
  if (!globalThis.chrome?.storage?.sync) {
    return;
  }

  const preferences = await chrome.storage.sync.get({
    theme: "light",
    density: "comfortable",
  });
  document.documentElement.dataset.hbTheme = preferences.theme;
  document.documentElement.dataset.hbDensity = preferences.density;
}

globalThis.HackerBa = {
  ...globalThis.HackerBa,
  enhanceHackerNews,
};

if (typeof document !== "undefined") {
  enhanceHackerNews(document);
}
