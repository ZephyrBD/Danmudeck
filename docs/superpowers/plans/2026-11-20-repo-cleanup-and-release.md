# DanmuDeck 仓库整理与自动发布 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让仓库只保留当前真实可用的文件，README 与实际形态一致，并新增「推 `v*` tag → GitHub Actions 出 `danmudeck.exe` → 发 Release」的流水线，最后首次 commit 并 push 到 `github.com/ZephyrBD/Danmudeck`。

**Architecture:** Bun 工作区（根 `package.json` + `client/` + `server/`）；`scripts/bundle.ts` 用 `bun build --compile` 把 `server` 与内嵌的 `client/dist` 打成一个 Windows exe；CI 在 `windows-latest` 上跑同一套命令。

**Tech Stack:** Bun 1.4、Vue 3 + TS + Vite、Express + ws、GitHub Actions（`oven-sh/setup-bun@v2`、`softprops/action-gh-release@v2`）。

**Spec:** `docs/superpowers/specs/2026-11-20-repo-cleanup-and-release-design.md`

## Global Constraints

- 不得删除或提交：`server/.env`、`server/data/`、`client/dist/`、`node_modules/`、`danmudeck.exe`、`blivedm/`、`新建文件夹/`、`.playwright-cli/`。
- 所有测试命令必须保持全绿：client 66 pass / server 84 pass / 两边 typecheck 通过。
- `.env` 已废弃：README 与示例配置不得再指示用户编辑 `.env`。
- commit 前必须获得用户确认（个人 AGENTS.md）；一次任务中途禁止分次 commit。
- 远端：`https://github.com/ZephyrBD/Danmudeck.git`，分支 `main`；HTTPS 遇 SSL 错误改 SSH。

## Review Focus

- **用户 clone 后按 README 操作**：`bun run dev` 应能起服务，README 里不能出现已删除文件（`danmudeck-bundle.js`、`npm test`、`.env`）。
- **CI 首次运行**：`client/dist` 不存在时 `bundle.ts` 先 `bun run build`；`--frozen-lockfile` 需要三个 lock 文件都存在。
- **Release 资产**：tag 名带 `v` 前缀时 GitHub 标题与 tag 一致，exe 必须 > 10 MB 才发布。
- **`git status` 干净**：首次提交后不得出现未跟踪的构建残留（`.workflow/`、`probe-out.txt`）。
- **git 哈希**：CI `checkout` 不带 `fetch-depth: 0` 时页脚会显示 `dev`。

---

### Task 1: 删除死文件、归档开发日志、清理 .gitignore

**Files:**
- Delete: `scripts/bundle.js`、`package-lock.json`、`danmudeck-bundle.js`、`bundle.log`、`client/probe-out.txt`、`client/test-results/`、`Design-md.md`、`client/README.md`、`client/public/help/`
- Move: `.workflow/` → `C:/Users/LXY29/AppData/Local/Temp/opencode/danmudeck-workflow-archive/`
- Modify: `.gitignore`

**Interfaces:**
- Produces: 干净的树；后续任务不再引用上述路径。

- [ ] **Step 1: 删除死文件**

```bash
rm -f scripts/bundle.js package-lock.json danmudeck-bundle.js bundle.log Design-md.md client/README.md client/probe-out.txt
rm -rf client/test-results client/public/help
```

- [ ] **Step 2: 归档开发日志（移出仓库，不进 git 历史）**

```bash
mkdir -p "$LOCALAPPDATA/Temp/opencode/danmudeck-workflow-archive"
mv .workflow/* "$LOCALAPPDATA/Temp/opencode/danmudeck-workflow-archive/" && rmdir .workflow
```

- [ ] **Step 3: 清理 `.gitignore`**

把文件整体替换为下面内容（移除已删条目，补上新的本地产物与归档目录）：

```gitignore
# Runtime / sensitive
server/.env
server/.env.local
server/data/

# Logs
dev.log
*.log

# Build output
client/dist
dist
danmudeck.exe
scripts/static.gen.ts

# Test / debug residue
client/test-results/
client/probe-out.txt

# Process artifacts (layout rework screenshots etc.)
.workflow/

# Dependencies
node_modules/
server/node_modules/
client/node_modules/

# Local scratch / vendored / stale artifacts
.playwright-cli/
blivedm/
新建文件夹/

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 4: 验证**

Run: `git status --short --ignored=no | head -30`
Expected: 只剩将提交的源码/文档；`git status --short --ignored | grep -E "danmudeck-bundle|bundle.log|test-results|probe-out"` 无输出。

---

### Task 2: 更新 README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: 用户与 CI 都可依赖的唯一使用说明；后续 `.github/workflows/release.yml` 的命令与 README 一致。

- [ ] **Step 1: 重写 `README.md`**

结构（按此顺序，内容为当前事实）：

1. 标题 + 一句话简介（B 站直播弹幕 / SC / 排队管理台，Vue 3 + Bun）。
2. **下载使用**：从 [Releases](https://github.com/ZephyrBD/Danmudeck/releases) 下载 `danmudeck.exe`，双击运行，浏览器开 `http://localhost:3000`，首次进入扫码登录；配置与凭据写在 exe 同目录的 `data/settings.json` 与 `data/auth.json`。
3. **开发**：`bun install`（含 `--cwd server` / `--cwd client`，或 `bun run install:all`）；`bun run dev`；`bun run build`；`bun run bundle`；`bun run test:client`；`bun run test:server`；两条 typecheck。代理规则 `/api`、`/ws` → `:3000`。要求 Bun ≥ 1.2。
4. **配置**：以 `server/config.example.json` 为例（roomId / queue / overlay / giftRules），运行时实际文件是 `server/data/settings.json`；说明 `.env` 已废弃，`PORT` 仍可由环境变量覆盖。
5. **功能**（沿用原列表，去掉已完成/未实现描述不一致处）。
6. **架构**（原图保留）。
7. **发布**：推 `v*` tag 触发 Actions，构建 exe 并发布 Release；手动触发只产出 artifact。
8. **目录结构**：`client/`、`server/`（`config.ts settings.ts danmaku.ts packet.ts wbi.ts login.ts queue.ts gifts.ts giftpb.ts`）、`scripts/`（`bundle.ts`、`bundle-entry.ts`）、`.github/workflows/`。
9. **许可**：MIT，2018~当前年份 Modding Craft ZBD Studio。

- [ ] **Step 2: 验证无死引用**

Run: `grep -nE "danmudeck-bundle|npm (run|test|install)|\.env" README.md`
Expected: 仅命中 `.env` 那一句「已废弃」的说明；不得出现 `danmudeck-bundle` 与 `npm`。

---

### Task 3: 配置示例改为 JSON

**Files:**
- Delete: `server/.env.example`
- Create: `server/config.example.json`
- Modify: `.gitignore`（若需，`server/data/` 已覆盖实际文件，无需改）

**Interfaces:**
- Consumes: `AppSettings` 形状来自 `server/settings.ts`（`roomId`、`queue.{enterKey,leaveKey}`、`overlay.{showChat,chatMax,scMax,showQueue,queueMax,queueMode,queueFlowSpeed,queueFlowPause}`、`giftRules`）。
- Produces: README 中引用的 `server/config.example.json`。

- [ ] **Step 1: 写 `server/config.example.json`**

```json
{
  "roomId": null,
  "queue": { "enterKey": "排队", "leaveKey": "取消排队" },
  "overlay": {
    "showChat": 1,
    "chatMax": 8,
    "scMax": 3,
    "showQueue": 1,
    "queueMax": 6,
    "queueMode": "list",
    "queueFlowSpeed": 3,
    "queueFlowPause": 2
  },
  "giftRules": []
}
```

`giftRules` 默认为空数组，由管理页「礼物规则」面板写入；规则形状见 `server/gifts.ts` 的 `GiftRule`。

- [ ] **Step 2: 与默认值对齐**

Run: `sed -n '50,120p' server/settings.ts`
Expected: 逐字段核对上面的数值；不一致则以 `settings.ts` 的 `DEFAULT_SETTINGS` 为准修改 JSON。

- [ ] **Step 3: 删除旧模板并验证**

```bash
rm -f server/.env.example
grep -rn "env.example" --include=*.md --include=*.ts --include=*.json . --exclude-dir=node_modules --exclude-dir=.git
```
Expected: 无输出。

---

### Task 4: e2e 脚本去掉个人路径

**Files:**
- Modify: `client/e2e/screenshots.ts:1-10`

**Interfaces:**
- Produces: `CHROME_PATH` 环境变量是唯一覆盖入口；未设置时用 playwright 默认解析。

- [ ] **Step 1: 替换头部常量**

```ts
const CHROME = process.env.CHROME_PATH
```

删除 `DEFAULT_CHROME` 常量与 `fs.existsSync` 回退；`chromium.launch({ executablePath: CHROME })` 在 `CHROME` 为 `undefined` 时走默认安装位置。同时把头注释改为「用全局 playwright：`bun client/e2e/screenshots.ts`；如需指定浏览器，设 `CHROME_PATH`」。

- [ ] **Step 2: 验证类型**

Run: `cd client && bun run typecheck`
Expected: 通过（该文件不在 tsconfig include 内亦可，命令不得报错）。

---

### Task 5: GitHub Actions 发布流水线

**Files:**
- Create: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: 根脚本 `test:client` `test:server` `typecheck:client` `typecheck:server` `bundle`；产物路径 `danmudeck.exe`。
- Produces: tag `v*` push 后的 GitHub Release 资产 `danmudeck.exe`。

- [ ] **Step 1: 写 workflow**

```yaml
name: release

on:
  push:
    tags: ['v*']
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.4
      - name: Install
        run: |
          bun install --frozen-lockfile
          bun install --frozen-lockfile --cwd server
          bun install --frozen-lockfile --cwd client
      - name: Typecheck
        run: |
          bun run typecheck:client
          bun run typecheck:server
      - name: Test
        run: |
          bun run test:client
          bun run test:server
      - name: Bundle exe
        run: bun run bundle
      - name: Verify artifact
        shell: pwsh
        run: |
          $size = (Get-Item danmudeck.exe).Length
          if ($size -lt 10MB) { throw "danmudeck.exe too small: $size" }
      - uses: actions/upload-artifact@v4
        with:
          name: danmudeck-windows
          path: danmudeck.exe
      - uses: softprops/action-gh-release@v2
        if: startsWith(github.ref, 'refs/tags/v')
        with:
          files: danmudeck.exe
          generate_release_notes: true
          draft: false
```

- [ ] **Step 2: 校验 YAML 语法**

Run: `bun -e "const y=await Bun.file('.github/workflows/release.yml').text(); if(!y.includes('softprops/action-gh-release')) throw new Error('bad'); console.log('ok')"`
Expected: `ok`（真正执行留给首次 tag 时的 CI 日志）。

---

### Task 6: 本地整体验收

- [ ] **Step 1: 全部门禁**

```bash
bun run typecheck:client && bun run typecheck:server
bun run test:client && bun run test:server
bun run bundle
```
Expected: client 66 pass、server 84 pass、`[bundle] 完成: ...\danmudeck.exe（xx MB）`。

- [ ] **Step 2: 树检查**

Run: `git ls-files --others --exclude-standard`
Expected: 只列出源码与文档（无 `node_modules/`、`client/dist/`、`data/`、`.env`、`*.exe`）。

---

### Task 7: 首次提交与推送

**Files:** 无（git 操作）

- [ ] **Step 1: 征得用户同意**（个人规则：commit 必须先确认）

向用户展示 `git ls-files --others --exclude-standard` 清单与拟用提交信息，等待确认。

- [ ] **Step 2: 初始化分支与提交**

```bash
git checkout -b main
git add -A
git commit -m "chore: 仓库整理与 exe 自动发布流水线"
```

- [ ] **Step 3: 添加远端并推送**

```bash
git remote add origin https://github.com/ZephyrBD/Danmudeck.git
git push -u origin main
```
Expected: 成功；若 TLS 报错，改 `git@github.com:ZephyrBD/Danmudeck.git` 后重试。

- [ ] **Step 4: 打首个 tag（发布验收）**

```bash
git tag v2.0.0 && git push origin v2.0.0
```
Expected: Actions 绿，Releases 页出现 `v2.0.0` 且带 `danmudeck.exe`。
