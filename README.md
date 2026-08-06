# HackerBa

[English](README.md) | [中文](README.zh-CN.md)

Chrome extension that restyles [Hacker News](https://news.ycombinator.com) as a Tieba-like forum.

Content still comes from Hacker News; layout and interaction follow classic Baidu Tieba forum / thread pages. Supports English / Chinese, light / dark theme, and a blue or HN-orange accent color. No changes to the HN account system.

## Screenshots

Desktop UI in English:

### List page

![HackerBa list page (English)](docs/images/hackerba-list-en.png)

### Thread page

![HackerBa thread page (English)](docs/images/hackerba-thread-en.png)

## Features

- **List page**: scores, hot/top badges, title and domain, author and time, Tieba-style pagination
- **Thread page**: floor cards, OP / Me badges, nested replies, user levels derived from HN karma
- **Section tabs**: Posts / Ask / Show / Jobs / Best; list sorting by default or newest
- **In-page modals**: profile, login, compose (new post), guidelines, and settings open as overlays
- **Search**: in-page search via the Algolia HN API
- **Options**: language, theme, accent color, density, title-click behavior, open discussion in new tab, forum cover visibility

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this repository root (the folder that contains `manifest.json`)

Then visit any `https://news.ycombinator.com/*` page. Preferences are available from the top-bar **Settings** link, or from the extension’s options page.

## Development

```bash
npm install
npm test
```

| Path | Description |
| --- | --- |
| `manifest.json` | Manifest V3 |
| `src/content-script.js` | Page restyle logic |
| `src/hackerba.css` | Tieba-style skin |
| `src/i18n.js` | English / Chinese strings |
| `src/options.html` / `src/options.js` | Options page |
| `test/` | Unit tests |

After code changes, click **Reload** on `chrome://extensions`, then refresh the HN page.

## License

[MIT](LICENSE)
