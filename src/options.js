const form = document.querySelector("#preferences");
const language = document.querySelector("#language");
const theme = document.querySelector("#theme");
const accentColor = document.querySelector("#accentColor");
const density = document.querySelector("#density");
const titleOpensDiscussion = document.querySelector("#titleOpensDiscussion");
const discussionOpensNewTab = document.querySelector("#discussionOpensNewTab");
const showBannerCover = document.querySelector("#showBannerCover");
const status = document.querySelector("#status");

const { resolveLocale, t } = globalThis.HackerBaI18n;

function browserLang() {
  return globalThis.navigator?.language || "";
}

function applyOptionsTheme(themePref) {
  let resolved = themePref;
  if (themePref === "system") {
    resolved = globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  document.documentElement.dataset.hbTheme = resolved === "dark" ? "dark" : "light";
}

function applyOptionsAccent(accentPref) {
  document.documentElement.dataset.hbAccent = accentPref === "orange" ? "orange" : "blue";
}

function applyOptionsI18n(locale) {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.title = t(locale, "optTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(locale, node.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-html]").forEach((node) => {
    node.innerHTML = t(locale, node.getAttribute("data-i18n-html"));
  });
  const versionEl = document.querySelector("#opt-version");
  if (versionEl) {
    versionEl.textContent = chrome.runtime.getManifest().version;
  }
}

async function restorePreferences() {
  const preferences = await chrome.storage.sync.get({
    language: "auto",
    theme: "light",
    accentColor: "blue",
    density: "comfortable",
    titleOpensDiscussion: true,
    discussionOpensNewTab: true,
    showBannerCover: false,
  });
  language.value = preferences.language || "auto";
  theme.value = preferences.theme;
  accentColor.value = preferences.accentColor === "orange" ? "orange" : "blue";
  density.value = preferences.density;
  titleOpensDiscussion.checked = preferences.titleOpensDiscussion !== false;
  discussionOpensNewTab.checked = preferences.discussionOpensNewTab !== false;
  showBannerCover.checked = preferences.showBannerCover === true;
  applyOptionsTheme(theme.value);
  applyOptionsAccent(accentColor.value);
  applyOptionsI18n(resolveLocale(language.value, browserLang()));
}

language.addEventListener("change", () => {
  applyOptionsI18n(resolveLocale(language.value, browserLang()));
});

theme.addEventListener("change", () => {
  applyOptionsTheme(theme.value);
});

accentColor.addEventListener("change", () => {
  applyOptionsAccent(accentColor.value);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const locale = resolveLocale(language.value, browserLang());
  await chrome.storage.sync.set({
    language: language.value,
    theme: theme.value,
    accentColor: accentColor.value,
    density: density.value,
    titleOpensDiscussion: titleOpensDiscussion.checked,
    discussionOpensNewTab: discussionOpensNewTab.checked,
    showBannerCover: showBannerCover.checked,
  });
  applyOptionsTheme(theme.value);
  applyOptionsAccent(accentColor.value);
  applyOptionsI18n(locale);
  status.value = t(locale, "optSaved");
});

restorePreferences();
