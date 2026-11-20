# 仓库整理与自动发布设计

- 日期：2026-11-20
- 状态：已获用户批准
- 范围：仓库文件整理、README/文档更新、首次提交、GitHub Actions 发布流程

## 意图

DanmuDeck 布局改造已完成并通过全部门禁（client 66 pass / server 84 pass / 两边 typecheck 通过），但仓库里仍留着 v1 时代的打包脚本、构建产物与占位文件，README 描述的仍是 npm + `.env` + `danmudeck-bundle.js` 的旧形态。目标是让仓库只保留「当前真实可用」的内容，并把「打 tag → 自动出 exe → 发 Release」变成一条可重复的流水线。

## 决策（用户裁定）

| # | 决策点 | 结论 |
|---|--------|------|
| D1 | 清理力度 | 删死文件 + 把开发日志移出仓库 |
| D2 | 发布触发 | 推 `v*` tag 时构建并发布 GitHub Release；普通 push 不发布 |
| D3 | 远端 | `https://github.com/ZephyrBD/Danmudeck.git`，分支 `main` |

## 删除清单

| 路径 | 理由 |
|------|------|
| `scripts/bundle.js` | 旧 esbuild 单文件 js 打包器，已被 `scripts/bundle.ts`（Bun `--compile` 出 exe）取代 |
| `package-lock.json` | 仅为 `bundle.js` 的 esbuild 而存在；实际包管理是 bun（`bun.lock`） |
| `danmudeck-bundle.js`、`bundle.log` | `bundle.js` 的产物与日志 |
| `client/probe-out.txt` | 调试探针输出 |
| `client/test-results/` | vitest 运行残留 |
| `Design-md.md`（根） | 与 `docs/frontend/Design-md.md` 重复，且 docs 版已更新为 full-bleed 规范 |
| `client/README.md` | Vue 脚手架模板原文，无项目信息 |
| `client/public/help/` | 帮助已改为纯文字教程，目录仅剩 `.gitkeep` |
| `.workflow/` | 布局改造的截图与进度日志，属过程产物 → 移到 `C:\Users\LXY29\AppData\Local\Temp\opencode\danmudeck-workflow-archive` |

不动（本机未跟踪，不属于仓库内容）：`danmudeck.exe`、`client/dist/`、`node_modules/`、`blivedm/`、`新建文件夹/`、`.playwright-cli/`。

## 更新清单

- **`.gitignore`**：移除对已删文件的条目（`bundle.log`、`danmudeck-bundle.js`、`package-lock.json`）；新增 `client/probe-out.txt`、`client/test-results/`、`.workflow/`。
- **`README.md`**：改写成当前形态 —— Bun 工具链、`server/data/{settings,auth}.json` 持久化（`.env` 已废弃）、exe 单文件打包、GitHub Release 下载与自动构建说明、正确的目录结构与测试命令、MIT 许可声明。
- **`server/.env.example`**：改名 `server/config.example.json`，内容为 `AppSettings` 形状的 JSON（roomId / queue / overlay / giftRules），与 `settings.ts` 默认值同形。
- **`client/e2e/screenshots.ts`**：写死本机 playwright 缓存路径的 `executablePath` 回退改为仅读 `CHROME_PATH`，避免把个人路径带进公开仓库。
- **`.github/workflows/release.yml`**：新增。

## 发布流水线

```
push tag v*  →  windows-latest
  1. checkout（fetch-depth: 0，保证 vite 能取到短哈希）
  2. oven-sh/setup-bun@v2（固定版本）
  3. bun install --frozen-lockfile（根 / server / client）
  4. typecheck + test：client vue-tsc、vitest；server tsc、bun test
  5. bun run bundle  →  danmudeck.exe
  6. 校验 exe 存在且 > 10 MB
  7. softprops/action-gh-release：tag 名作标题，附 danmudeck.exe，generate_release_notes
```

另加 `workflow_dispatch` 手动触发（只构建 + 上传 artifact，不发 Release），便于验证流水线而不用打 tag。

## 非目标

- 不做多平台（Linux/macOS）构建；exe 是 Windows 目标产物。
- 不做自动 bump 版本号；版本由 tag 决定，`package.json` 的 version 手动维护。
- 不引入 CHANGELOG 工具。

## 风险

- **`client/dist` 在 CI 中不存在** → `bundle.ts` 会先 `bun run build`，满足前提。
- **`vite build` 在 detached HEAD 下取 git 哈希** → `checkout` 需 `fetch-depth: 0`，否则回退 `dev`（不致命）。
- **首次 push 走 HTTPS 可能 SSL 失败** → 按个人 AGENTS.md，改用 SSH remote。

## 验收

1. 本地：`bun run bundle` 能出 exe（或至少 `client build` + `server test` 通过，bundle 在 CI 首次 tag 时验证）。
2. `git status` 干净，`git ls-files` 不含 node_modules / dist / data / .env。
3. `git push origin main` 成功，远端可访问。
4. 打 `v2.0.0` tag 后 Actions 绿，Release 页出现带 `danmudeck.exe` 的资产。
