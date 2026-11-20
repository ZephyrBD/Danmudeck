# DanmuDeck 布局改造 · 实施计划

- 日期：2026-11-20
- 范围：`client/`（Vue 3 + TS + Element Plus）、`server/`（Bun + Express）、`client/package.json`
- 状态：方案已由用户逐项裁定，待实现
- 文档位置：按用户要求放在项目当前目录（本文件）；实现过程记录另在 `.workflow/outputs/20261120-layout-rework/`

---

## 1. 目标

1. 未登录时全屏居中二维码；未登录页不渲染顶栏与页脚，只保留品牌与模式按钮。
2. 登录后：顶栏（品牌 / 登录态 / 房间 / 直播状态 / 弹幕·SC / 模式 / 帮助 / 退出）+ 三等分三列（设置页签 / 队列 / 弹幕）+ 页脚。
3. 设置列改为 Seg 页签：直播间 | 排队词 | 覆盖 | 规则。
4. OBS 覆盖卡片顶部加两个新标签页按钮，直达 `/overlay/chat` 与 `/overlay/queue`；保留全部原有设置。
5. 队列：JSON 保存/加载（全量、合并预览可勾选与拖拽）、已完成/全部计数、原有危险操作降级为图标按钮、行内显示入队时间与排队时长。
6. 覆盖页排队新增「流动」形态：溢出当前显示条数时自动下翻、底部停留、再翻回。
7. 帮助弹窗：`marked` 渲染图文教程（直播姬 + OBS），图片用 md 占位。
8. 顶栏「退出登录」：彻底退出并自动出新二维码。
9. 页脚显示 git commit 短哈希（`git init` 后取真实值）。
10. **配置持久化从 `.env` 迁移到 `server/data/settings.json` + `server/data/auth.json`。**

---

## 2. 已裁定决策（用户答复原文）

| # | 决策点 | 结论 |
|---|--------|------|
| D1 | 队列保存/加载落点 | 导出/导入 JSON 文件 |
| D2 | 流动效果落点 | 仅覆盖页第三种形态 |
| D3 | 顶栏信息取舍 | 只去掉人气（保留连接点、直播状态、弹幕/SC） |
| D4 | 未登录页范围 | 只保留品牌 + 模式按钮 |
| D5 | 登录态文案 | B 站昵称（改 server） |
| D6 | 帮助按钮 | dialog，图文教程；图由用户提供，先用 md 语法描述占位 |
| D7 | OBS 卡片 | 按钮 + 保留全部设置 |
| D8 | 队列计数 | 已完成 / 全部 |
| D9 | commit 哈希 | 先 `git init` 再取；首提交前给用户确认清单 |
| D10 | 导入语义 | 导出全量；导入按 uid 合并，更早入队者优先；顺序按导出时的数组顺序 |
| D11 | 合并后排序 | 文件仅靠数组顺序表达顺序；同 uid 保留 `joinedAt` 更早者 |
| D12 | 流动节奏 | 可配置：滚动速度（秒/屏）+ 底部停留（秒） |
| D13 | 教程覆盖 | 直播姬 + OBS 两段 |
| D14 | 导出范围 | 全量（含已完成） |
| D15 | marked 安全 | 直接 `v-html`（本地受信 md，不引入 DOMPurify） |
| D16 | 教程图片 | `client/public/help/`，md 写 `/help/xxx.png` |
| D17 | 流动触发 | 溢出当前设置的显示条数（`queueMax`）时才动 |
| D18 | 加载交互 | 预览，预览中允许勾选 + 拖拽排序 |
| D19 | 顶栏排布 | 左信息、右操作 |
| D20 | 流动渲染范围 | 全部渲染未完成条目，容器限高为 `queueMax` 行 |
| D21 | 导入接口 | 前端合并，`POST /api/queue/import` 由 server 校验后整体替换 |
| D22 | 帮助页重登入口 | 只放教程；重登走顶栏「退出登录」 |
| D23 | 退出按钮位置 | 顶栏右侧图标 |
| D24 | 退出行为 | 清认证、停连接、`loginRequired=true`、自动生成新二维码回全屏扫码页 |
| D25 | 入队时间 | 界面加“入队”标注与“已排队 X 分钟”；JSON 带 `joinedAt` / `completedAt` / `skippedAt` |
| D26 | 方案完整性 / 顺序 / 汇报 | 完整可开工；默认顺序；每个功能块汇报 |
| D27 | 配置存储拆分 | `settings.json`（配置）+ `auth.json`（Cookie/UID/昵称） |
| D28 | 旧 `.env` | 不读取、不修改、不删除，原样留在 `server/.env` |
| D29 | 数据目录 | `server/data/`，整个目录加入 `.gitignore` |

---

## 3. 目标布局

### 3.1 未登录

```
┌──────────────────────────────────────────────────────────────┐
│ 弹幕台 DanmuDeck                                        ☾     │
│                                                              │
│                 ┌─────────┐   请用 B 站 App「扫一扫」登录      │
│                 │   QR    │   打开 B 站 App → 扫一扫 → 扫码并确认│
│                 │ 240×240 │   （已扫码时提示在手机上确认）      │
│                 └─────────┘   已过期时显示「重新生成二维码」    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 登录后

```
┌ 弹幕台 DanmuDeck │ ● 昵称  房间：12345      直播中  弹幕 0 ｜ SC 0  ☾  ?  ⏻ ┐
├──────────────────┬──────────────────┬───────────────────────────────────────┤
│ 直播间│排队词│覆盖│规则 │ 队列 ⤓ ⤒ 🧹 🗑  12/18 │ 弹幕                         清空 │
│ ──────────────── │ ──────────────── │ ─────────────────────────────────────── │
│ 页签内容（滚动）  │ 拖拽队列列表      │ 信息流（弹幕/SC/礼物）+ 回到最新        │
│                  │ 入队 14:02 · 8 分钟│                                        │
└──────────────────┴──────────────────┴───────────────────────────────────────┘
DanmuDeck a1b2c3d · Licensed under MIT, 2018~2026 Modding Craft ZBD Studio
```

- 三列 `1fr 1fr 1fr`，gap 24px，外层 padding 24px 32px；每列内部独立滚动。
- 768px 以下纵向堆叠（沿用 07 §9 的两档断点）。

---

## 4. 配置持久化（新）

### 4.1 目录与忽略

```
server/
├── data/                  # 整个目录 gitignore
│   ├── settings.json      # 配置
│   └── auth.json          # 登录凭据（敏感）
├── .env                   # 不读、不写、不删（D28）
└── config.ts
```

### 4.2 `server/data/settings.json`

```json
{
  "roomId": 1774678,
  "queue": {
    "enterKey": "排队",
    "leaveKey": "取消排队"
  },
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

- `roomId` 允许 `null`（自动取扫码用户直播间）。
- `giftRules` 沿用现有 `GiftRule[]` 形状：`{ giftId, giftName, threshold, mode, steps }[]`。
- 首次启动文件不存在时用默认值创建；写入用 2 空格缩进 + 末尾换行。

### 4.3 `server/data/auth.json`

```json
{
  "cookie": "SESSDATA=...; bili_jct=...; DedeUserID=...",
  "uid": 10001,
  "uname": "你的昵称",
  "updatedAt": "2026-11-20T08:30:00.000Z"
}
```

- 扫码成功、Cookie 校验成功、退出登录时写入/清空。
- `uname` 同时进入 `/api/status` 的 snapshot。
- 退出登录：`cookie=""`、`uid=0`、`uname=""`。

### 4.4 读取优先级

1. `server/data/*.json` 为唯一来源；
2. `.env` 完全不读（D28）；
3. `PORT` 仍来自进程环境变量（部署参数，不进 settings.json）；
4. 启动校验：`roomId` 为正整数或 `null`，`queueMode` ∈ `list|horizontal|flow`，数值型字段按现有上限校验，非法值回退默认并打日志。

---

## 5. 文件级改动

### 5.1 新增

| 文件 | 职责 |
|------|------|
| `server/settings.ts` | 读写 `data/settings.json` / `data/auth.json`；默认值、校验、原子写（临时文件 + rename） |
| `client/src/view/manage/components/LoginPage.vue` | 全屏扫码页 |
| `client/src/view/manage/components/HelpDialog.vue` | 教程弹窗（marked 渲染 + 两地址复制） |
| `client/src/view/manage/components/QueueImportDialog.vue` | 导入预览（统计 / 勾选 / 拖拽 / 确认） |
| `client/src/view/manage/composables/queueFile.ts` | `buildExportFile` / `parseQueueFile` / `mergePreview` |
| `client/src/help/help.md` | 直播姬 + OBS 图文教程，图片占位 `/help/*.png` |
| `client/public/help/.gitkeep` | 截图目录占位 |
| `client/src/__tests__/queue-file.spec.ts` | 导出 / 解析 / 合并单测 |
| `server/test/settings.test.ts` | settings/auth 读写与校验 |
| `server/test/queue-import.test.ts` | 导入接口校验与整体替换 |

### 5.2 修改

| 文件 | 改动 |
|------|------|
| `server/config.ts` | 改为从 `settings.ts` 读取；删除 `process.env` 配置读取（PORT 除外）；覆盖默认值加流动字段 |
| `server/login.ts` | 删除 `saveEnv()`，改为 `saveAuth()`；扫码成功写 `auth.json` |
| `server/index.ts` | `state.uname`；snapshot 带 `uname`；`/api/logout`；`/api/queue/import`；`/api/overlay` 放行 `flow` + 校验流动字段；房间号/排队词/覆盖/礼物规则全部写 `settings.json` |
| `server/test/api.test.ts` | 覆盖流动字段与非法值 |
| `client/src/view/manage/index.vue` | 未登录/已登录二态；顶栏 + 三等分三列 + 页脚 |
| `client/src/view/manage/components/StatusBar.vue` | 左信息右操作；昵称；删人气；模式 / 帮助 / 退出 |
| `client/src/view/manage/components/SettingsGrid.vue` | `el-segmented` 页签 + 单卡内容区 |
| `client/src/view/manage/components/QueueWidget.vue` | 图标按钮、`已完成/全部`、保存/加载、入队时间 |
| `client/src/view/manage/components/QueueRow.vue` | “入队 HH:mm:ss · 已排队 X 分钟” |
| `client/src/view/manage/components/OverlaySettingsWidget.vue` | 两个外链按钮；排队形式加「流动」+ 速度/停留 |
| `client/src/view/overlay/queue/index.vue` | `flow` 渲染与翻页动画 |
| `client/src/App.vue` | 移除 fixed 主题按钮 |
| `client/src/types/models.ts` | `QueueMode += 'flow'`；`OverlayData` 加流动字段；`StatusData += uname?` |
| `client/src/store/manage.ts` | `uname` 透传；`booted` 防首帧闪 |
| `client/src/api/index.ts`、`api/settings.ts` | `importQueue`、`logout`、覆盖保存体扩展 |
| `client/src/vite-env.d.ts` | `declare const __GIT_COMMIT__: string` |
| `client/vite.config.ts` | 构建时注入 git 短哈希，失败回退 `dev` |
| `client/package.json` | 新增 `marked` |
| `.gitignore` | 增加 `server/data/` |

### 5.3 不改

- 路由与覆盖页 chat。
- 弹幕/SC/礼物解析、礼物规则匹配逻辑。
- `/api/status` 其余字段形状（只增 `uname`）。

---

## 6. 接口契约

### 6.1 `GET /api/status`（扩展）

`snapshot()` 增加 `uname: string`。

### 6.2 `POST /api/logout`

清空 `auth.json` → `client.stop()` → `state.uid = 0`、`state.uname = ''`、`state.statusText = '等待扫码登录'`、`state.loginRequired = true` → `login.start()` → `broadcast('status', snapshot())`；响应 `{ ok: true }`。

### 6.3 `GET/POST /api/overlay`（扩展）

```ts
queueMode: 'list' | 'horizontal' | 'flow'
queueFlowSpeed: number   // 秒/屏，默认 3，1–15
queueFlowPause: number   // 底部停留秒，默认 2，0–15
```

越界或非整数返回 400；成功后写 `settings.json` 并 `broadcast('overlay')`。

### 6.4 `POST /api/queue/import`

```ts
// 请求
{ items: Array<{ uid: number; user: string; color?: string; joinedAt: number;
                 done: boolean; completedAt?: number; skippedAt?: number }> }
// 响应
{ ok: true; queue: QueueListEntry[] }
```

校验：≤1000 条；`uid` 正整数且不重复；`user` 截断 50 字；`joinedAt` 有限数字；`done` 布尔；已完成项 `completedAt` 缺省补当前时间。执行：按数组顺序整体替换，位置重算，广播队列。

---

## 7. 队列导出 JSON

```json
{
  "app": "danmudeck",
  "schema": 1,
  "exportedAt": "2026-11-20T08:30:00.000Z",
  "items": [
    { "uid": 10001, "user": "观众甲", "color": "#1abcfe", "joinedAt": 1763600000000, "done": false, "completedAt": 0 },
    { "uid": 10002, "user": "观众乙", "color": "", "joinedAt": 1763600060000, "done": false, "completedAt": 0, "skippedAt": 1763600090000 },
    { "uid": 10003, "user": "观众丙", "color": "", "joinedAt": 1763600120000, "done": true, "completedAt": 1763600200000 }
  ]
}
```

- 数组顺序 = 导出时队列顺序（含插队结果）。
- 文件名 `danmudeck-queue-YYYYMMDD-HHmm.json`。
- 解析容错：非对象 / `items` 非数组 → 提示“这不是 DanmuDeck 的队列文件”；单条非法 → 跳过并计入“忽略”。

---

## 8. 合并与预览

1. 以本机队列顺序为骨架。
2. 文件独有条目 → 默认勾选，按文件顺序追加到末尾。
3. 同 uid：本机 `joinedAt` 更早 → 默认不勾选（保留本机）；文件更早 → 默认勾选，**原位**替换本机记录。
4. 预览中可取消勾选、拖拽排序；统计“新增 / 替换 / 保留 / 忽略”。
5. 确认后按预览顺序提交 `/api/queue/import`。

---

## 9. 覆盖页流动

- `flow` 时渲染全部未完成条目，容器高度 = 单行高度 × `queueMax`（`ResizeObserver` 测量）。
- 内容溢出才启动：下翻 `queueFlowSpeed` 秒 → 底部停 `queueFlowPause` 秒 → 同速回顶 → 循环。
- 新条目到达时重算并回顶；`prefers-reduced-motion: reduce` 时静止显示前 `queueMax` 条。

---

## 10. 任务分解（默认顺序）

| T | 内容 | 文件 |
|---|------|------|
| T0 | `git init` + 确认 `.gitignore`（含 `server/data/`） | 仓库根 |
| T1 | `server/settings.ts` + `config.ts` / `login.ts` 改造（脱离 `.env`） | `server/*` |
| T2 | server：`uname` / `/api/logout` / overlay 流动字段 / `/api/queue/import` | `server/index.ts`、测试 |
| T3 | 类型与 API 层 | `types/models.ts`、`api/*` |
| T4 | 未登录全屏页 + 二态切换 | `LoginPage.vue`、`manage/index.vue`、`store/manage.ts`、`App.vue` |
| T5 | 顶栏重构 | `StatusBar.vue` |
| T6 | 三等分布局 + 页脚哈希 | `manage/index.vue`、`vite.config.ts`、`vite-env.d.ts` |
| T7 | Seg 页签设置列 | `SettingsGrid.vue` |
| T8 | 队列栏：计数、图标按钮、入队时间 | `QueueWidget.vue`、`QueueRow.vue` |
| T9 | 队列 JSON 保存/加载 + 预览 | `queueFile.ts`、`QueueImportDialog.vue` |
| T10 | OBS 卡片：外链 + 流动设置 | `OverlaySettingsWidget.vue` |
| T11 | 覆盖页流动动画 | `overlay/queue/index.vue` |
| T12 | 帮助 md + marked | `help.md`、`HelpDialog.vue`、`package.json` |
| T13 | 单测补齐 + 四闸门 + 实跑截图 | 测试与交付 |

---

## 11. 验收闸门

```bash
cd client && bun run typecheck
cd server && bun run typecheck
cd client && bun run test
cd server && bun run test
cd client && bun run build
```

新增单测：settings/auth 读写、导出结构、解析容错、合并（更早优先 / 顺序保持）、流动字段校验。
实跑截图 ≥4 张：未登录扫码页、登录后三列、导入预览、覆盖页流动。
失败按 `docs/AGENTS.md` §6.3 分级处置；禁止 `any` / `@ts-ignore` / 关断言。

---

## 12. 轻决策公示（可推翻）

| # | 决策 | 选择 | 影响文件 |
|---|------|------|----------|
| L1 | 页签组件 | `el-segmented` | SettingsGrid.vue |
| L2 | 页签文案 | 直播间 / 排队词 / 覆盖 / 规则 | SettingsGrid.vue |
| L3 | 礼物规则卡标题 | 保留「礼物插队规则」 | GiftRulesWidget.vue（不改） |
| L4 | 帮助 / 退出图标 | `QuestionFilled` / `SwitchButton` | StatusBar.vue |
| L5 | 队列图标 | 保存 `Download`、加载 `Upload`、清除已完成 `Brush`、清空 `Delete` | QueueWidget.vue |
| L6 | 清空确认 | `ElMessageBox.confirm` | QueueWidget.vue |
| L7 | 流动默认值 | 3 秒/屏、停留 2 秒 | settings 默认值 |
| L8 | 页脚格式 | `DanmuDeck {hash} · Licensed under MIT, 2018~{year} Modding Craft ZBD Studio` | manage/index.vue |
| L9 | JSON 写入 | 2 空格缩进 + 末尾换行 + 临时文件原子替换 | server/settings.ts |
| L10 | 配置校验失败 | 回退默认值并打日志，不阻塞启动 | server/settings.ts |

---

## 13. 未决 / 风险

| 项 | 说明 | 处置 |
|----|------|------|
| 导入并发 | 预览期间新入队条目会被整体替换覆盖 | 交付说明登记 |
| 流动测量 | 行高随昵称变化 | `ResizeObserver` + 重启 |
| 未登录首帧 | `loginRequired` 初始 false 会闪 | store `booted` |
| 旧 `.env` | 不读不写不删 | 交付说明提醒可手动清理 |
| `marked` | 新增运行时依赖（已获准） | 锁版本，直接 `v-html` |
| 首提交 | 需用户确认文件清单与提交信息 | T0 前置 |
