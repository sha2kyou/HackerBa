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

function resolveSessionUser(document) {
  const logout = document.querySelector('.pagetop a[href^="logout"]');
  if (!logout) {
    return null;
  }
  const top = logout.closest(".pagetop") || document;
  const userLink = top.querySelector('a[href^="user?id="]');
  if (!userLink) {
    return null;
  }
  return {
    name: userLink.textContent.trim() || "用户",
    href: userLink.getAttribute("href") || "login",
    logoutHref: logout.getAttribute("href") || "logout",
  };
}

function renderUserbar(document, session) {
  const bar = document.querySelector(".hb-userbar");
  if (!bar) {
    return;
  }
  if (!session) {
    bar.innerHTML = `
      <a href="login">登录</a>
      <span class="hb-user-sep">|</span>
      <a href="login?mode=register">注册</a>
    `;
    return;
  }
  bar.innerHTML = `
    <a class="hb-user-name" href="${escapeAttr(session.href)}">${escapeHtml(session.name)}</a>
    <span class="hb-user-sep">|</span>
    <a href="${escapeAttr(session.logoutHref)}">退出</a>
  `;
}

function buildCommunityShell(document) {
  if (document.querySelector(".hb-wrap")) {
    return;
  }

  const session = resolveSessionUser(document);
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

  const wrap = document.createElement("div");
  wrap.className = "hb-wrap";
  wrap.innerHTML = `
    <div class="hb-topbar">
      <div class="hb-topbar-inner">
        <a class="hb-brand" href="news" title="HackerBa">
          <span class="hb-brand-text"><i>Hacker</i>贴吧</span>
        </a>
        <form class="hb-search" data-hb-search="local" action="#" method="get">
          <input name="q" type="search" placeholder="搜索 Hacker News" aria-label="搜索 Hacker News">
          <button type="submit" class="hb-search-btn">搜索</button>
        </form>
        <div class="hb-userbar"></div>
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
          <span class="hb-forum-mark">Y</span>
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
        </div>
      </div>
    </div>
    <div class="hb-content clearfix">
      <div class="hb-main">
        <div class="hb-tab-bar">
          <ul class="hb-tab-nav">
            <li><a href="news" data-hb-tab="posts">看帖</a></li>
            <li><a href="ask" data-hb-tab="ask">问答</a></li>
            <li><a href="show" data-hb-tab="show">作品</a></li>
            <li><a href="jobs" data-hb-tab="jobs">招聘</a></li>
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
              <div class="hb-aside-avatar" aria-hidden="true">
                <span class="hb-forum-mark">Y</span>
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
          <div class="hb-aside-title">温馨提示</div>
          <div class="hb-aside-body">
            <p>分区在上方 Tab 切换；看帖下可用「最新回复 / 最新发帖」排序。</p>
          </div>
        </div>
      </aside>
    </div>
    <div class="hb-footer">© HackerBa · 界面仿贴吧，内容来自 Hacker News</div>
  `;

  document.body.insertBefore(wrap, document.body.firstChild);
  renderUserbar(document, session);

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
  const tabMap = {
    news: "posts",
    newest: "posts",
    front: "posts",
    ask: "ask",
    show: "show",
    jobs: "jobs",
    best: "good",
  };
  const activeTab = tabMap[current] || "posts";

  tabs.forEach((tab) => {
    tab.classList.toggle("hb-tab-focus", tab.dataset.hbTab === activeTab);
  });
}

function shouldShowSortBar(document) {
  const key = getCurrentPathKey(document);
  return key === "news" || key === "newest" || key === "front" || key === "";
}

function getSectionLabel(document) {
  const key = getCurrentPathKey(document);
  const labels = {
    ask: "问答",
    show: "作品",
    jobs: "招聘",
    best: "精品",
  };
  return labels[key] || "看帖";
}

function highlightActiveSort(document) {
  const sorts = document.querySelectorAll(".hb-thread-sort a");
  if (sorts.length === 0) {
    return;
  }

  const current = getCurrentPathKey(document);
  const sortKey = current === "newest" ? "newest" : "news";

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

  const hideSource = Boolean(
    document.querySelector(".hb-thread-list") || document.querySelector(".hb-post-wrap"),
  );
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

  const absParts = [];
  if (thread.site) {
    absParts.push(thread.site);
  }
  if (thread.score) {
    absParts.push(`${thread.score} 分`);
  }

  const absHtml = absParts.length
    ? absParts
        .map((part, index) => {
          if (index === 0 && thread.site && /^https?:/i.test(thread.externalHref || "")) {
            return `<a class="hb-th-site" href="${escapeAttr(thread.externalHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(part)}</a>`;
          }
          return escapeHtml(part);
        })
        .join(" · ")
    : "";

  const item = document.createElement("li");
  item.className = "hb-thread-item";
  item.innerHTML = `
    <div class="hb-thread-left">
      <span class="hb-rep-num" title="回复">${escapeHtml(thread.replyNum)}</span>
    </div>
    <div class="hb-thread-body">
      <div class="hb-thread-lz">
        <div class="hb-thread-title">
          ${badges.join("")}
          <a class="hb-th-tit" href="${escapeAttr(thread.itemHref)}">${escapeHtml(thread.title)}</a>
        </div>
        <div class="hb-thread-author-meta">
          <a class="hb-author" href="${escapeAttr(thread.authorHref)}" title="主题作者">${escapeHtml(thread.author)}</a>
          <span class="hb-create-time" title="创建时间">${escapeHtml(thread.age || "")}</span>
        </div>
      </div>
      <div class="hb-thread-detail-row">
        <div class="hb-thread-abs">${absHtml}</div>
      </div>
    </div>
  `;
  return item;
}

function resolveListPager(document) {
  const nextHref = document.querySelector(".morelink")?.getAttribute("href") || "";
  const loc = document.defaultView?.location;
  let page = 1;
  let prevHref = "";
  let showPageNum = false;

  try {
    const url = new URL(loc?.href || "https://news.ycombinator.com/news");
    const rawPage = url.searchParams.get("p");
    if (rawPage) {
      page = Math.max(1, Number(rawPage) || 1);
      showPageNum = true;
      if (page > 1) {
        const prev = new URL(url.href);
        if (page <= 2) {
          prev.searchParams.delete("p");
        } else {
          prev.searchParams.set("p", String(page - 1));
        }
        const path = prev.pathname.replace(/^\//, "") || "news";
        prevHref = `${path}${prev.search}`;
      }
    } else if (!url.searchParams.has("next")) {
      showPageNum = Boolean(nextHref);
      page = 1;
    }
  } catch {
    showPageNum = Boolean(nextHref);
  }

  return { page, prevHref, nextHref, showPageNum };
}

function createPager(document, { page = 1, prevHref = "", nextHref = "", showPageNum = false } = {}) {
  if (!prevHref && !nextHref) {
    return null;
  }

  const pager = document.createElement("div");
  pager.className = "hb-pager";

  // cursor 分页（如 newest?next=）没有可靠上一页，只展示下一页
  const cursorOnly = Boolean(nextHref && !prevHref && !showPageNum);
  if (cursorOnly) {
    const next = document.createElement("a");
    next.className = "hb-pager-link hb-pager-next";
    next.setAttribute("href", nextHref);
    next.textContent = "下一页 >";
    pager.append(next);
    return pager;
  }

  if (prevHref) {
    const prev = document.createElement("a");
    prev.className = "hb-pager-link hb-pager-prev";
    prev.setAttribute("href", prevHref);
    prev.textContent = "< 上一页";
    pager.append(prev);
  } else {
    const disabled = document.createElement("span");
    disabled.className = "hb-pager-disabled";
    disabled.textContent = "< 上一页";
    pager.append(disabled);
  }

  if (showPageNum) {
    const info = document.createElement("span");
    info.className = "hb-pager-info";
    info.textContent = `第 ${page} 页`;
    pager.append(info);
  }

  if (nextHref) {
    const next = document.createElement("a");
    next.className = "hb-pager-link hb-pager-next";
    next.setAttribute("href", nextHref);
    next.textContent = "下一页 >";
    pager.append(next);
  } else {
    const disabled = document.createElement("span");
    disabled.className = "hb-pager-disabled";
    disabled.textContent = "下一页 >";
    pager.append(disabled);
  }

  return pager;
}

function renderThreadPanel(document, { threads, countLabel, showSort = true, sectionLabel = "", pager = null }) {
  const panel = document.querySelector(".hb-thread-panel");
  if (!panel) {
    return;
  }

  panel
    .querySelectorAll(".hb-thread-top, .hb-thread-list, .hb-pager, .hb-search-empty, .hb-post-wrap")
    .forEach((node) => {
      node.remove();
    });
  document.body.classList.remove("hb-item-page");

  const top = document.createElement("div");
  top.className = "hb-thread-top";
  top.innerHTML = showSort
    ? `
      <div class="hb-thread-sort">
        <a href="news">最新回复</a>
        <a href="newest">最新发帖</a>
      </div>
      <div class="hb-thread-top-right">
        <span class="hb-thread-count">${escapeHtml(countLabel)}</span>
      </div>
    `
    : `
      <div class="hb-thread-sort">
        <span class="hb-sort-focus">${escapeHtml(sectionLabel || "列表")}</span>
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
  if (pager) {
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

  const pagerState = resolveListPager(document);
  const showSort = shouldShowSortBar(document);
  const pageHint = pagerState.showPageNum ? ` · 第 ${pagerState.page} 页` : "";
  renderThreadPanel(document, {
    threads,
    countLabel: `本页 ${threads.length} 篇主题${pageHint}`,
    showSort,
    sectionLabel: getSectionLabel(document),
    pager: createPager(document, pagerState),
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

let hbSearchSeq = 0;

async function runLocalSearch(document, query) {
  const panel = document.querySelector(".hb-thread-panel");
  if (!panel) {
    return;
  }

  const seq = ++hbSearchSeq;
  updateSearchBreadcrumb(document, query);
  renderThreadPanel(document, {
    threads: [],
    countLabel: "搜索中…",
    showSort: false,
    sectionLabel: "搜索结果",
  });

  try {
    const { threads, total } = await searchHackerNews(query);
    if (seq !== hbSearchSeq) {
      return;
    }
    renderThreadPanel(document, {
      threads,
      countLabel: `搜索到 ${total} 篇主题`,
      showSort: false,
      sectionLabel: "搜索结果",
    });
  } catch {
    if (seq !== hbSearchSeq) {
      return;
    }
    renderThreadPanel(document, {
      threads: [],
      countLabel: "搜索失败，请稍后重试",
      showSort: false,
      sectionLabel: "搜索结果",
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

function avatarLetter(name) {
  const text = String(name || "?").trim();
  return (text.slice(0, 1) || "?").toUpperCase();
}

function userLevel(name) {
  const text = String(name || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 997;
  }
  return (hash % 12) + 1;
}

function createAuthorColumn(document, { user, userHref, isLz = false }) {
  const author = document.createElement("div");
  author.className = "hb-floor-author";

  if (isLz) {
    const badge = document.createElement("div");
    badge.className = "hb-louzhu";
    badge.title = "楼主";
    badge.innerHTML = "<span>楼主</span>";
    author.append(badge);
  }

  const face = document.createElement("a");
  face.className = "hb-floor-face";
  face.setAttribute("href", userHref);
  face.setAttribute("title", user);

  const avatar = document.createElement("div");
  avatar.className = "hb-floor-avatar";
  avatar.textContent = avatarLetter(user);
  face.append(avatar);
  author.append(face);

  const name = document.createElement("a");
  name.className = "hb-floor-name";
  name.setAttribute("href", userHref);
  name.textContent = user;
  author.append(name);

  const level = document.createElement("div");
  level.className = "hb-floor-level";
  level.innerHTML = `<span>等级</span><em>${userLevel(user)}</em>`;
  author.append(level);

  return author;
}

function createCoreTitle(document, { title, replyCount }) {
  const bar = document.createElement("div");
  bar.className = "hb-core-title";
  bar.innerHTML = `
    <div class="hb-core-title-wrap">
      <h1 class="hb-core-title-txt" title="${escapeAttr(title)}">${escapeHtml(title)}</h1>
      <div class="hb-core-title-btns">
        <span class="hb-core-meta">回复贴：${escapeHtml(String(replyCount))}</span>
        <a class="hb-core-quick-reply" href="#hb-reply">回复</a>
      </div>
    </div>
  `;
  return bar;
}

function createReplyPanel(document, form) {
  const panel = document.createElement("div");
  panel.className = "hb-reply-panel";
  panel.id = "hb-reply";

  const title = document.createElement("div");
  title.className = "hb-reply-panel-title";
  title.textContent = "发表回复";
  panel.append(title);

  form.querySelectorAll('input[type="submit"]').forEach((button) => {
    if (/add comment/i.test(button.value || "")) {
      button.value = "发表";
    }
  });
  const help = form.querySelector('a[href*="formatdoc"]');
  if (help) {
    help.textContent = "编辑帮助";
  }

  const box = document.createElement("div");
  box.className = "hb-reply-box";
  box.append(form);
  panel.append(box);
  return panel;
}

function buildMainFloor(document, fatitem, replyCount) {
  const titleLink = fatitem.querySelector(".titleline > a");
  const title = titleLink?.textContent?.trim() || "无标题";
  const titleHref = titleLink?.getAttribute("href") || "#";
  const site = fatitem.querySelector(".sitestr")?.textContent?.trim() || "";
  const user = fatitem.querySelector(".hnuser")?.textContent?.trim() || "匿名";
  const userHref = fatitem.querySelector(".hnuser")?.getAttribute("href") || "login";
  const age = fatitem.querySelector(".age")?.textContent?.trim() || "";
  const score = fatitem.querySelector(".score")?.textContent?.trim() || "";
  const form = fatitem.querySelector("form");
  const toptext = fatitem.querySelector(".toptext");

  if (title) {
    setBreadcrumbCurrent(document, title.length > 28 ? `${title.slice(0, 28)}…` : title);
  }

  const coreTitle = createCoreTitle(document, { title, replyCount });

  const card = document.createElement("div");
  card.className = "hb-floor hb-floor-lz hb-main-floor";
  card.dataset.hbFloor = "1";
  card.append(createAuthorColumn(document, { user, userHref, isLz: true }));

  const main = document.createElement("div");
  main.className = "hb-floor-main";

  const top = document.createElement("div");
  top.className = "hb-floor-top";
  top.innerHTML = `<span class="hb-floor-no">1楼</span>`;
  main.append(top);

  const content = document.createElement("div");
  content.className = "hb-floor-content";
  if (toptext && toptext.textContent.trim()) {
    content.append(...[...toptext.childNodes]);
  } else if (/^https?:/i.test(titleHref)) {
    const share = document.createElement("div");
    share.className = "hb-share-link";
    share.innerHTML = `
      <div class="hb-share-label">分享链接：</div>
      <a class="hb-main-link" href="${escapeAttr(titleHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>
      ${site ? `<div class="hb-main-site-line">${escapeHtml(site)}</div>` : ""}
    `;
    content.append(share);
  } else {
    content.textContent = title;
  }
  main.append(content);

  const meta = document.createElement("div");
  meta.className = "hb-floor-tail";
  const left = document.createElement("div");
  left.className = "hb-floor-tail-left";
  if (score) {
    const scoreEl = document.createElement("span");
    scoreEl.className = "hb-floor-score";
    scoreEl.textContent = score;
    left.append(scoreEl);
  }
  const ageEl = document.createElement("span");
  ageEl.className = "hb-floor-age";
  ageEl.textContent = age || "";
  left.append(ageEl);
  meta.append(left);

  const replyA = document.createElement("a");
  replyA.className = "hb-floor-reply";
  replyA.href = "#hb-reply";
  replyA.textContent = "回复";
  meta.append(replyA);

  main.append(meta);
  card.append(main);

  return { form, coreTitle, card, user };
}

function createFloorCard(document, comment, floor, firstUser) {
  const user = comment.querySelector(".hnuser")?.textContent?.trim() || "?";
  const userHref = comment.querySelector(".hnuser")?.getAttribute("href") || "login";
  const age =
    comment.querySelector(".age")?.textContent?.trim() ||
    (comment.querySelector(".comhead")?.textContent || "").replace(user, "").replace(/\s+/g, " ").trim();
  const isLz = Boolean(firstUser && user === firstUser);
  const commentNode = comment.querySelector(".comment");
  const reply = commentNode?.querySelector(".reply");

  const card = document.createElement("div");
  card.className = isLz ? "hb-floor hb-floor-lz" : "hb-floor";
  card.dataset.hbFloor = String(floor);

  card.append(createAuthorColumn(document, { user, userHref, isLz }));

  const main = document.createElement("div");
  main.className = "hb-floor-main";

  const top = document.createElement("div");
  top.className = "hb-floor-top";

  const floorNo = document.createElement("span");
  floorNo.className = "hb-floor-no";
  floorNo.textContent = `${floor}楼`;
  top.append(floorNo);

  const toggle = document.createElement("button");
  toggle.className = "hb-floor-toggle";
  toggle.type = "button";
  toggle.textContent = "收起";
  toggle.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-label", "收起该楼层");
  toggle.addEventListener("click", () => {
    const collapsed = card.classList.toggle("hb-floor-collapsed");
    toggle.textContent = collapsed ? "展开" : "收起";
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", `${collapsed ? "展开" : "收起"}该楼层`);
  });
  top.append(toggle);
  main.append(top);

  const content = document.createElement("div");
  content.className = "hb-floor-content";
  if (commentNode) {
    const nodes = [...commentNode.childNodes].filter((node) => {
      return !(node.nodeType === 1 && node.classList?.contains("reply"));
    });
    content.append(...nodes);
  }
  main.append(content);

  const tail = document.createElement("div");
  tail.className = "hb-floor-tail";
  const left = document.createElement("div");
  left.className = "hb-floor-tail-left";
  const ageEl = document.createElement("span");
  ageEl.className = "hb-floor-age";
  ageEl.textContent = age;
  left.append(ageEl);
  tail.append(left);
  if (reply) {
    const replyLink = reply.querySelector("a");
    if (replyLink) {
      const a = document.createElement("a");
      a.className = "hb-floor-reply";
      a.setAttribute("href", replyLink.getAttribute("href") || "#");
      a.textContent = "回复";
      tail.append(a);
    }
  }
  main.append(tail);

  card.append(main);
  return { card, user };
}

function ensureLzlContainer(document, floorCard) {
  let lzl = floorCard.querySelector(".hb-lzl");
  if (lzl) {
    return lzl;
  }

  const main = floorCard.querySelector(".hb-floor-main");
  lzl = document.createElement("div");
  lzl.className = "hb-lzl";
  lzl.innerHTML = `
    <div class="hb-lzl-hd">共<em class="hb-lzl-num">0</em>条回复</div>
    <ul class="hb-lzl-list"></ul>
  `;
  main?.append(lzl);
  return lzl;
}

function syncLzlCount(lzl) {
  const num = lzl.querySelector(".hb-lzl-num");
  const count = lzl.querySelectorAll(".hb-lzl-item").length;
  if (num) {
    num.textContent = String(count);
  }
}

function createLzlItem(document, comment, { firstUser, replyTo = "" }) {
  const user = comment.querySelector(".hnuser")?.textContent?.trim() || "?";
  const userHref = comment.querySelector(".hnuser")?.getAttribute("href") || "login";
  const age =
    comment.querySelector(".age")?.textContent?.trim() ||
    (comment.querySelector(".comhead")?.textContent || "").replace(user, "").replace(/\s+/g, " ").trim();
  const isLz = Boolean(firstUser && user === firstUser);
  const commentNode = comment.querySelector(".comment");
  const reply = commentNode?.querySelector(".reply");

  const item = document.createElement("li");
  item.className = isLz ? "hb-lzl-item hb-lzl-lz" : "hb-lzl-item";

  const name = document.createElement("a");
  name.className = "hb-lzl-name";
  name.href = userHref;
  name.textContent = user;
  item.append(name);

  if (isLz) {
    const badge = document.createElement("span");
    badge.className = "hb-lzl-lz-tag";
    badge.textContent = "楼主";
    item.append(badge);
  }

  item.append(document.createTextNode("："));

  if (replyTo) {
    const to = document.createElement("span");
    to.className = "hb-lzl-to";
    to.textContent = `回复 ${replyTo} : `;
    item.append(to);
  }

  const text = document.createElement("span");
  text.className = "hb-lzl-text";
  if (commentNode) {
    const nodes = [...commentNode.childNodes].filter((node) => {
      return !(node.nodeType === 1 && node.classList?.contains("reply"));
    });
    text.append(...nodes);
  }
  item.append(text);

  const tail = document.createElement("div");
  tail.className = "hb-lzl-tail";
  const ageEl = document.createElement("span");
  ageEl.className = "hb-lzl-age";
  ageEl.textContent = age;
  tail.append(ageEl);
  if (reply) {
    const replyLink = reply.querySelector("a");
    if (replyLink) {
      const a = document.createElement("a");
      a.className = "hb-lzl-reply";
      a.href = replyLink.getAttribute("href") || "#";
      a.textContent = "回复";
      tail.append(a);
    }
  }
  item.append(tail);

  return { item, user };
}

function enhanceComments(document) {
  if (document.querySelector(".hb-post-wrap")) {
    return;
  }

  const fatitem = document.querySelector(".fatitem");
  const comments = [...document.querySelectorAll("tr.athing.comtr")];
  if (!fatitem && comments.length === 0) {
    return;
  }

  const panel = document.querySelector(".hb-thread-panel");
  if (!panel) {
    return;
  }

  document.body.classList.add("hb-item-page");

  const wrap = document.createElement("div");
  wrap.className = "hb-post-wrap";

  let form = null;
  let firstUser = "";
  let replyCount = comments.length;

  if (fatitem) {
    const replyMatch = [...fatitem.querySelectorAll(".subtext a")]
      .map((a) => a.textContent.replace(/\u00a0/g, " ").trim())
      .find((text) => /comment|discuss|讨论/i.test(text));
    replyCount = Number((replyMatch || "").match(/(\d+)/)?.[1] || comments.length);
    const built = buildMainFloor(document, fatitem, replyCount);
    form = built.form;
    firstUser = built.user;
    wrap.append(built.coreTitle, built.card);
  }

  if (comments.length > 0) {
    const list = document.createElement("div");
    list.className = "hb-floor-list";
    /** @type {{ indent: number, user: string, card: Element }[]} */
    const stack = [];
    let floorNo = 2;

    comments.forEach((comment) => {
      const indent = Number(comment.querySelector(".ind")?.getAttribute("indent") || 0);
      while (stack.length && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      if (indent === 0 || stack.length === 0) {
        const built = createFloorCard(document, comment, floorNo, firstUser);
        floorNo += 1;
        list.append(built.card);
        stack.length = 0;
        stack.push({ indent: 0, user: built.user, card: built.card });
        return;
      }

      const parent = stack[stack.length - 1];
      const floorCard = stack[0].card;
      const lzl = ensureLzlContainer(document, floorCard);
      const built = createLzlItem(document, comment, {
        firstUser,
        replyTo: indent > 1 ? parent.user : "",
      });
      lzl.querySelector(".hb-lzl-list")?.append(built.item);
      syncLzlCount(lzl);
      stack.push({ indent, user: built.user, card: floorCard });
    });

    wrap.append(list);
  }

  if (form) {
    wrap.append(createReplyPanel(document, form));
  }

  panel.append(wrap);
  revealSourceIfNeeded(document);
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
  resolveListPager,
  createPager,
};

if (typeof document !== "undefined") {
  enhanceHackerNews(document);
}
