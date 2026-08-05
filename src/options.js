const form = document.querySelector("#preferences");
const language = document.querySelector("#language");
const theme = document.querySelector("#theme");
const density = document.querySelector("#density");
const titleOpensDiscussion = document.querySelector("#titleOpensDiscussion");
const status = document.querySelector("#status");

const { resolveLocale, t } = globalThis.HackerBaI18n;

function browserLang() {
  return globalThis.navigator?.language || "";
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
    density: "comfortable",
    titleOpensDiscussion: true,
  });
  language.value = preferences.language || "auto";
  theme.value = preferences.theme;
  density.value = preferences.density;
  titleOpensDiscussion.checked = preferences.titleOpensDiscussion !== false;
  applyOptionsI18n(resolveLocale(language.value, browserLang()));
}

language.addEventListener("change", () => {
  applyOptionsI18n(resolveLocale(language.value, browserLang()));
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const locale = resolveLocale(language.value, browserLang());
  await chrome.storage.sync.set({
    language: language.value,
    theme: theme.value,
    density: density.value,
    titleOpensDiscussion: titleOpensDiscussion.checked,
  });
  applyOptionsI18n(locale);
  status.value = t(locale, "optSaved");
});

restorePreferences();
