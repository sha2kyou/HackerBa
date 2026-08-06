# HackerBa

Chrome 扩展：把 [Hacker News](https://news.ycombinator.com) 改造成贴吧式阅读界面。

内容仍来自 Hacker News，布局与交互仿经典百度贴吧吧页 / 看帖页。支持中英双语、浅色 / 深色主题，无需改动 HN 账号体系。

## 界面预览

### 列表页

![HackerBa 列表页](docs/images/hackerba-list.png)

### 看帖页

![HackerBa 看帖页](docs/images/hackerba-thread.png)

## 功能

- **列表页**：分数、热/精标签、标题与域名、作者与时间、贴吧式分页
- **看帖页**：楼层卡片、楼主标识、楼中楼回复、用户等级（由 HN karma 推导）
- **分区 Tab**：看帖 / 问答 / 作品 / 招聘 / 精品；列表可按默认或最新排序
- **页内弹层**：用户资料、登录等次级页面以弹层打开，少打断阅读
- **搜索**：页内搜索（Algolia HN API）
- **选项页**：语言、主题、主题色、信息密度、标题点击行为、新标签打开讨论、吧头首图显隐

## 安装

1. 打开 `chrome://extensions`
2. 开启「开发者模式」
3. 「加载已解压的扩展程序」
4. 选择本仓库根目录（含 `manifest.json`）

加载后访问任意 `https://news.ycombinator.com/*` 页面即可。偏好设置可在页面顶栏「插件设置」，或扩展详情页的「扩展程序选项」中调整。

## 开发

```bash
npm install
npm test
```

| 路径 | 说明 |
| --- | --- |
| `manifest.json` | Manifest V3 |
| `src/content-script.js` | 页面改造逻辑 |
| `src/hackerba.css` | 贴吧样式 |
| `src/i18n.js` | 中英文本 |
| `src/options.html` / `src/options.js` | 选项页 |
| `test/` | 单元测试 |

改代码后在 `chrome://extensions` 点「重新加载」，再刷新 HN 页面。

## 许可

[MIT](LICENSE)
