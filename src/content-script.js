let hbLocale = "en";

function localeOf(document) {
  return document?.documentElement?.dataset?.hbLang || hbLocale;
}

function t(key, vars, document) {
  const i18n = globalThis.HackerBaI18n;
  if (!i18n) {
    return key;
  }
  return i18n.t(localeOf(document), key, vars);
}

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
  bindPopupLinks(document);
  bindSettingsLink(document);
  void hydrateUserLevels(document);
}

function localizeAuthLabel(text, document) {
  const value = String(text || "").trim().toLowerCase();
  if (value === "username:" || value === "username") {
    return t("username", null, document);
  }
  if (value === "password:" || value === "password") {
    return t("password", null, document);
  }
  if (value === "login") {
    return t("login", null, document);
  }
  if (value === "create account") {
    return t("createAccount", null, document);
  }
  return text;
}

function resolvePageUrl(document, pageUrl) {
  const base = document.defaultView?.location?.href || "https://news.ycombinator.com/";
  if (pageUrl instanceof URL) {
    return pageUrl;
  }
  if (typeof pageUrl === "string" && pageUrl) {
    return new URL(pageUrl, base);
  }
  return new URL(base);
}

function detectOrphanPageKind(document, host, pageUrl) {
  const path = resolvePageUrl(document, pageUrl).pathname || "";
  const hasCompose = Boolean(
    host.querySelector(
      "form input[name='title'], form input[name='url'], form textarea[name='text']",
    ),
  );
  const hasAuth = Boolean(host.querySelector("form input[name='acct']"));

  if (hasCompose && !hasAuth) {
    return "submit";
  }
  if (
    /\/(login|submit|forgot|changepw)/i.test(path) ||
    hasAuth
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

function getAuthMode(document, pageUrl) {
  const params = resolvePageUrl(document, pageUrl).searchParams;
  if (params.get("mode") === "register" || params.get("creating") === "t") {
    return "register";
  }
  return "login";
}

function enhanceAuthPanel(document, host, pageUrl) {
  const panel = document.createElement("div");
  panel.className = "hb-auth-panel";

  const rawText = host.textContent || "";
  const path = resolvePageUrl(document, pageUrl).pathname || "";
  const needLogin = /logged in to submit|have to be logged in/i.test(rawText);
  const isForgot = /forgot/i.test(path);
  const mode = isForgot ? "forgot" : getAuthMode(document, pageUrl);

  const title = document.createElement("h2");
  title.className = "hb-auth-title";
  title.textContent = needLogin
    ? t("loginRequiredTitle", null, document)
    : mode === "register"
      ? t("registerTitle", null, document)
      : mode === "forgot"
        ? t("forgotTitle", null, document)
        : t("login", null, document);
  panel.append(title);

  if (needLogin) {
    const tip = document.createElement("p");
    tip.className = "hb-auth-tip";
    tip.textContent = t("loginRequiredTip", null, document);
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
      mode === "register"
        ? t("createAccount", null, document)
        : mode === "forgot"
          ? t("resetPassword", null, document)
          : t("login", null, document);
    card.append(heading);

    form.querySelectorAll("td").forEach((cell) => {
      if (!cell.querySelector("input")) {
        cell.textContent = localizeAuthLabel(cell.textContent, document);
      }
    });

    form.querySelectorAll("input[type='submit']").forEach((button) => {
      button.value = localizeAuthLabel(button.value, document);
      button.classList.add("hb-primary-btn");
    });

    card.append(form);

    const actions = document.createElement("div");
    actions.className = "hb-form-actions";
    if (mode === "login") {
      const forgot = host.querySelector("a[href='forgot']");
      if (forgot) {
        forgot.className = "hb-auth-forgot";
        forgot.textContent = t("forgotLink", null, document);
        const left = document.createElement("div");
        left.className = "hb-form-actions-left";
        left.append(forgot);
        actions.append(left);
      }
    }
    form.querySelectorAll('input[type="submit"]').forEach((button) => {
      actions.append(button);
    });
    if (actions.childNodes.length > 0) {
      form.append(actions);
    }

    cards.append(card);
  });

  panel.append(cards);

  if (mode === "login" || mode === "register") {
    const switchLink = document.createElement("a");
    switchLink.className = "hb-auth-switch";
    if (mode === "login") {
      switchLink.href = "login?mode=register";
      switchLink.textContent = t("switchToRegister", null, document);
    } else {
      switchLink.href = "login";
      switchLink.textContent = t("switchToLogin", null, document);
    }
    panel.append(switchLink);
  }

  return panel;
}

function cleanDocumentClone(clone) {
  if (!clone) {
    return;
  }

  clone.querySelectorAll("img, script, style, .foot").forEach((node) => node.remove());
  clone.querySelectorAll("table").forEach((table) => {
    const bg = (table.getAttribute("bgcolor") || "").toLowerCase();
    if (bg === "#ff6600" || bg === "ff6600") {
      table.remove();
    }
  });
  clone.querySelectorAll('td[bgcolor], tr[bgcolor]').forEach((node) => {
    const bg = (node.getAttribute("bgcolor") || "").toLowerCase();
    if (bg === "#ff6600" || bg === "ff6600") {
      node.closest("table")?.remove() || node.remove();
    }
  });

  const isSkippableEdge = (node) => {
    if (!node) {
      return false;
    }
    if (node.nodeType === 3) {
      return !String(node.textContent || "").trim();
    }
    if (node.nodeType !== 1) {
      return true;
    }
    const tag = node.tagName;
    if (tag === "BR" || tag === "HR") {
      return true;
    }
    if ((tag === "P" || tag === "DIV" || tag === "SPAN") && !String(node.textContent || "").trim()) {
      return !node.querySelector("input, textarea, a, img, button");
    }
    return false;
  };

  while (clone.firstChild && isSkippableEdge(clone.firstChild)) {
    clone.firstChild.remove();
  }
  while (clone.lastChild && isSkippableEdge(clone.lastChild)) {
    clone.lastChild.remove();
  }

  // Collapse consecutive <br> into at most one
  const brs = [...clone.querySelectorAll("br")];
  for (const br of brs) {
    const prev = br.previousSibling;
    if (
      prev &&
      ((prev.nodeType === 1 && prev.tagName === "BR") ||
        (prev.nodeType === 3 && !String(prev.textContent || "").trim() && prev.previousSibling?.nodeType === 1 && prev.previousSibling.tagName === "BR"))
    ) {
      br.remove();
    }
  }
}

function enhanceDocumentPanel(document, host, titleHint) {
  const panel = document.createElement("div");
  panel.className = "hb-doc-panel";

  const title = document.createElement("h2");
  title.className = "hb-doc-title";
  const heading =
    host.querySelector("b, h1, h2, title")?.textContent?.trim() ||
    titleHint?.trim() ||
    document.title?.trim() ||
    "Hacker News";
  title.textContent = heading;
  panel.append(title);

  const body = document.createElement("div");
  body.className = "hb-doc-body";

  const sourceRoot = pickDocumentSourceRoot(host);
  const clone = sourceRoot.cloneNode(true);
  const firstBold = clone.querySelector("b, h1, h2");
  if (firstBold && firstBold.textContent.trim() === heading) {
    firstBold.remove();
  }
  cleanDocumentClone(clone);
  body.append(clone);
  panel.append(body);
  return panel;
}

function isHnHeaderCell(td) {
  const bg = (td?.getAttribute?.("bgcolor") || "").toLowerCase();
  return bg === "#ff6600" || bg === "ff6600";
}

function pickDocumentSourceRoot(host) {
  const soft = host.querySelector(
    'td[bgcolor="#fafaf0"], td[bgcolor="#FAFAF0"], td[bgcolor="#f6f6ef"], td[bgcolor="#F6F6EF"]',
  );
  if (soft) {
    return soft;
  }
  for (const td of host.querySelectorAll("td[bgcolor]")) {
    if (!isHnHeaderCell(td)) {
      return td;
    }
  }
  return host.querySelector(".body, article") || host;
}

function extractUserProfileRoot(host) {
  if (!host) {
    return null;
  }
  const form = host.querySelector("form");
  if (form?.querySelector("table")) {
    return form;
  }
  const tables = [...host.querySelectorAll("table")];
  const profile = tables.find((table) => {
    const text = table.textContent || "";
    return /\buser\s*:/i.test(text) && /\bkarma\s*:/i.test(text);
  });
  if (profile) {
    return profile;
  }
  for (const td of host.querySelectorAll("td")) {
    if (isHnHeaderCell(td)) {
      continue;
    }
    if (/\buser\s*:/i.test(td.textContent || "")) {
      return td;
    }
  }
  return pickDocumentSourceRoot(host);
}

function localizeProfileLabel(text, document) {
  const raw = String(text || "").trim();
  if (!raw) {
    return "";
  }
  const key = raw.replace(/:$/, "").trim().toLowerCase();
  const map = {
    user: "profileUser",
    created: "profileCreated",
    karma: "profileKarma",
    about: "profileAbout",
    email: "profileEmail",
    showdead: "profileShowdead",
    noprocrast: "profileNoprocrast",
    maxvisit: "profileMaxvisit",
    minaway: "profileMinaway",
    delay: "profileDelay",
  };
  const msgKey = map[key];
  if (!msgKey) {
    return "";
  }
  const locale = localeOf(document);
  const colon = locale === "zh" ? "：" : ":";
  return `${t(msgKey, null, document)}${colon}`;
}

function localizeProfileAge(text, document) {
  const raw = String(text || "").trim();
  if (!raw) {
    return "";
  }
  if (/^just\s+now$/i.test(raw)) {
    return t("justNow", null, document);
  }
  const match = raw.match(/^(\d+)\s+(second|minute|hour|day|month|year)s?\s+ago$/i);
  if (!match) {
    return "";
  }
  const n = Number(match[1]);
  if (n === 0) {
    return t("justNow", null, document);
  }
  const unit = match[2].toLowerCase();
  const keyMap = {
    second: "secondsAgo",
    minute: "minutesAgo",
    hour: "hoursAgo",
    day: "daysAgo",
    month: "monthsAgo",
    year: "yearsAgo",
  };
  const key = keyMap[unit];
  return key ? t(key, { n }, document) : "";
}

function localizeAgeText(text, document) {
  const raw = String(text || "").trim();
  if (!raw) {
    return "";
  }
  return localizeProfileAge(raw, document) || raw;
}

function localizeUserProfile(document, root) {
  if (!root) {
    return;
  }

  root.querySelectorAll("tr").forEach((row) => {
    const cells = [...row.querySelectorAll(":scope > td")];
    if (cells.length === 0) {
      return;
    }
    const labelCell = cells[0];
    if (!labelCell.querySelector("input, textarea, select, a, button")) {
      const localized = localizeProfileLabel(labelCell.textContent, document);
      if (localized) {
        labelCell.textContent = localized;
      }
    }
    const valueCell = cells[1];
    if (valueCell && !valueCell.querySelector("input, textarea, select, a, button")) {
      const localizedAge = localizeProfileAge(valueCell.textContent, document);
      if (localizedAge) {
        valueCell.textContent = localizedAge;
      }
    }
  });

  root.querySelectorAll("a").forEach((link) => {
    const value = String(link.textContent || "").trim().toLowerCase();
    if (value === "submissions") {
      link.textContent = t("profileSubmissions", null, document);
    } else if (value === "comments") {
      link.textContent = t("profileComments", null, document);
    } else if (value === "favorites") {
      link.textContent = t("profileFavorites", null, document);
    }
  });
}

function isProfileKarmaLabel(text) {
  const key = String(text || "")
    .trim()
    .replace(/[:：]\s*$/, "")
    .toLowerCase();
  return key === "karma" || key === "声望";
}

function attachProfileKarmaLevel(document, root) {
  if (!root) {
    return;
  }

  for (const row of root.querySelectorAll("tr")) {
    const cells = [...row.querySelectorAll(":scope > td")];
    if (cells.length < 2 || !isProfileKarmaLabel(cells[0].textContent)) {
      continue;
    }

    const valueCell = cells[1];
    if (valueCell.querySelector("input, textarea, select")) {
      continue;
    }

    const raw = String(valueCell.textContent || "").trim();
    const karma = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(karma)) {
      continue;
    }

    const level = userLevelFromKarma(karma);
    const karmaEl = document.createElement("span");
    karmaEl.className = "hb-profile-karma";
    karmaEl.textContent = raw;

    const levelEl = document.createElement("span");
    levelEl.className = "hb-profile-level";
    levelEl.textContent = `Lv.${level}`;
    levelEl.title = `${t("level", null, document)} · karma ${karma}`;

    valueCell.replaceChildren(karmaEl, document.createTextNode(" "), levelEl);
    break;
  }
}

function regroupProfileLinks(document, root) {
  if (!root) {
    return;
  }

  const linkRows = [];
  for (const row of [...root.querySelectorAll("tr")]) {
    const cells = [...row.querySelectorAll(":scope > td")];
    if (cells.length < 2) {
      continue;
    }
    const labelEmpty = !String(cells[0].textContent || "").trim();
    const links = [...cells[1].querySelectorAll(":scope > a")];
    if (!labelEmpty || links.length !== 1) {
      continue;
    }

    const link = links[0];
    const href = link.getAttribute("href") || "";
    const text = String(link.textContent || "").trim().toLowerCase();
    const isProfileNav =
      /submitted\?/i.test(href) ||
      /threads\?/i.test(href) ||
      /favorites\?/i.test(href) ||
      text === "submissions" ||
      text === "comments" ||
      text === "favorites" ||
      text === "提交" ||
      text === "评论" ||
      text === "收藏";
    if (!isProfileNav) {
      continue;
    }
    linkRows.push({ row, link });
  }

  if (linkRows.length === 0) {
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "hb-profile-links";
  for (const { row, link } of linkRows) {
    link.classList.add("hb-profile-link");
    wrap.append(link);
    row.remove();
  }

  const table = root.querySelector("table") || root.closest?.("table") || root;
  if (table?.parentNode) {
    table.after(wrap);
  } else {
    root.append(wrap);
  }
}

function enhanceUserPanel(document, host, { userId, titleHint } = {}) {
  const panel = document.createElement("div");
  panel.className = "hb-doc-panel hb-user-panel";

  const title = document.createElement("h2");
  title.className = "hb-doc-title";
  const fallbackTitle =
    titleHint?.replace(/\s*[|\u2013\u2014-].*$/, "").trim() ||
    t("crumbUser", null, document);
  title.textContent = userId || fallbackTitle;
  panel.append(title);

  const body = document.createElement("div");
  body.className = "hb-doc-body";

  const profileRoot = extractUserProfileRoot(host) || host;
  const clone = profileRoot.cloneNode(true);
  clone.querySelectorAll("img, script, style").forEach((node) => node.remove());
  clone.querySelectorAll("td[bgcolor]").forEach((td) => {
    if (isHnHeaderCell(td)) {
      td.closest("tr")?.remove();
    }
  });

  const actions = document.createElement("div");
  actions.className = "hb-form-actions";
  clone.querySelectorAll('input[type="submit"]').forEach((button) => {
    button.classList.add("hb-primary-btn");
    if (/^update$/i.test(String(button.value || "").trim())) {
      button.value = t("updateProfile", null, document);
    }
    const row = button.closest("tr");
    actions.append(button);
    row?.remove();
  });

  localizeUserProfile(document, clone);
  attachProfileKarmaLevel(document, clone);
  regroupProfileLinks(document, clone);

  body.append(clone);
  if (actions.childNodes.length > 0) {
    const form = body.querySelector("form");
    if (form) {
      form.append(actions);
    } else {
      body.append(actions);
    }
  }
  panel.append(body);
  return panel;
}

function createComposeField(document, { labelKey, control, hintKey }) {
  const field = document.createElement("div");
  field.className = "hb-compose-field";

  const controlId = `hb-compose-${control?.getAttribute?.("name") || "field"}`;
  const caption = document.createElement("label");
  caption.className = "hb-compose-label";
  caption.htmlFor = controlId;
  caption.textContent = t(labelKey, null, document);
  field.append(caption);

  if (control) {
    normalizeComposeControl(control, controlId);
    field.append(control);
  }

  if (hintKey) {
    const hint = document.createElement("p");
    hint.className = "hb-compose-hint";
    hint.textContent = t(hintKey, null, document);
    field.append(hint);
  }

  return field;
}

function normalizeComposeControl(control, controlId) {
  if (!control) {
    return;
  }
  control.id = controlId;
  control.classList.add("hb-compose-control");
  control.removeAttribute("size");
  control.removeAttribute("rows");
  control.removeAttribute("cols");
  control.removeAttribute("style");
  control.removeAttribute("width");
  if (control.tagName === "TEXTAREA") {
    control.classList.add("hb-compose-textarea");
  } else {
    control.classList.add("hb-compose-input");
    // url 原生装饰在各浏览器表现不一，统一成 text 外观
    if (String(control.getAttribute("type") || "").toLowerCase() === "url") {
      control.setAttribute("type", "text");
      control.setAttribute("inputmode", "url");
      control.setAttribute("autocomplete", "url");
    }
  }
}

function enhanceSubmitPanel(document, host) {
  const panel = document.createElement("div");
  panel.className = "hb-compose-panel";

  const title = document.createElement("h2");
  title.className = "hb-compose-title";
  title.textContent = t("composeTitle", null, document);
  panel.append(title);

  const tip = document.createElement("p");
  tip.className = "hb-compose-tip";
  tip.textContent = t("composeTip", null, document);
  panel.append(tip);

  const form = host.querySelector("form");
  if (!form) {
    return enhanceDocumentPanel(document, host, t("composeTitle", null, document));
  }

  const hiddens = [...form.querySelectorAll("input[type='hidden']")];
  const titleInput = form.querySelector("input[name='title']");
  const urlInput = form.querySelector("input[name='url']");
  const textArea = form.querySelector("textarea[name='text']");
  const submitBtn = form.querySelector("input[type='submit']");
  const help = form.querySelector('a[href*="formatdoc"]');

  const body = document.createElement("div");
  body.className = "hb-compose-body";

  if (titleInput) {
    body.append(
      createComposeField(document, {
        labelKey: "composeFieldTitle",
        control: titleInput,
      }),
    );
  }
  if (urlInput) {
    body.append(
      createComposeField(document, {
        labelKey: "composeFieldUrl",
        control: urlInput,
        hintKey: "composeUrlHint",
      }),
    );
  }
  if (urlInput && textArea) {
    const divider = document.createElement("div");
    divider.className = "hb-compose-or";
    const mark = document.createElement("span");
    mark.textContent = t("composeOr", null, document);
    divider.append(mark);
    body.append(divider);
  }
  if (textArea) {
    body.append(
      createComposeField(document, {
        labelKey: "composeFieldText",
        control: textArea,
        hintKey: "composeTextHint",
      }),
    );
  }

  while (form.firstChild) {
    form.firstChild.remove();
  }
  hiddens.forEach((node) => form.append(node));
  form.append(body);

  const actions = document.createElement("div");
  actions.className = "hb-form-actions";
  if (help) {
    help.textContent = t("editHelp", null, document);
    help.classList.add("hb-compose-help");
    const left = document.createElement("div");
    left.className = "hb-form-actions-left";
    left.append(help);
    actions.append(left);
  }
  if (submitBtn) {
    submitBtn.classList.add("hb-primary-btn");
    submitBtn.value = t("composeSubmit", null, document);
    actions.append(submitBtn);
  }
  form.append(actions);
  panel.append(form);
  return panel;
}

function wrapOrphanContent(document, orphanNodes, pageUrl, options = {}) {
  const updateBreadcrumb = options.updateBreadcrumb !== false;
  const host = document.createElement("div");
  orphanNodes.forEach((node) => host.append(node));
  const url = resolvePageUrl(document, pageUrl);
  const kind = detectOrphanPageKind(document, host, url);
  if (kind === "auth") {
    const needLogin = /logged in to submit|have to be logged in/i.test(host.textContent || "");
    const mode = getAuthMode(document, url);
    if (updateBreadcrumb) {
      setBreadcrumbCurrent(
        document,
        needLogin
          ? t("crumbPostLogin", null, document)
          : mode === "register"
            ? t("registerTitle", null, document)
            : t("login", null, document),
      );
    }
    return enhanceAuthPanel(document, host, url);
  }

  if (kind === "submit") {
    if (updateBreadcrumb) {
      setBreadcrumbCurrent(document, t("crumbPost", null, document));
    }
    return enhanceSubmitPanel(document, host);
  }

  const path = url.pathname || "";
  if (updateBreadcrumb) {
    if (/guidelines/i.test(path)) {
      setBreadcrumbCurrent(document, t("crumbRules", null, document));
    } else if (/security|showhn|newsfaq|formatdoc/i.test(path)) {
      setBreadcrumbCurrent(document, t("crumbHelp", null, document));
    } else if (/forgot/i.test(path)) {
      setBreadcrumbCurrent(document, t("crumbForgot", null, document));
    } else {
      setBreadcrumbCurrent(document, t("crumbPage", null, document));
    }
  }
  return enhanceDocumentPanel(document, host);
}

function isPopupHref(href, document) {
  if (!href || href.startsWith("#") || /^(mailto|javascript):/i.test(href)) {
    return false;
  }
  try {
    const url = resolvePageUrl(document, href);
    const origin = document.defaultView?.location?.origin;
    if (origin && url.origin !== origin) {
      return false;
    }
    const key = url.pathname.replace(/^\//, "").split("/")[0] || "";
    if (key === "login" || key === "forgot" || key === "changepw" || key === "user" || key === "submit") {
      return true;
    }
    return /guidelines|security|showhn|newsfaq|formatdoc/i.test(url.pathname);
  } catch {
    return false;
  }
}

function shouldSuppressTabFocus(document) {
  if (document.body.classList.contains("hb-popup-standalone")) {
    return true;
  }
  if (document.body.classList.contains("hb-item-page")) {
    return true;
  }
  const key = getCurrentPathKey(document);
  if (
    key === "item" ||
    key === "user" ||
    key === "login" ||
    key === "forgot" ||
    key === "changepw" ||
    key === "submit"
  ) {
    return true;
  }
  const path = document.defaultView?.location?.pathname || "";
  return /guidelines|security|showhn|newsfaq|formatdoc/i.test(path);
}

function dismissPopupNavigate(document) {
  const win = document.defaultView;
  if (!win) {
    return;
  }
  if (win.history?.length > 1) {
    win.history.back();
    return;
  }
  win.location.href = "news";
}

function closePopupModal(document) {
  document.querySelector(".hb-modal-overlay")?.remove();
  document.body.classList.remove("hb-popup-page");
  if (!document.body.classList.contains("hb-popup-standalone")) {
    return;
  }
  document.body.classList.remove("hb-popup-standalone");
}

function createPopupLoadingPanel(document) {
  const panel = document.createElement("div");
  panel.className = "hb-modal-loading";
  const title = document.createElement("p");
  title.textContent = t("popupLoading", null, document);
  panel.append(title);
  return panel;
}

function presentPopupModal(document, wrap, panel, options = {}) {
  if (!wrap || !panel) {
    return;
  }

  const standalone = Boolean(options.standalone);
  wrap.querySelector(".hb-modal-overlay")?.remove();

  document.body.classList.add("hb-popup-page");
  document.body.classList.toggle("hb-popup-standalone", standalone);

  const overlay = document.createElement("div");
  overlay.className = "hb-modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  const backdrop = document.createElement("button");
  backdrop.type = "button";
  backdrop.className = "hb-modal-backdrop";
  backdrop.setAttribute("aria-label", t("close", null, document));

  const modal = document.createElement("div");
  modal.className = "hb-modal";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "hb-modal-close";
  close.setAttribute("aria-label", t("close", null, document));
  close.textContent = "×";

  const onDismiss = (event) => {
    event.preventDefault();
    if (standalone) {
      dismissPopupNavigate(document);
      return;
    }
    closePopupModal(document);
  };
  backdrop.addEventListener("click", onDismiss);
  close.addEventListener("click", onDismiss);

  modal.append(close, panel);
  overlay.append(backdrop, modal);
  wrap.append(overlay);
}

function buildPopupPanelFromHtml(document, html, pageUrl, options = {}) {
  const updateBreadcrumb = Boolean(options.updateBreadcrumb);
  const url = resolvePageUrl(document, pageUrl);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const main = parsed.querySelector("#hnmain");

  if (/\/user/i.test(url.pathname) && main) {
    const userId = url.searchParams.get("id")?.trim();
    if (updateBreadcrumb) {
      setBreadcrumbCurrent(document, userId || t("crumbUser", null, document));
    }
    const imported = document.importNode(main, true);
    return enhanceUserPanel(document, imported, {
      userId,
      titleHint: parsed.title,
    });
  }

  const host = document.createElement("div");
  if (main) {
    host.append(document.importNode(main, true));
  } else {
    for (const child of [...parsed.body.childNodes]) {
      if (child.nodeType === 1 && child.tagName === "SCRIPT") {
        continue;
      }
      host.append(document.importNode(child, true));
    }
  }
  return wrapOrphanContent(document, [...host.childNodes], url, { updateBreadcrumb });
}

async function openInPagePopup(document, href) {
  const wrap = document.querySelector(".hb-wrap");
  const win = document.defaultView;
  if (!wrap || !win) {
    return;
  }

  const pageUrl = resolvePageUrl(document, href);
  const standalone = document.body.classList.contains("hb-popup-standalone");
  presentPopupModal(document, wrap, createPopupLoadingPanel(document), { standalone });

  try {
    const response = await win.fetch(pageUrl.href, {
      credentials: "same-origin",
      headers: { Accept: "text/html" },
    });
    if (!response.ok) {
      throw new Error(`popup fetch failed: ${response.status}`);
    }
    const html = await response.text();
    const panel = buildPopupPanelFromHtml(document, html, pageUrl, {
      updateBreadcrumb: standalone,
    });
    presentPopupModal(document, wrap, panel, { standalone });
  } catch {
    win.location.href = pageUrl.href;
  }
}

function bindPopupLinks(document) {
  if (document.documentElement.dataset.hbPopupBound === "1") {
    return;
  }
  document.documentElement.dataset.hbPopupBound = "1";

  document.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor || anchor.target === "_blank") {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!isPopupHref(href, document)) {
        return;
      }
      // 独立弹层页内的切换（登录⇄注册）仍走页内替换
      event.preventDefault();
      event.stopPropagation();
      void openInPagePopup(document, href);
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    if (!document.querySelector(".hb-modal-overlay")) {
      return;
    }
    event.preventDefault();
    if (document.body.classList.contains("hb-popup-standalone")) {
      dismissPopupNavigate(document);
      return;
    }
    closePopupModal(document);
  });
}

function mountUserPopup(document, wrap, source, main) {
  if (getCurrentPathKey(document) !== "user" || !main) {
    return;
  }
  const params = new URLSearchParams(document.defaultView?.location?.search || "");
  const userId = params.get("id")?.trim();
  setBreadcrumbCurrent(document, userId || t("crumbUser", null, document));
  const panel = enhanceUserPanel(document, main, {
    userId,
    titleHint: document.title,
  });
  presentPopupModal(document, wrap, panel, { standalone: true });
  source.hidden = true;
  source.classList.add("hb-source-hidden");
  source.classList.remove("hb-source-visible");
}

function readKarmaBesideUserLink(userLink) {
  const sibling = userLink?.nextSibling;
  if (sibling?.nodeType === 3) {
    const match = sibling.textContent.match(/^\s*\(([\d,]+)\)/);
    if (match) {
      return Number(match[1].replaceAll(",", ""));
    }
  }
  return null;
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
  const karma = readKarmaBesideUserLink(userLink);
  return {
    name: userLink.textContent.trim() || t("userFallback", null, document),
    href: userLink.getAttribute("href") || "login",
    logoutHref: logout.getAttribute("href") || "logout",
    karma: Number.isFinite(karma) ? karma : null,
  };
}

const BANNER_COVER_PATH = "src/icons/banner-process.jpg";
const DEFAULT_PREFERENCES = {
  theme: "light",
  density: "comfortable",
  accentColor: "blue",
  titleOpensDiscussion: true,
  discussionOpensNewTab: true,
  showBannerCover: false,
  language: "auto",
  lzlPreviewLimit: "3",
};

function resolveExtensionUrl(path) {
  try {
    return globalThis.chrome?.runtime?.getURL?.(path) || "";
  } catch {
    return "";
  }
}

function extensionVersion() {
  try {
    return globalThis.chrome?.runtime?.getManifest?.()?.version || "";
  } catch {
    return "";
  }
}

function applyBannerCover(root, enabled = true) {
  const cover = root?.querySelector?.(".hb-card-cover");
  if (!cover) {
    return;
  }
  if (!enabled) {
    cover.removeAttribute("src");
    cover.hidden = true;
    return;
  }
  cover.hidden = false;
  const url = resolveExtensionUrl(BANNER_COVER_PATH);
  if (!url) {
    return;
  }
  cover.src = url;
}

function createSettingsSelect(document, { id, labelKey, options }) {
  const label = document.createElement("label");
  label.className = "hb-settings-field";
  label.setAttribute("for", id);

  const caption = document.createElement("span");
  caption.className = "hb-settings-label";
  caption.textContent = t(labelKey, null, document);
  label.append(caption);

  const select = document.createElement("select");
  select.className = "hb-settings-select";
  select.id = id;
  select.name = id;
  for (const option of options) {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = t(option.labelKey, null, document);
    select.append(node);
  }
  label.append(select);
  return { label, select };
}

function createSettingsSwitch(document, { id, titleKey, hintKey }) {
  const label = document.createElement("label");
  label.className = "hb-settings-switch";
  label.setAttribute("for", id);

  const text = document.createElement("span");
  text.className = "hb-settings-switch-text";
  const strong = document.createElement("strong");
  strong.textContent = t(titleKey, null, document);
  const hint = document.createElement("small");
  hint.innerHTML = t(hintKey, null, document).replaceAll("<br>", " · ");
  text.append(strong, hint);

  const toggle = document.createElement("span");
  toggle.className = "hb-settings-toggle";
  const input = document.createElement("input");
  input.id = id;
  input.name = id;
  input.type = "checkbox";
  const track = document.createElement("span");
  track.className = "hb-settings-toggle-track";
  track.setAttribute("aria-hidden", "true");
  toggle.append(input, track);

  label.append(text, toggle);
  return { label, input };
}

function createSettingsSection(document, titleKey, nodes) {
  const section = document.createElement("section");
  section.className = "hb-settings-section";
  const heading = document.createElement("h3");
  heading.className = "hb-settings-section-title";
  heading.textContent = t(titleKey, null, document);
  section.append(heading);
  for (const node of nodes) {
    section.append(node);
  }
  return section;
}

function buildSettingsPanel(document) {
  const panel = document.createElement("div");
  panel.className = "hb-settings-panel";

  const head = document.createElement("header");
  head.className = "hb-settings-head";
  const title = document.createElement("h2");
  title.className = "hb-settings-title";
  title.textContent = t("pluginSettings", null, document);
  const subtitle = document.createElement("p");
  subtitle.className = "hb-settings-subtitle";
  subtitle.textContent = t("optSubtitle", null, document);
  head.append(title, subtitle);
  panel.append(head);

  const form = document.createElement("form");
  form.className = "hb-settings-form";
  form.id = "hb-preferences";

  const language = createSettingsSelect(document, {
    id: "language",
    labelKey: "optLanguage",
    options: [
      { value: "auto", labelKey: "optLangAuto" },
      { value: "en", labelKey: "optLangEn" },
      { value: "zh", labelKey: "optLangZh" },
    ],
  });
  const theme = createSettingsSelect(document, {
    id: "theme",
    labelKey: "optTheme",
    options: [
      { value: "light", labelKey: "optThemeLight" },
      { value: "dark", labelKey: "optThemeDark" },
      { value: "system", labelKey: "optThemeSystem" },
    ],
  });
  const density = createSettingsSelect(document, {
    id: "density",
    labelKey: "optDensity",
    options: [
      { value: "comfortable", labelKey: "optDensityComfortable" },
      { value: "compact", labelKey: "optDensityCompact" },
    ],
  });
  const accentColor = createSettingsSelect(document, {
    id: "accentColor",
    labelKey: "optAccentColor",
    options: [
      { value: "blue", labelKey: "optAccentBlue" },
      { value: "orange", labelKey: "optAccentOrange" },
    ],
  });
  const titleClick = createSettingsSwitch(document, {
    id: "titleOpensDiscussion",
    titleKey: "optTitleClick",
    hintKey: "optTitleClickHint",
  });
  const discussionTab = createSettingsSwitch(document, {
    id: "discussionOpensNewTab",
    titleKey: "optDiscussionNewTab",
    hintKey: "optDiscussionNewTabHint",
  });
  const bannerCover = createSettingsSwitch(document, {
    id: "showBannerCover",
    titleKey: "optBannerCover",
    hintKey: "optBannerCoverHint",
  });
  const lzlPreview = createSettingsSelect(document, {
    id: "lzlPreviewLimit",
    labelKey: "optLzlPreview",
    options: [
      { value: "3", labelKey: "optLzlPreview3" },
      { value: "5", labelKey: "optLzlPreview5" },
      { value: "10", labelKey: "optLzlPreview10" },
      { value: "unlimited", labelKey: "optLzlPreviewUnlimited" },
    ],
  });

  const appearanceGrid = document.createElement("div");
  appearanceGrid.className = "hb-settings-grid";
  appearanceGrid.append(language.label, theme.label, density.label, accentColor.label);

  const readingGrid = document.createElement("div");
  readingGrid.className = "hb-settings-grid";
  readingGrid.append(lzlPreview.label);

  const readingList = document.createElement("div");
  readingList.className = "hb-settings-list";
  readingList.append(titleClick.label, discussionTab.label, bannerCover.label);

  const columns = document.createElement("div");
  columns.className = "hb-settings-columns";
  columns.append(
    createSettingsSection(document, "optSectionAppearance", [appearanceGrid]),
    createSettingsSection(document, "optSectionReading", [readingGrid, readingList]),
  );

  const footer = document.createElement("div");
  footer.className = "hb-settings-footer";

  const about = document.createElement("div");
  about.className = "hb-settings-about";
  const version = extensionVersion();
  const aboutBits = [];
  if (version) {
    aboutBits.push(`${t("optVersion", null, document)} ${version}`);
  }
  const developerLink = document.createElement("a");
  developerLink.href = "https://github.com/sha2kyou";
  developerLink.target = "_blank";
  developerLink.rel = "noopener noreferrer";
  developerLink.textContent = "sha2kyou";
  const repositoryLink = document.createElement("a");
  repositoryLink.href = "https://github.com/sha2kyou/HackerBa";
  repositoryLink.target = "_blank";
  repositoryLink.rel = "noopener noreferrer";
  repositoryLink.textContent = "GitHub";
  if (aboutBits.length) {
    about.append(document.createTextNode(aboutBits.join(" · ")), document.createTextNode(" · "));
  }
  about.append(developerLink, document.createTextNode(" · "), repositoryLink);

  const actions = document.createElement("div");
  actions.className = "hb-settings-actions";
  const status = document.createElement("output");
  status.id = "hb-settings-status";
  status.setAttribute("aria-live", "polite");
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "hb-primary-btn";
  submit.textContent = t("optSave", null, document);
  actions.append(status, submit);

  footer.append(about, actions);
  form.append(columns, footer);
  panel.append(form);

  void hydrateSettingsForm(document, {
    language: language.select,
    theme: theme.select,
    density: density.select,
    accentColor: accentColor.select,
    lzlPreviewLimit: lzlPreview.select,
    titleOpensDiscussion: titleClick.input,
    discussionOpensNewTab: discussionTab.input,
    showBannerCover: bannerCover.input,
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveSettingsForm(document, {
      language: language.select,
      theme: theme.select,
      density: density.select,
      accentColor: accentColor.select,
      lzlPreviewLimit: lzlPreview.select,
      titleOpensDiscussion: titleClick.input,
      discussionOpensNewTab: discussionTab.input,
      showBannerCover: bannerCover.input,
      status,
    });
  });

  return panel;
}

async function readPreferences() {
  if (globalThis.chrome?.storage?.sync) {
    return chrome.storage.sync.get(DEFAULT_PREFERENCES);
  }
  return { ...DEFAULT_PREFERENCES };
}

async function hydrateSettingsForm(document, fields) {
  const preferences = await readPreferences();
  fields.language.value = preferences.language || DEFAULT_PREFERENCES.language;
  fields.theme.value = preferences.theme || DEFAULT_PREFERENCES.theme;
  fields.density.value = preferences.density || DEFAULT_PREFERENCES.density;
  fields.accentColor.value = preferences.accentColor || DEFAULT_PREFERENCES.accentColor;
  fields.lzlPreviewLimit.value = resolveLzlPreviewLimitPref(preferences.lzlPreviewLimit);
  fields.titleOpensDiscussion.checked = preferences.titleOpensDiscussion !== false;
  fields.discussionOpensNewTab.checked = preferences.discussionOpensNewTab !== false;
  fields.showBannerCover.checked = preferences.showBannerCover === true;
}

async function saveSettingsForm(document, fields) {
  const next = {
    language: fields.language.value,
    theme: fields.theme.value,
    density: fields.density.value,
    accentColor: fields.accentColor.value,
    lzlPreviewLimit: resolveLzlPreviewLimitPref(fields.lzlPreviewLimit.value),
    titleOpensDiscussion: fields.titleOpensDiscussion.checked,
    discussionOpensNewTab: fields.discussionOpensNewTab.checked,
    showBannerCover: fields.showBannerCover.checked,
  };
  if (globalThis.chrome?.storage?.sync) {
    await chrome.storage.sync.set(next);
  }
  reloadPage(document);
}

function reloadPage(document) {
  const win = document.defaultView;
  if (typeof win?.hbReloadPage === "function") {
    win.hbReloadPage();
    return;
  }
  win?.location?.reload?.();
}

function openSettingsModal(document) {
  const wrap = document.querySelector(".hb-wrap");
  if (!wrap) {
    return;
  }
  presentPopupModal(document, wrap, buildSettingsPanel(document));
}

function renderSettingsLink(document) {
  return `
    <span class="hb-user-sep">|</span>
    <a class="hb-settings-link" href="#" role="button">${escapeHtml(t("pluginSettings", null, document))}</a>
  `;
}

function bindSettingsLink(document) {
  if (document.documentElement.dataset.hbSettingsBound === "1") {
    return;
  }
  document.documentElement.dataset.hbSettingsBound = "1";

  document.addEventListener(
    "click",
    (event) => {
      const link = event.target?.closest?.("a.hb-settings-link");
      if (!link) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      openSettingsModal(document);
    },
    true,
  );
}

function renderUserbar(document, session) {
  const bar = document.querySelector(".hb-userbar");
  if (!bar) {
    return;
  }
  const settingsLink = renderSettingsLink(document);
  if (!session) {
    bar.innerHTML = `
      <a href="login">${escapeHtml(t("login", null, document))}</a>
      <span class="hb-user-sep">|</span>
      <a href="login?mode=register">${escapeHtml(t("register", null, document))}</a>${settingsLink}
    `;
    return;
  }
  bar.innerHTML = `
    <a class="hb-user-name" href="${escapeAttr(session.href)}">${escapeHtml(session.name)}</a>
    <span class="hb-user-sep">|</span>
    <a href="${escapeAttr(session.logoutHref)}">${escapeHtml(t("logout", null, document))}</a>${settingsLink}
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
        <a class="hb-brand" href="news" title="${escapeAttr(t("brandName", null, document))}">
          <span class="hb-brand-text"><i>Hacker</i>${escapeHtml(t("brandSuffix", null, document))}</span>
        </a>
        <form class="hb-search" data-hb-search="local" action="#" method="get">
          <input name="q" type="search" placeholder="${escapeAttr(t("searchPlaceholder", null, document))}" aria-label="${escapeAttr(t("searchAria", null, document))}">
          <button type="submit" class="hb-search-btn">${escapeHtml(t("search", null, document))}</button>
        </form>
        <div class="hb-userbar"></div>
      </div>
    </div>
    <div class="hb-breadcrumb">
      <a href="news">${escapeHtml(t("brandName", null, document))}</a>
      <span class="hb-bc-sep">/</span>
      <span class="hb-bc-current">${escapeHtml(t("forumName", null, document))}</span>
    </div>
    <div class="hb-card-banner">
      <div class="hb-card-banner-clip">
        <img class="hb-card-cover" alt="" decoding="async">
      </div>
      <div class="hb-card-head">
        <div class="hb-card-avatar" aria-hidden="true">
          <span class="hb-forum-mark">Y</span>
        </div>
        <div class="hb-card-info">
          <div class="hb-card-title-row">
            <h1 class="hb-card-title">${escapeHtml(t("forumName", null, document))}</h1>
            <span class="hb-card-level"${
              session && isFetchableUser(session.name)
                ? ` data-hb-user="${escapeAttr(session.name)}"`
                : ""
            } title="${escapeAttr(t("forumLevel", null, document))}">Lv.—</span>
          </div>
          <div class="hb-card-num">
            <span><em>${escapeHtml(t("followers", null, document))}</em><b>1,165,754</b></span>
            <span><em>${escapeHtml(t("posts", null, document))}</em><b>6,099,649</b></span>
          </div>
          <p class="hb-card-slogan">${escapeHtml(t("slogan", null, document))}</p>
        </div>
        <div class="hb-card-btns">
          ${
            session
              ? `<button type="button" class="hb-btn-attention hb-btn-followed" aria-pressed="true">${escapeHtml(t("followed", null, document))}</button>
          <button type="button" class="hb-btn-checkin hb-btn-checked" aria-pressed="true">${escapeHtml(t("checkedIn", null, document))}</button>`
              : `<a class="hb-btn-attention" href="login">${escapeHtml(t("follow", null, document))}</a>
          <a class="hb-btn-checkin" href="login">${escapeHtml(t("checkin", null, document))}</a>`
          }
        </div>
      </div>
    </div>
    <div class="hb-content clearfix">
      <div class="hb-main">
        <div class="hb-tab-bar">
          <ul class="hb-tab-nav">
            <li><a href="news" data-hb-tab="posts">${escapeHtml(t("tabPosts", null, document))}</a></li>
            <li><a href="ask" data-hb-tab="ask">${escapeHtml(t("tabAsk", null, document))}</a></li>
            <li><a href="show" data-hb-tab="show">${escapeHtml(t("tabShow", null, document))}</a></li>
            <li><a href="jobs" data-hb-tab="jobs">${escapeHtml(t("tabJobs", null, document))}</a></li>
            <li><a href="best" data-hb-tab="good">${escapeHtml(t("tabBest", null, document))}</a></li>
          </ul>
          <a class="hb-tab-post" href="submit">${escapeHtml(t("post", null, document))}</a>
        </div>
        <div class="hb-thread-panel"></div>
      </div>
      <aside class="hb-aside">
        <div class="hb-aside-box">
          <div class="hb-aside-title">${escapeHtml(t("asideInfo", null, document))}</div>
          <div class="hb-aside-body">
            <div class="hb-aside-forum">
              <div class="hb-aside-avatar" aria-hidden="true">
                <span class="hb-forum-mark">Y</span>
              </div>
              <div>
                <div class="hb-aside-name">${escapeHtml(t("forumName", null, document))}</div>
                <div class="hb-aside-meta">${escapeHtml(t("asideCategory", null, document))}</div>
              </div>
            </div>
            <p>${escapeHtml(t("asideOwner", null, document))}</p>
            <p>${escapeHtml(t("asideCreated", null, document))}</p>
            <a class="hb-aside-link" href="newsguidelines.html">${escapeHtml(t("asideRules", null, document))}</a>
          </div>
        </div>
      </aside>
    </div>
    <div class="hb-footer">${escapeHtml(t("footer", null, document))}</div>
  `;

  document.body.insertBefore(wrap, document.body.firstChild);
  applyBannerCover(wrap, document.documentElement.dataset.hbBannerCover !== "0");
  renderUserbar(document, session);
  if (session && Number.isFinite(session.karma)) {
    karmaCache.set(session.name, session.karma);
    const cardLevel = wrap.querySelector(".hb-card-level[data-hb-user]");
    if (cardLevel) {
      applyLevelToNode(cardLevel, session.karma);
    }
  }

  const source = document.createElement("div");
  source.className = "hb-hn-source hb-source-hidden";
  source.hidden = true;

  if (existingMain) {
    source.append(existingMain);
    existingMain.querySelector(".pagetop")?.closest("tr")?.classList.add("hb-original-header");
    wrap.querySelector(".hb-thread-panel").append(source);
    mountUserPopup(document, wrap, source, existingMain);
  } else {
    wrap.querySelector(".hb-thread-panel").append(source);
    const panel = wrapOrphanContent(document, orphanNodes);
    presentPopupModal(document, wrap, panel, { standalone: true });
  }
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

  if (shouldSuppressTabFocus(document)) {
    tabs.forEach((tab) => {
      tab.classList.remove("hb-tab-focus");
    });
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
    ask: t("tabAsk", null, document),
    show: t("tabShow", null, document),
    jobs: t("tabJobs", null, document),
    best: t("tabBest", null, document),
  };
  return labels[key] || t("tabPosts", null, document);
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
    document.querySelector(".hb-thread-list") ||
      document.querySelector(".hb-post-wrap") ||
      document.body.classList.contains("hb-popup-standalone"),
  );
  source.hidden = hideSource;
  source.classList.toggle("hb-source-hidden", hideSource);
  source.classList.toggle("hb-source-visible", !hideSource);
}

function formatRelativeTime(createdAtUnix, document) {
  if (!createdAtUnix) {
    return t("justNow", null, document);
  }
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(createdAtUnix));
  if (seconds < 60) {
    return t("justNow", null, document);
  }
  if (seconds < 3600) {
    return t("minutesAgo", { n: Math.floor(seconds / 60) }, document);
  }
  if (seconds < 86400) {
    return t("hoursAgo", { n: Math.floor(seconds / 3600) }, document);
  }
  return t("daysAgo", { n: Math.floor(seconds / 86400) }, document);
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function mapAlgoliaHits(hits = [], document) {
  return hits.map((hit) => {
    const externalHref = hit.url || "";
    const site = hostnameFromUrl(externalHref);
    return {
      title: hit.title || hit.story_title || t("untitled", null, document),
      author: hit.author || t("anonymous", null, document),
      authorHref: hit.author ? `user?id=${encodeURIComponent(hit.author)}` : "login",
      age: formatRelativeTime(hit.created_at_i, document),
      score: Number(hit.points || 0),
      replyNum: String(hit.num_comments || 0),
      itemHref: `item?id=${encodeURIComponent(hit.objectID || hit.story_id || "")}`,
      externalHref,
      site,
    };
  });
}

function titleHrefForThread(document, thread) {
  const openDiscussion = document.documentElement.dataset.hbTitleDiscussion !== "0";
  if (openDiscussion) {
    return thread.itemHref || "#";
  }
  if (/^https?:/i.test(thread.externalHref || "")) {
    return thread.externalHref;
  }
  return thread.itemHref || thread.externalHref || "#";
}

function shouldOpenDiscussionBlank(document) {
  return document.documentElement.dataset.hbDiscussionBlank !== "0";
}

function blankTargetAttrs(enabled) {
  return enabled ? ` target="_blank" rel="noopener noreferrer"` : "";
}

function createThreadItem(document, thread) {
  const badges = [];
  if (Number(thread.replyNum) >= 50) {
    badges.push(
      `<span class="hb-icon-hot" title="${escapeAttr(t("hotTitle", null, document))}">${escapeHtml(t("hotBadge", null, document))}</span>`,
    );
  }
  if (thread.score >= 100) {
    badges.push(
      `<span class="hb-icon-good" title="${escapeAttr(t("goodTitle", null, document))}">${escapeHtml(t("goodBadge", null, document))}</span>`,
    );
  }

  const openDiscussion = document.documentElement.dataset.hbTitleDiscussion !== "0";
  const discussionBlank = shouldOpenDiscussionBlank(document);
  const absParts = [];
  if (thread.site) {
    absParts.push(thread.site);
  }
  if (thread.score) {
    absParts.push(t("points", { n: thread.score }, document));
  }

  let absHtml = absParts.length
    ? absParts
        .map((part, index) => {
          if (index === 0 && thread.site && /^https?:/i.test(thread.externalHref || "")) {
            return `<a class="hb-th-site" href="${escapeAttr(thread.externalHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(part)}</a>`;
          }
          return escapeHtml(part);
        })
        .join(" · ")
    : "";

  if (!openDiscussion && thread.itemHref) {
    const gotoLink = `<a class="hb-goto-item" href="${escapeAttr(thread.itemHref)}"${blankTargetAttrs(discussionBlank)}>${escapeHtml(t("gotoDiscussion", null, document))}</a>`;
    absHtml = absHtml ? `${absHtml} ${gotoLink}` : gotoLink;
  }

  const titleHref = titleHrefForThread(document, thread);
  const titleIsExternal = /^https?:/i.test(titleHref) && titleHref !== thread.itemHref;
  const titleOpensBlank = titleIsExternal || (!titleIsExternal && discussionBlank && titleHref === thread.itemHref);
  const titleAttrs = ` href="${escapeAttr(titleHref)}"${blankTargetAttrs(titleOpensBlank)}`;

  const replyCount = Number(thread.replyNum) || 0;
  const repClass = [
    "hb-rep-num",
    replyCount === 0 ? "hb-rep-zero" : "",
    replyCount >= 100 ? "hb-rep-hot" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const item = document.createElement("li");
  item.className = "hb-thread-item";
  item.innerHTML = `
    <div class="hb-thread-left">
      <span class="${repClass}" title="${escapeAttr(t("repliesTitle", null, document))}">${escapeHtml(thread.replyNum)}</span>
    </div>
    <div class="hb-thread-body">
      <div class="hb-thread-lz">
        <div class="hb-thread-title">
          ${badges.join("")}
          <a class="hb-th-tit"${titleAttrs}>${escapeHtml(thread.title)}</a>
        </div>
        <div class="hb-thread-author-meta">
          <span class="hb-icon-author" aria-hidden="true"></span>
          <a class="hb-author" href="${escapeAttr(thread.authorHref)}" title="${escapeAttr(thread.author)}">${escapeHtml(thread.author)}</a>
        </div>
      </div>
      <div class="hb-thread-detail-row">
        <div class="hb-thread-abs">${absHtml}</div>
        <span class="hb-create-time" title="${escapeAttr(t("createdTitle", null, document))}">${escapeHtml(thread.age || "")}</span>
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
    next.textContent = t("nextPage", null, document);
    pager.append(next);
    return pager;
  }

  if (prevHref) {
    const prev = document.createElement("a");
    prev.className = "hb-pager-link hb-pager-prev";
    prev.setAttribute("href", prevHref);
    prev.textContent = t("prevPage", null, document);
    pager.append(prev);
  } else {
    const disabled = document.createElement("span");
    disabled.className = "hb-pager-disabled";
    disabled.textContent = t("prevPage", null, document);
    pager.append(disabled);
  }

  if (showPageNum) {
    const info = document.createElement("span");
    info.className = "hb-pager-info";
    info.textContent = t("pageNum", { n: page }, document);
    pager.append(info);
  }

  if (nextHref) {
    const next = document.createElement("a");
    next.className = "hb-pager-link hb-pager-next";
    next.setAttribute("href", nextHref);
    next.textContent = t("nextPage", null, document);
    pager.append(next);
  } else {
    const disabled = document.createElement("span");
    disabled.className = "hb-pager-disabled";
    disabled.textContent = t("nextPage", null, document);
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
        <a href="news">${escapeHtml(t("sortDefault", null, document))}</a>
        <a href="newest">${escapeHtml(t("sortNewest", null, document))}</a>
      </div>
      <div class="hb-thread-top-right">
        <span class="hb-thread-count">${escapeHtml(countLabel)}</span>
      </div>
    `
    : `
      <div class="hb-thread-sort">
        <span class="hb-sort-focus">${escapeHtml(sectionLabel || t("list", null, document))}</span>
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
    empty.textContent = t("noTopics", null, document);
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

    const author = metaRow.querySelector(".hnuser")?.textContent?.trim() || t("anonymous", null, document);
    const authorHref = metaRow.querySelector(".hnuser")?.getAttribute("href") || "login";
    const age = localizeAgeText(metaRow.querySelector(".age")?.textContent, document);
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
  const pageHint = pagerState.showPageNum
    ? t("pageHint", { n: pagerState.page }, document)
    : "";
  renderThreadPanel(document, {
    threads,
    countLabel: t("pageCount", { n: threads.length, hint: pageHint }, document),
    showSort,
    sectionLabel: getSectionLabel(document),
    pager: createPager(document, pagerState),
  });
}

async function searchHackerNews(query, document) {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`search failed: ${response.status}`);
  }
  const data = await response.json();
  return {
    threads: mapAlgoliaHits(data.hits || [], document),
    total: Number(data.nbHits || 0),
  };
}

function updateSearchBreadcrumb(document, query) {
  const current = document.querySelector(".hb-bc-current");
  if (!current) {
    return;
  }
  current.textContent = query
    ? t("searchCrumb", { q: query }, document)
    : t("forumName", null, document);
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
    countLabel: t("searching", null, document),
    showSort: false,
    sectionLabel: t("searchResults", null, document),
  });

  try {
    const { threads, total } = await searchHackerNews(query, document);
    if (seq !== hbSearchSeq) {
      return;
    }
    renderThreadPanel(document, {
      threads,
      countLabel: t("searchFound", { n: total }, document),
      showSort: false,
      sectionLabel: t("searchResults", null, document),
    });
  } catch {
    if (seq !== hbSearchSeq) {
      return;
    }
    renderThreadPanel(document, {
      threads: [],
      countLabel: t("searchFailed", null, document),
      showSort: false,
      sectionLabel: t("searchResults", null, document),
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

function hashString(text) {
  let hash = 0;
  const value = String(text || "");
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function avatarColor(name) {
  const hash = hashString(name);
  const hue = hash % 360;
  const sat = 42 + (hash % 28);
  const light = 38 + ((hash >>> 8) % 16);
  return `hsl(${hue} ${sat}% ${light}%)`;
}

/** Reference karma ≈ level 12; levels grow without an upper cap. */
const KARMA_LEVEL_REF = 50_000;
const KARMA_LEVEL_AT_REF = 12;

/**
 * Map HN karma → level with a log curve (no max).
 * level = floor(12 * log1p(karma) / log1p(50000))
 */
function userLevelFromKarma(karma) {
  const k = Math.max(0, Number(karma) || 0);
  if (k <= 0) {
    return 0;
  }
  return Math.floor((KARMA_LEVEL_AT_REF * Math.log1p(k)) / Math.log1p(KARMA_LEVEL_REF));
}

const karmaCache = new Map();
const karmaInflight = new Map();

function isFetchableUser(name) {
  const value = String(name || "").trim();
  return Boolean(value) && value !== "?" && value !== "anonymous" && value !== "匿名";
}

async function fetchUserKarma(username) {
  const key = String(username || "").trim();
  if (!isFetchableUser(key)) {
    return null;
  }
  if (karmaCache.has(key)) {
    return karmaCache.get(key);
  }
  if (karmaInflight.has(key)) {
    return karmaInflight.get(key);
  }

  const pending = (async () => {
    try {
      const response = await fetch(
        `https://hn.algolia.com/api/v1/users/${encodeURIComponent(key)}`,
      );
      if (!response.ok) {
        karmaCache.set(key, null);
        return null;
      }
      const data = await response.json();
      const karma = Number(data?.karma);
      const value = Number.isFinite(karma) ? Math.max(0, karma) : 0;
      karmaCache.set(key, value);
      return value;
    } catch {
      karmaCache.set(key, null);
      return null;
    } finally {
      karmaInflight.delete(key);
    }
  })();

  karmaInflight.set(key, pending);
  return pending;
}

function formatLevelText(levelEl, level) {
  if (level == null) {
    return levelEl.classList.contains("hb-card-level") ? "Lv.—" : "—";
  }
  return levelEl.classList.contains("hb-card-level") ? `Lv.${level}` : String(level);
}

function applyLevelToNode(levelEl, karma) {
  const level = karma == null ? null : userLevelFromKarma(karma);
  const text = formatLevelText(levelEl, level);
  const em = levelEl.querySelector("em");
  if (em) {
    em.textContent = text;
  } else {
    levelEl.textContent = text;
  }
  if (karma == null) {
    levelEl.removeAttribute("title");
    return;
  }
  const baseTitle = levelEl.classList.contains("hb-card-level")
    ? t("forumLevel", null, levelEl.ownerDocument)
    : t("level", null, levelEl.ownerDocument);
  levelEl.title = `${baseTitle} · karma ${karma}`;
}

async function hydrateUserLevels(document) {
  const nodes = [
    ...document.querySelectorAll(".hb-floor-level[data-hb-user], .hb-card-level[data-hb-user]"),
  ];
  if (nodes.length === 0) {
    return;
  }

  const users = [...new Set(nodes.map((node) => node.dataset.hbUser).filter(isFetchableUser))];
  await Promise.all(
    users.map(async (user) => {
      const karma = await fetchUserKarma(user);
      nodes
        .filter((node) => node.dataset.hbUser === user)
        .forEach((node) => applyLevelToNode(node, karma));
    }),
  );
}

function createAuthorColumn(document, { user, userHref, isLz = false, isMe = false }) {
  const author = document.createElement("div");
  author.className = "hb-floor-author";

  if (isLz) {
    const badge = document.createElement("div");
    badge.className = "hb-louzhu";
    badge.title = t("op", null, document);
    badge.innerHTML = `<span>${escapeHtml(t("op", null, document))}</span>`;
    author.append(badge);
  } else if (isMe) {
    const badge = document.createElement("div");
    badge.className = "hb-me";
    badge.title = t("me", null, document);
    badge.innerHTML = `<span>${escapeHtml(t("me", null, document))}</span>`;
    author.append(badge);
  }

  const face = document.createElement("a");
  face.className = "hb-floor-face";
  face.setAttribute("href", userHref);
  face.setAttribute("title", user);

  const avatar = document.createElement("div");
  avatar.className = "hb-floor-avatar";
  avatar.textContent = avatarLetter(user);
  avatar.style.background = avatarColor(user);
  face.append(avatar);
  author.append(face);

  const name = document.createElement("a");
  name.className = "hb-floor-name";
  name.setAttribute("href", userHref);
  name.textContent = user;
  author.append(name);

  const level = document.createElement("div");
  level.className = "hb-floor-level";
  if (isFetchableUser(user)) {
    level.dataset.hbUser = user;
  }
  level.innerHTML = `<span>${escapeHtml(t("level", null, document))}</span><em>—</em>`;
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
        <span class="hb-core-meta">${escapeHtml(t("replyCount", { n: replyCount }, document))}</span>
        <a class="hb-core-quick-reply" href="#hb-reply">${escapeHtml(t("reply", null, document))}</a>
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
  title.textContent = t("postReply", null, document);
  panel.append(title);

  const help = form.querySelector('a[href*="formatdoc"]');
  if (help) {
    help.textContent = t("editHelp", null, document);
  }

  const actions = document.createElement("div");
  actions.className = "hb-form-actions";
  if (help) {
    const left = document.createElement("div");
    left.className = "hb-form-actions-left";
    left.append(help);
    actions.append(left);
  }
  form.querySelectorAll('input[type="submit"]').forEach((button) => {
    button.classList.add("hb-primary-btn");
    if (/add comment/i.test(button.value || "")) {
      button.value = t("submit", null, document);
    }
    actions.append(button);
  });
  form.append(actions);

  const box = document.createElement("div");
  box.className = "hb-reply-box";
  box.append(form);
  panel.append(box);
  return panel;
}

function buildMainFloor(document, fatitem, replyCount, meUser = "") {
  const titleLink = fatitem.querySelector(".titleline > a");
  const title = titleLink?.textContent?.trim() || t("noTitle", null, document);
  const titleHref = titleLink?.getAttribute("href") || "#";
  const site = fatitem.querySelector(".sitestr")?.textContent?.trim() || "";
  const user = fatitem.querySelector(".hnuser")?.textContent?.trim() || t("anonymous", null, document);
  const userHref = fatitem.querySelector(".hnuser")?.getAttribute("href") || "login";
  const age = localizeAgeText(fatitem.querySelector(".age")?.textContent, document);
  const score = fatitem.querySelector(".score")?.textContent?.trim() || "";
  const form = fatitem.querySelector("form");
  const toptext = fatitem.querySelector(".toptext");
  const isMe = Boolean(meUser && user === meUser);

  if (title) {
    setBreadcrumbCurrent(document, title.length > 28 ? `${title.slice(0, 28)}…` : title);
  }

  const coreTitle = createCoreTitle(document, { title, replyCount });

  const card = document.createElement("div");
  card.className = "hb-floor hb-floor-lz hb-main-floor";
  card.dataset.hbFloor = "1";
  card.append(createAuthorColumn(document, { user, userHref, isLz: true, isMe }));

  const main = document.createElement("div");
  main.className = "hb-floor-main";

  const top = document.createElement("div");
  top.className = "hb-floor-top";
  top.innerHTML = `<span class="hb-floor-no">${escapeHtml(t("floor", { n: 1 }, document))}</span>`;
  main.append(top);

  const content = document.createElement("div");
  content.className = "hb-floor-content";
  if (toptext && toptext.textContent.trim()) {
    content.append(...[...toptext.childNodes]);
  } else if (/^https?:/i.test(titleHref)) {
    const share = document.createElement("div");
    share.className = "hb-share-link";
    share.innerHTML = `
      <div class="hb-share-label">${escapeHtml(t("shareLink", null, document))}</div>
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
  replyA.textContent = t("reply", null, document);
  meta.append(replyA);

  main.append(meta);
  card.append(main);

  return { form, coreTitle, card, user };
}

function createFloorCard(document, comment, floor, firstUser, meUser = "") {
  const user = comment.querySelector(".hnuser")?.textContent?.trim() || "?";
  const userHref = comment.querySelector(".hnuser")?.getAttribute("href") || "login";
  const age = localizeAgeText(
    comment.querySelector(".age")?.textContent ||
      (comment.querySelector(".comhead")?.textContent || "").replace(user, "").replace(/\s+/g, " "),
    document,
  );
  const isLz = Boolean(firstUser && user === firstUser);
  const isMe = Boolean(meUser && user === meUser);
  const commentNode = comment.querySelector(".comment");
  const reply = commentNode?.querySelector(".reply");

  const card = document.createElement("div");
  card.className = isLz ? "hb-floor hb-floor-lz" : "hb-floor";
  if (isMe) {
    card.classList.add("hb-floor-me");
  }
  card.dataset.hbFloor = String(floor);

  card.append(createAuthorColumn(document, { user, userHref, isLz, isMe }));

  const main = document.createElement("div");
  main.className = "hb-floor-main";

  const top = document.createElement("div");
  top.className = "hb-floor-top";

  const floorNo = document.createElement("span");
  floorNo.className = "hb-floor-no";
  floorNo.textContent = t("floor", { n: floor }, document);
  top.append(floorNo);

  const toggle = document.createElement("button");
  toggle.className = "hb-floor-toggle";
  toggle.type = "button";
  toggle.textContent = t("collapse", null, document);
  toggle.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-label", t("collapseFloor", null, document));
  toggle.addEventListener("click", () => {
    const collapsed = card.classList.toggle("hb-floor-collapsed");
    toggle.textContent = collapsed ? t("expand", null, document) : t("collapse", null, document);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute(
      "aria-label",
      collapsed ? t("expandFloor", null, document) : t("collapseFloor", null, document),
    );
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
      a.textContent = t("reply", null, document);
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
    <div class="hb-lzl-hd">${escapeHtml(t("lzlCountPrefix", null, document))}<em class="hb-lzl-num">0</em>${escapeHtml(t("lzlCountSuffix", null, document))}</div>
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

const LZL_PREVIEW_LIMITS = new Set(["3", "5", "10", "unlimited"]);

function resolveLzlPreviewLimitPref(value) {
  const raw = String(value ?? "");
  return LZL_PREVIEW_LIMITS.has(raw) ? raw : DEFAULT_PREFERENCES.lzlPreviewLimit;
}

/** @returns {number | null} null = 不限制 */
function resolveLzlPreviewLimit(document) {
  const pref = resolveLzlPreviewLimitPref(document.documentElement.dataset.hbLzlPreview);
  if (pref === "unlimited") {
    return null;
  }
  return Number(pref);
}

function applyLzlFold(lzl, document) {
  lzl.querySelector(".hb-lzl-more")?.remove();

  const items = [...lzl.querySelectorAll(".hb-lzl-list > .hb-lzl-item")];
  items.forEach((item) => {
    item.classList.remove("hb-lzl-item-folded", "hb-lzl-preview-last");
  });

  const limit = resolveLzlPreviewLimit(document);
  if (limit == null || items.length <= limit) {
    return;
  }

  const hidden = items.slice(limit);
  hidden.forEach((item) => item.classList.add("hb-lzl-item-folded"));
  items[limit - 1]?.classList.add("hb-lzl-preview-last");

  const more = document.createElement("button");
  more.type = "button";
  more.className = "hb-lzl-more";
  const hiddenCount = hidden.length;
  more.textContent = t("lzlExpandMore", { n: hiddenCount }, document);
  more.setAttribute("aria-label", more.textContent);
  more.addEventListener("click", () => {
    hidden.forEach((item) => item.classList.remove("hb-lzl-item-folded"));
    items[limit - 1]?.classList.remove("hb-lzl-preview-last");
    more.remove();
  });
  lzl.append(more);
}

function createLzlItem(document, comment, { firstUser, meUser = "", replyTo = "" }) {
  const user = comment.querySelector(".hnuser")?.textContent?.trim() || "?";
  const userHref = comment.querySelector(".hnuser")?.getAttribute("href") || "login";
  const age = localizeAgeText(
    comment.querySelector(".age")?.textContent ||
      (comment.querySelector(".comhead")?.textContent || "").replace(user, "").replace(/\s+/g, " "),
    document,
  );
  const isLz = Boolean(firstUser && user === firstUser);
  const isMe = Boolean(meUser && user === meUser);
  const commentNode = comment.querySelector(".comment");
  const reply = commentNode?.querySelector(".reply");

  const item = document.createElement("li");
  item.className = isLz ? "hb-lzl-item hb-lzl-lz" : "hb-lzl-item";
  if (isMe) {
    item.classList.add("hb-lzl-me");
  }

  const name = document.createElement("a");
  name.className = "hb-lzl-name";
  name.href = userHref;
  name.textContent = user;
  item.append(name);

  if (isLz) {
    const badge = document.createElement("span");
    badge.className = "hb-lzl-lz-tag";
    badge.textContent = t("op", null, document);
    item.append(badge);
  } else if (isMe) {
    const badge = document.createElement("span");
    badge.className = "hb-lzl-me-tag";
    badge.textContent = t("me", null, document);
    item.append(badge);
  }

  item.append(document.createTextNode("："));

  if (replyTo) {
    const to = document.createElement("span");
    to.className = "hb-lzl-to";
    to.textContent = t("replyTo", { name: replyTo }, document);
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
      a.textContent = t("reply", null, document);
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
  const tabBar = document.querySelector(".hb-tab-bar");
  if (tabBar) {
    tabBar.hidden = true;
  }

  const meUser = resolveSessionUser(document)?.name || "";
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
    const built = buildMainFloor(document, fatitem, replyCount, meUser);
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
        const built = createFloorCard(document, comment, floorNo, firstUser, meUser);
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
        meUser,
        replyTo: indent > 1 ? parent.user : "",
      });
      lzl.querySelector(".hb-lzl-list")?.append(built.item);
      syncLzlCount(lzl);
      stack.push({ indent, user: built.user, card: floorCard });
    });

    list.querySelectorAll(".hb-lzl").forEach((lzl) => applyLzlFold(lzl, document));
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
  let preferences = DEFAULT_PREFERENCES;
  if (globalThis.chrome?.storage?.sync) {
    preferences = await chrome.storage.sync.get(DEFAULT_PREFERENCES);
  }

  const themePref = preferences.theme || DEFAULT_PREFERENCES.theme;
  const languagePref = preferences.language || DEFAULT_PREFERENCES.language;
  const browserLang =
    document.defaultView?.navigator?.language ||
    globalThis.navigator?.language ||
    "";
  const locale = globalThis.HackerBaI18n
    ? globalThis.HackerBaI18n.resolveLocale(languagePref, browserLang)
    : "en";
  hbLocale = locale;

  document.documentElement.dataset.hbThemePref = themePref;
  document.documentElement.dataset.hbTheme = resolveTheme(themePref, document.defaultView);
  document.documentElement.dataset.hbDensity = preferences.density || DEFAULT_PREFERENCES.density;
  document.documentElement.dataset.hbAccent = resolveAccentColor(
    preferences.accentColor || DEFAULT_PREFERENCES.accentColor,
  );
  document.documentElement.dataset.hbTitleDiscussion =
    preferences.titleOpensDiscussion === false ? "0" : "1";
  document.documentElement.dataset.hbDiscussionBlank =
    preferences.discussionOpensNewTab === false ? "0" : "1";
  document.documentElement.dataset.hbBannerCover =
    preferences.showBannerCover === true ? "1" : "0";
  document.documentElement.dataset.hbLzlPreview = resolveLzlPreviewLimitPref(
    preferences.lzlPreviewLimit,
  );
  document.documentElement.dataset.hbLang = locale;
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  bindSystemThemeSync(document);
}

function resolveAccentColor(accentPref) {
  return accentPref === "orange" ? "orange" : "blue";
}

function resolveTheme(themePref, view = globalThis) {
  if (themePref === "system") {
    return view?.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  }
  return themePref === "dark" ? "dark" : "light";
}

let hbThemeMediaBound = false;

function bindSystemThemeSync(document) {
  const mq = document.defaultView?.matchMedia?.("(prefers-color-scheme: dark)");
  if (!mq || hbThemeMediaBound) {
    return;
  }
  hbThemeMediaBound = true;
  const onChange = () => {
    if (document.documentElement.dataset.hbThemePref !== "system") {
      return;
    }
    document.documentElement.dataset.hbTheme = mq.matches ? "dark" : "light";
  };
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onChange);
  } else if (typeof mq.addListener === "function") {
    mq.addListener(onChange);
  }
}

globalThis.HackerBa = {
  ...globalThis.HackerBa,
  enhanceHackerNews,
  mapAlgoliaHits,
  searchHackerNews,
  runLocalSearch,
  resolveListPager,
  createPager,
  resolveTheme,
  resolveAccentColor,
  applyPreferences,
  userLevelFromKarma,
  applyBannerCover,
  isPopupHref,
  openInPagePopup,
  closePopupModal,
  buildPopupPanelFromHtml,
  enhanceSubmitPanel,
  BANNER_COVER_PATH,
  openSettingsModal,
  buildSettingsPanel,
  KARMA_LEVEL_REF,
  KARMA_LEVEL_AT_REF,
};

function startHackerBa(document = globalThis.document) {
  if (!document?.documentElement) {
    return;
  }

  document.documentElement.classList.add("hb-boot");
  // 尽早读主题，避免先以浅色变量露出
  const prefsReady = applyPreferences(document);

  const boot = async () => {
    try {
      await prefsReady;
      enhanceHackerNews(document);
    } finally {
      document.documentElement.classList.remove("hb-boot");
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void boot();
    }, { once: true });
  } else {
    void boot();
  }

  // 防止改造失败时页面一直空白
  setTimeout(() => {
    document.documentElement.classList.remove("hb-boot");
  }, 2500);
}

if (typeof document !== "undefined") {
  startHackerBa(document);
}
