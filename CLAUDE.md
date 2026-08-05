# HackerBa

## Git

### 版本号

每次提交前，将版本号**最后一位 +1**，并同步更新所有声明版本的文件（当前为 `package.json`、`manifest.json`）。

规则（`major.minor.patch`）：

1. `patch` + 1
2. `patch` 超过 9 时归零，`minor` + 1
3. `minor` 超过 9 时归零，`major` + 1

示例：`0.1.0` → `0.1.1` → … → `0.1.9` → `0.2.0` → … → `0.9.9` → `1.0.0`

提交信息遵循约定式提交（Conventional Commits），英文 subject。
