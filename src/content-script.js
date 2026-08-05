function enhanceHackerNews(document) {
  if (!document?.body || document.body.classList.contains("hackerba")) {
    return;
  }

  document.body.classList.add("hackerba");
  document.documentElement.classList.add("hackerba-page");
  buildCommunityShell(document);
  highlightActiveTab(document);
  rebuildThreadList(document);
  highlightActiveSort(document);
  revealSourceIfNeeded(document);
  enhanceComments(document);
  bindSearchForm(document);
  applyPreferences(document);
}

function getHnLogoUrl() {
  if (globalThis.chrome?.runtime?.getURL) {
    return chrome.runtime.getURL("src/icons/y18.svg");
  }
  return "y18.svg";
}

function localizeAuthLabel(text) {
  const value = String(text || "").trim().toLowerCase();
  if (value === "username:" || value === "username") {
    return "用户名";
  }
  if (value === "password:" || value === "password") {
    return "密码";
  }
  if (value === "login") {
    return "登录";
  }
  if (value === "create account") {
    return "注册账号";
  }
  return text;
}

function detectOrphanPageKind(document, host) {
  const path = document.defaultView?.location?.pathname || "";
  if (
    /\/(login|submit|forgot|changepw)/i.test(path) ||
    host.querySelector("form input[name='acct']")
  ) {
    return "auth";
  }
  return "document";
}

function setBreadcrumbCurrent(document, text) {
  const current = document.querySelector(".hb-bc-current");
  if (current) {
    current.textContent = text;
  }
}

function getAuthMode(document) {
  const params = new URLSearchParams(document.defaultView?.location?.search || "");
  if (params.get("mode") === "register" || params.get("creating") === "t") {
    return "register";
  }
  return "login";
}

function enhanceAuthPanel(document, host) {
  const panel = document.createElement("div");
  panel.className = "hb-auth-panel";

  const rawText = host.textContent || "";
  const path = document.defaultView?.location?.pathname || "";
  const needLogin = /logged in to submit|have to be logged in/i.test(rawText);
  const isForgot = /forgot/i.test(path);
  const mode = isForgot ? "forgot" : getAuthMode(document);

  const title = document.createElement("h2");
  title.className = "hb-auth-title";
  title.textContent = needLogin ? "登录后才能发帖" : mode === "register" ? "注册" : mode === "forgot" ? "找回密码" : "登录";
  panel.append(title);

  if (needLogin) {
    const tip = document.createElement("p");
    tip.className = "hb-auth-tip";
    tip.textContent = "你需要先登录账号，才能发表新帖。";
    panel.append(tip);
  }

  const cards = document.createElement("div");
  cards.className = "hb-auth-cards";

  const forms = [...host.querySelectorAll("form")];
  const selectedForms = forms.filter((form) => {
    const isCreate = Boolean(form.querySelector("input[name='creating']"));
    if (mode === "register") {
      return isCreate;
    }
    if (mode === "forgot") {
      return true;
    }
    return !isCreate;
  });

  selectedForms.forEach((form) => {
    const card = document.createElement("div");
    card.className = "hb-auth-card";

    const heading = document.createElement("h3");
    heading.textContent =
      mode === "register" ? "注册账号" : mode === "forgot" ? "重置密码" : "登录";
    card.append(heading);

    form.querySelectorAll("td").forEach((cell) => {
      if (!cell.querySelector("input")) {
        cell.textContent = localizeAuthLabel(cell.textContent);
      }
    });

    form.querySelectorAll("input[type='submit']").forEach((button) => {
      button.value = localizeAuthLabel(button.value);
      button.classList.add("hb-auth-submit");
    });

    card.append(form);

    if (mode === "login") {
      const forgot = host.querySelector("a[href='forgot']");
      if (forgot) {
        forgot.className = "hb-auth-forgot";
        forgot.textContent = "忘记密码？";
        card.append(forgot);
      }
    }

    cards.append(card);
  });

  panel.append(cards);

  if (mode === "login" || mode === "register") {
    const switchLink = document.createElement("a");
    switchLink.className = "hb-auth-switch";
    if (mode === "login") {
      switchLink.href = "login?mode=register";
      switchLink.textContent = "没有账号？去注册";
    } else {
      switchLink.href = "login";
      switchLink.textContent = "已有账号？去登录";
    }
    panel.append(switchLink);
  }

  return panel;
}

function enhanceDocumentPanel(document, host) {
  const panel = document.createElement("div");
  panel.className = "hb-doc-panel";

  const title = document.createElement("h2");
  title.className = "hb-doc-title";
  const heading =
    host.querySelector("b, h1, h2, title")?.textContent?.trim() ||
    document.title?.trim() ||
    "Hacker News";
  title.textContent = heading;
  panel.append(title);

  const body = document.createElement("div");
  body.className = "hb-doc-body";

  const sourceRoot =
    host.querySelector("td[bgcolor], td, .body, article") || host;
  const clone = sourceRoot.cloneNode(true);
  clone.querySelectorAll("img, script, style").forEach((node) => node.remove());
  const firstBold = clone.querySelector("b, h1, h2");
  if (firstBold && firstBold.textContent.trim() === heading) {
    firstBold.remove();
  }
  body.append(clone);
  panel.append(body);
  return panel;
}

function wrapOrphanContent(document, orphanNodes) {
  const host = document.createElement("div");
  orphanNodes.forEach((node) => host.append(node));
  const kind = detectOrphanPageKind(document, host);
  if (kind === "auth") {
    const needLogin = /logged in to submit|have to be logged in/i.test(host.textContent || "");
    const mode = getAuthMode(document);
    setBreadcrumbCurrent(
      document,
      needLogin ? "登录发帖" : mode === "register" ? "注册" : "登录",
    );
    return enhanceAuthPanel(document, host);
  }

  const path = document.defaultView?.location?.pathname || "";
  if (/guidelines/i.test(path)) {
    setBreadcrumbCurrent(document, "吧规");
  } else if (/security|showhn|newsfaq/i.test(path)) {
    setBreadcrumbCurrent(document, "说明");
  } else if (/forgot/i.test(path)) {
    setBreadcrumbCurrent(document, "找回密码");
  } else {
    setBreadcrumbCurrent(document, "页面");
  }
  return enhanceDocumentPanel(document, host);
}

function buildCommunityShell(document) {
  if (document.querySelector(".hb-wrap")) {
    return;
  }

  const existingMain = document.querySelector("#hnmain");
  const orphanNodes = [];
  if (!existingMain) {
    for (const child of [...document.body.childNodes]) {
      if (child.nodeType === 1 && child.tagName === "SCRIPT") {
        continue;
      }
      orphanNodes.push(child);
    }
  }

  const logoUrl = escapeAttr(getHnLogoUrl());
  const wrap = document.createElement("div");
  wrap.className = "hb-wrap";
  wrap.innerHTML = `
    <div class="hb-topbar">
      <div class="hb-topbar-inner">
        <a class="hb-brand" href="news" title="HackerBa">
          <span class="hb-brand-logo" aria-hidden="true">吧</span>
          <span class="hb-brand-text"><i>Hacker</i>贴吧</span>
        </a>
        <form class="hb-search" data-hb-search="local" action="#" method="get">
          <input name="q" type="search" placeholder="搜索 Hacker News" aria-label="搜索 Hacker News">
          <button type="submit" class="hb-search-btn">搜索</button>
        </form>
        <div class="hb-userbar">
          <a href="login">登录</a>
          <span class="hb-user-sep">|</span>
          <a href="login?mode=register">注册</a>
        </div>
      </div>
    </div>
    <div class="hb-breadcrumb">
      <a href="news">HackerBa</a>
      <span class="hb-bc-sep">&gt;</span>
      <span class="hb-bc-current">Hacker News 吧</span>
    </div>
    <div class="hb-card-banner">
      <div class="hb-card-head">
        <div class="hb-card-avatar" aria-hidden="true">
          <img class="hb-forum-logo" src="${logoUrl}" alt="Hacker News">
        </div>
        <div class="hb-card-info">
          <div class="hb-card-title-row">
            <h1 class="hb-card-title">Hacker News 吧</h1>
            <span class="hb-card-level" title="吧等级">Lv.12</span>
          </div>
          <div class="hb-card-num">
            <span><em>关注：</em><b>1,234,567</b></span>
            <span><em>帖子：</em><b>98,765</b></span>
          </div>
          <p class="hb-card-slogan">专注分享、讨论科技与创业的社区</p>
        </div>
        <div class="hb-card-btns">
          <button type="button" class="hb-btn-attention hb-btn-followed" aria-pressed="true">已关注</button>
          <a class="hb-btn-sign" href="login">签到</a>
        </div>
      </div>
    </div>
    <div class="hb-content clearfix">
      <div class="hb-main">
        <div class="hb-tab-bar">
          <ul class="hb-tab-nav">
            <li><a href="news" data-hb-tab="posts">看帖</a></li>
            <li><a href="best" data-hb-tab="good">精品</a></li>
          </ul>
          <a class="hb-tab-post" href="submit">发帖</a>
        </div>
        <div class="hb-thread-panel"></div>
      </div>
      <aside class="hb-aside">
        <div class="hb-aside-box">
          <div class="hb-aside-title">本吧信息</div>
          <div class="hb-aside-body">
            <div class="hb-aside-forum">
              <div class="hb-aside-avatar">
                <img class="hb-forum-logo" src="${logoUrl}" alt="Hacker News">
              </div>
              <div>
                <div class="hb-aside-name">Hacker News 吧</div>
                <div class="hb-aside-meta">目录：科技 / 创业</div>
              </div>
            </div>
            <p>吧主：Y Combinator</p>
            <p>创建：2007 年</p>
            <a class="hb-aside-link" href="newsguidelines.html">查看吧规 &gt;</a>
          </div>
        </div>
        <div class="hb-aside-box">
          <div class="hb-aside-title">吧内导航</div>
          <div class="hb-aside-body hb-aside-links">
            <a href="submit">发表新帖</a>
            <a href="ask">问答</a>
            <a href="show">作品</a>
            <a href="jobs">招聘</a>
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
    <div class="hb-footer">© HackerBa · 界面仿贴吧，内容来自 Hacker News</div>
  `;

  document.body.insertBefore(wrap, document.body.firstChild);

  const source = document.createElement("div");
  source.className = "hb-hn-source hb-source-hidden";
  source.hidden = true;

  if (existingMain) {
    source.append(existingMain);
    existingMain.querySelector(".pagetop")?.closest("tr")?.classList.add("hb-original-header");
  } else {
    const panel = wrapOrphanContent(document, orphanNodes);
    source.append(panel);
    source.hidden = false;
    source.classList.remove("hb-source-hidden");
    source.classList.add("hb-source-visible");
  }

  wrap.querySelector(".hb-thread-panel").append(source);
}

function getCurrentPathKey(document) {
  const path = document.defaultView?.location?.pathname?.replace(/^\//, "") || "news";
  if (!path || path === "") {
    return "news";
  }
  return path.split("/")[0];
}

function highlightActiveTab(document) {
  const tabs = document.querySelectorAll(".hb-tab-nav a");
  if (tabs.length === 0) {
    return;
  }

  const current = getCurrentPathKey(document);
  const activeTab = current === "best" ? "good" : "posts";

  tabs.forEach((tab) => {
    tab.classList.toggle("hb-tab-focus", tab.dataset.hbTab === activeTab);
  });
}

function highlightActiveSort(document) {
  const sorts = document.querySelectorAll(".hb-thread-sort a");
  if (sorts.length === 0) {
    return;
  }

  const current = getCurrentPathKey(document);
  const sortKey =
    current === "newest" ? "newest" : current === "best" ? "best" : current === "front" ? "news" : "news";

  sorts.forEach((sort) => {
    const key = (sort.getAttribute("href") || "").replace(/^\//, "");
    sort.classList.toggle("hb-sort-focus", key === sortKey);
  });
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

  const hideSource = Boolean(document.querySelector(".hb-thread-list"));
  source.hidden = hideSource;
  source.classList.toggle("hb-source-hidden", hideSource);
  source.classList.toggle("hb-source-visible", !hideSource);
}

function formatRelativeTime(createdAtUnix) {
  if (!createdAtUnix) {
    return "刚刚";
  }
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(createdAtUnix));
  if (seconds < 60) {
    return "刚刚";
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} minutes ago`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} hours ago`;
  }
  return `${Math.floor(seconds / 86400)} days ago`;
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function mapAlgoliaHits(hits = []) {
  return hits.map((hit) => {
    const externalHref = hit.url || "";
    const site = hostnameFromUrl(externalHref);
    return {
      title: hit.title || hit.story_title || "(无标题)",
      author: hit.author || "匿名",
      authorHref: hit.author ? `user?id=${encodeURIComponent(hit.author)}` : "login",
      age: formatRelativeTime(hit.created_at_i),
      score: Number(hit.points || 0),
      replyNum: String(hit.num_comments || 0),
      itemHref: `item?id=${encodeURIComponent(hit.objectID || hit.story_id || "")}`,
      externalHref,
      site,
    };
  });
}

function createThreadItem(document, thread) {
  const badges = [];
  if (thread.score >= 100) {
    badges.push('<span class="hb-icon-hot" title="热门">热</span>');
  }
  if (Number(thread.replyNum) >= 50) {
    badges.push('<span class="hb-icon-good" title="高讨论">精</span>');
  }

  const siteHtml =
    thread.site && /^https?:/i.test(thread.externalHref || "")
      ? `<a class="hb-th-site" href="${escapeAttr(thread.externalHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(thread.site)}</a>`
      : "";

  const item = document.createElement("li");
  item.className = "hb-thread-item";
  item.innerHTML = `
    <div class="hb-thread-left">
      <span class="hb-rep-num" title="回复">${escapeHtml(thread.replyNum)}</span>
    </div>
    <div class="hb-thread-center">
      <div class="hb-thread-title">
        ${badges.join("")}
        <a class="hb-th-tit" href="${escapeAttr(thread.itemHref)}">${escapeHtml(thread.title)}</a>
        ${siteHtml}
      </div>
      <div class="hb-thread-detail">
        <span class="hb-detail-label">作者：</span>
        <a class="hb-author" href="${escapeAttr(thread.authorHref)}">${escapeHtml(thread.author)}</a>
        <span class="hb-sep">|</span>
        <span class="hb-create-time">${escapeHtml(thread.age || "刚刚")}</span>
      </div>
    </div>
    <div class="hb-thread-right">
      <span class="hb-last-time" title="最后回复">${escapeHtml(thread.age || "刚刚")}</span>
    </div>
  `;
  return item;
}

function renderThreadPanel(document, { threads, countLabel, showSort = true, pagerHref = "" }) {
  const panel = document.querySelector(".hb-thread-panel");
  if (!panel) {
    return;
  }

  panel.querySelectorAll(".hb-thread-top, .hb-thread-list, .hb-pager, .hb-search-empty").forEach((node) => {
    node.remove();
  });

  const top = document.createElement("div");
  top.className = "hb-thread-top";
  top.innerHTML = showSort
    ? `
      <div class="hb-thread-sort">
        <a href="news">最新回复</a>
        <a href="newest">最新发帖</a>
        <a href="best">热门</a>
      </div>
      <div class="hb-thread-top-right">
        <span class="hb-thread-count">${escapeHtml(countLabel)}</span>
      </div>
    `
    : `
      <div class="hb-thread-sort">
        <span class="hb-sort-focus">搜索结果</span>
      </div>
      <div class="hb-thread-top-right">
        <span class="hb-thread-count">${escapeHtml(countLabel)}</span>
      </div>
    `;

  const list = document.createElement("ul");
  list.className = "hb-thread-list";
  threads.forEach((thread) => list.append(createThreadItem(document, thread)));

  const nodes = [top, list];
  if (threads.length === 0) {
    const empty = document.createElement("div");
    empty.className = "hb-search-empty";
    empty.textContent = "没有找到相关主题";
    nodes.push(empty);
  }
  if (pagerHref) {
    const pager = document.createElement("div");
    pager.className = "hb-pager";
    pager.innerHTML = `
      <span class="hb-pager-info">分页</span>
      <a class="hb-pager-next" href="${escapeAttr(pagerHref)}">下一页 &gt;</a>
    `;
    nodes.push(pager);
  }

  panel.append(...nodes);
  highlightActiveSort(document);
  revealSourceIfNeeded(document);
}

function storiesToThreads(document) {
  const stories = [...document.querySelectorAll(".athing:not(.comtr)")];
  const threads = [];

  for (const story of stories) {
    const metaRow = story.nextElementSibling;
    const titleLink = story.querySelector(".titleline > a");
    if (!titleLink || !metaRow) {
      continue;
    }

    const author = metaRow.querySelector(".hnuser")?.textContent?.trim() || "匿名";
    const authorHref = metaRow.querySelector(".hnuser")?.getAttribute("href") || "login";
    const age = metaRow.querySelector(".age")?.textContent?.trim() || "";
    const scoreText = metaRow.querySelector(".score")?.textContent?.trim() || "";
    const score = Number((scoreText.match(/(\d+)/) || [])[1] || 0);
    const commentsLink = [...metaRow.querySelectorAll("a")].find((link) =>
      /comment|discuss|讨论/i.test(link.textContent),
    );
    const replyText = commentsLink?.textContent?.replace(/\u00a0/g, " ").trim() || "0";
    const replyMatch = replyText.match(/(\d+)/);
    const replyNum = replyMatch ? replyMatch[1] : "0";
    const itemHref = commentsLink?.getAttribute("href") || titleLink.getAttribute("href") || "#";
    const externalHref = titleLink.getAttribute("href") || "";
    const site = story.querySelector(".sitestr")?.textContent?.trim();

    threads.push({
      title: titleLink.textContent.trim(),
      author,
      authorHref,
      age,
      score,
      replyNum,
      itemHref,
      externalHref,
      site,
    });
  }

  return threads;
}

function rebuildThreadList(document) {
  if (document.querySelector(".hb-thread-list") || !isForumListPage(document)) {
    return;
  }

  const threads = storiesToThreads(document);
  if (threads.length === 0) {
    return;
  }

  const moreLink = document.querySelector(".morelink");
  renderThreadPanel(document, {
    threads,
    countLabel: `共 ${threads.length} 篇主题`,
    showSort: true,
    pagerHref: moreLink?.getAttribute("href") || "",
  });
}

async function searchHackerNews(query) {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`search failed: ${response.status}`);
  }
  const data = await response.json();
  return {
    threads: mapAlgoliaHits(data.hits || []),
    total: Number(data.nbHits || 0),
  };
}

function updateSearchBreadcrumb(document, query) {
  const current = document.querySelector(".hb-bc-current");
  if (!current) {
    return;
  }
  current.textContent = query ? `搜索：${query}` : "Hacker News 吧";
}

async function runLocalSearch(document, query) {
  const panel = document.querySelector(".hb-thread-panel");
  if (!panel) {
    return;
  }

  updateSearchBreadcrumb(document, query);
  renderThreadPanel(document, {
    threads: [],
    countLabel: "搜索中…",
    showSort: false,
  });

  try {
    const { threads, total } = await searchHackerNews(query);
    renderThreadPanel(document, {
      threads,
      countLabel: `搜索到 ${total} 篇主题`,
      showSort: false,
    });
  } catch {
    renderThreadPanel(document, {
      threads: [],
      countLabel: "搜索失败，请稍后重试",
      showSort: false,
    });
  }
}

function bindSearchForm(document) {
  const form = document.querySelector(".hb-search");
  if (!form || form.dataset.hbBound === "1") {
    return;
  }

  form.dataset.hbBound = "1";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = form.querySelector("input[name='q']")?.value?.trim() || "";
    if (!query) {
      return;
    }
    runLocalSearch(document, query);
  });
}

function enhanceComments(document) {
  const firstUser = document.querySelector(".fatitem .hnuser")?.textContent?.trim();

  document.querySelectorAll(".comtr").forEach((comment, index) => {
    comment.classList.add("hb-floor");
    comment.dataset.hbFloor = String(index + 1);

    const user = comment.querySelector(".hnuser")?.textContent?.trim() || "?";
    if (firstUser && user === firstUser) {
      comment.classList.add("hb-floor-lz");
    }

    if (!comment.querySelector(".hb-floor-avatar")) {
      const avatar = document.createElement("div");
      avatar.className = "hb-floor-avatar";
      avatar.textContent = user.slice(0, 1).toUpperCase();
      comment.prepend(avatar);
    }

    if (!comment.querySelector(".hb-floor-badge") && comment.classList.contains("hb-floor-lz")) {
      const badge = document.createElement("span");
      badge.className = "hb-floor-badge";
      badge.textContent = "楼主";
      comment.querySelector(".comhead")?.append(badge);
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
  mapAlgoliaHits,
  searchHackerNews,
  runLocalSearch,
};

if (typeof document !== "undefined") {
  enhanceHackerNews(document);
}
