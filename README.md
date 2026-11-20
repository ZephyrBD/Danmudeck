# 弹幕台 DanmuDeck

B 站直播弹幕 / SC / 排队管理台。Vue 3 + Bun，支持二维码扫码登录、直播间管理、实时弹幕流、醒目留言展示、观众排队入队与委托完成，以及 OBS 覆盖页（弹幕+SC、排队）。

## 下载使用

从 [Releases](https://github.com/ZephyrBD/Danmudeck/releases) 下载 `danmudeck.exe`，双击运行，浏览器打开 <http://localhost:3000>：

- 首次运行进入扫码登录页，用 B 站 App 扫码即可。
- 登录成功后凭据写入 exe 同目录的 `data/auth.json`，配置写入 `data/settings.json`。
- 不需要安装 Node/Bun，也不需要额外的 `node_modules` 或 `client/dist`。

> 这两个 JSON 文件包含 B 站登录 Cookie 等敏感信息，**不要提交或分享**。

## 开发

需要 [Bun](https://bun.sh) ≥ 1.2。

```bash
bun run install:all      # 安装 server 与 client 依赖
bun run dev              # 同时启动后端(3000)与前端 Vite(5173，含代理)
bun run build            # 仅构建前端到 client/dist
bun run start            # 仅启动后端
bun run bundle           # 构建前端并打成单文件 danmudeck.exe
bun run test:client      # 前端单元测试（vitest）
bun run test:server      # 后端单元测试（bun test）
bun run typecheck:client
bun run typecheck:server
```

前端开发时 Vite 代理 `/api` → `http://localhost:3000`，`/ws` → `ws://localhost:3000`。

## 配置

运行时配置保存在 `server/data/settings.json`，凭据保存在 `server/data/auth.json`，都通过管理页写入，**一般不需要手改**。完整字段示例见 [`server/config.example.json`](server/config.example.json)。

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
    "queueFlow": 0,
    "queueFlowSpeed": 3,
    "queueFlowPause": 2
  },
  "giftRules": []
}
```

- `roomId` 为 `null` 时自动使用扫码账号的直播间。
- `overlay.queueMode`：排列方式，`list` 竖排 / `horizontal` 横排。
- `overlay.queueFlow`：流动开关（`0` 关 / `1` 开），超出「排队显示人数」时自动翻页；横排竖排都能开。速度与底部停留单位分别是秒/屏、秒。
- `giftRules` 由管理页「礼物规则」面板写入。
- 服务端口默认 3000，可用环境变量 `PORT` 覆盖。
- 旧的 `.env` 配置方式**已废弃**，程序不再读取；存在也无需删除。

## 功能

- 实时弹幕滚动列表（用户名 + 时间 + 文字，用户名颜色来自 B 站）
- 醒目留言（SC）带彩色背景卡条
- 连接状态显示（已连接 / 房间不存在 / 风控 / 断线自动重连）
- 弹幕 / SC 计数，清空列表，回到最新
- 直播间房间号设置；留空时自动使用扫码用户的直播间
- 入队 / 取消排队关键词配置；队列按 uid 去重；管理员可完成委托
- 队列 JSON 导出 / 导入（导入前可勾选与拖拽排序预览）
- 礼物插队规则：指定礼物累计到阈值后置顶或前进若干位
- 已完成队列条目保留并置灰，支持一键清除
- OBS 覆盖页：`/overlay/chat`、`/overlay/queue`，透明背景，可配置开关、条数与排队形态
- 二维码扫码登录、一键退出并重新生成二维码

## 架构

```
Vue 3 (Vite) 前端  ←WebSocket/HTTP→  Bun + Express 后端  ←WBI 签名 + WebSocket→  Bilibili 直播服务器
```

后端负责：WBI 签名、`getDanmuInfo` 获取 token/host、连接 B 站弹幕 WebSocket、解析二进制包、管理队列 / 登录态 / 覆盖页配置，并通过 WebSocket 向所有前端广播。前端只负责展示。

## 发布

推一个 `v*` 开头的 tag 即自动发布：

```bash
git tag v2.0.0
git push origin v2.0.0
```

GitHub Actions（`.github/workflows/release.yml`）会在 `windows-latest` 上跑类型检查与全部测试，再用 `bun run bundle` 打出 `danmudeck.exe`，最后创建同名 Release 并上传 exe。在 Actions 页面手动触发 `release` 工作流则只构建并上传 artifact，不发 Release。

## 目录结构

```
├── client/                  # Vue 3 + TS + Element Plus 前端
│   ├── src/
│   │   ├── api/             # HTTP / WebSocket 封装
│   │   ├── store/           # 管理页状态
│   │   ├── view/manage/     # 管理台（组件、设置面板、队列、弹幕）
│   │   ├── view/overlay/    # OBS 覆盖页（chat / queue）
│   │   ├── styles/          # 设计令牌与全局样式
│   │   └── help/            # 帮助教程（md，构建时内联）
│   └── e2e/                 # 实跑截图脚本（可选）
├── server/                  # Bun + Express 后端
│   ├── config.ts            # 配置聚合
│   ├── settings.ts          # settings.json / auth.json 读写与校验
│   ├── danmaku.ts           # B 站弹幕客户端（连接/认证/心跳/重连）
│   ├── packet.ts            # 二进制协议编解码
│   ├── wbi.ts               # WBI 签名
│   ├── login.ts             # 二维码登录
│   ├── queue.ts             # 排队管理
│   ├── gifts.ts / giftpb.ts # 礼物规则与 protobuf 解析
│   └── test/                # 单元测试
├── scripts/
│   ├── bundle.ts            # 构建 + 打包 exe
│   └── bundle-entry.ts      # 打包入口（注入静态资源表）
├── docs/                    # 前端开发规范与工作流
└── .github/workflows/       # CI 发布流水线
```

## 说明

- B 站 `getDanmuInfo` 接口需要 WBI 签名，且浏览器端存在 CORS 限制，因此必须走后端代理。
- 匿名连接（未配置 Cookie）时，部分房间会隐藏用户昵称或被风控；扫码登录可缓解。
- 登录成功后 Cookie 会自动保存到 `data/auth.json`，下次启动无需再扫码。

## 许可

MIT License，2018~2026 Modding Craft ZBD Studio。
