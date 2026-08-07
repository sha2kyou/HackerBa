# HackerBa

## Git

### 版本号（强制）

**每次执行 `git commit` 前必须先自动 bump 版本号**，无需用户提醒或显式要求。漏 bump 视为提交流程未完成。

步骤：

1. 读取当前版本（`package.json` / `manifest.json`，二者须一致）
2. 按下方规则将**最后一位 +1**
3. 同步写入所有声明版本的文件：`package.json`、`package-lock.json`（根 `version` 与 `packages[""].version`）、`manifest.json`
4. 将版本文件与业务改动一并 `git add` 后提交（同一 commit，不要拆成单独的 bump commit）

规则（`major.minor.patch`）：

1. `patch` + 1
2. `patch` 超过 9 时归零，`minor` + 1
3. `minor` 超过 9 时归零，`major` + 1

示例：`0.1.0` → `0.1.1` → … → `0.1.9` → `0.2.0` → … → `0.9.9` → `1.0.0`

提交信息遵循约定式提交（Conventional Commits），英文 subject。
