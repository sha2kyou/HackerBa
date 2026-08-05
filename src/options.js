const form = document.querySelector("#preferences");
const theme = document.querySelector("#theme");
const density = document.querySelector("#density");
const titleOpensDiscussion = document.querySelector("#titleOpensDiscussion");
const status = document.querySelector("#status");

async function restorePreferences() {
  const preferences = await chrome.storage.sync.get({
    theme: "light",
    density: "comfortable",
    titleOpensDiscussion: true,
  });
  theme.value = preferences.theme;
  density.value = preferences.density;
  titleOpensDiscussion.checked = preferences.titleOpensDiscussion !== false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await chrome.storage.sync.set({
    theme: theme.value,
    density: density.value,
    titleOpensDiscussion: titleOpensDiscussion.checked,
  });
  status.value = "已保存，刷新 Hacker News 页面后生效。";
});

restorePreferences();
