# Bilibili 直播弹幕拉取 — 设计文档

日期：2026-08-20

## 目标

用 Vue 技术方案，从 Bilibili 直播间拉取实时弹幕并以文字流列表展示。直播间号通过配置文件自定义（如 `https://live.bilibili.com/1909416236` 中的 `1909416236`）。

## 需求

- 实时弹幕滚动列表（文字流），展示用户名、时间、文字内容。
- 额外展示醒目留言（SC，SuperChat），带高亮和金额。
- 直播间号写在后端配置文件（`.env` / `config.js`），前端打开页面自动连接并展示。
- 架构：Vue 前端 + Node.js 后端代理。

## 架构

```
Vue 3 (Vite) 前端  ←WebSocket→  Node.js 后端  ←WBI签名+WebSocket→  Bilibili 直播间
```

后端负责所有 B 站对接工作（WBI 签名、token 获取、弹幕 WebSocket 连接、二进制解压解析、自动重连），前端只负责展示。

## 技术背景（2026-08 验证）

- `getDanmuInfo` 接口自 2025-05 起强制要求 WBI 签名（`wts` + `w_rid`），自 2025-06 起要求 `buvid3` Cookie。
- B 站 API 存在浏览器 CORS 限制，无法从纯前端直连。
- 匿名连接（uid=0）可能被风控拒绝，用户名会被掩码为 `*`，因此后端支持可选登录 Cookie 提升稳定性。

### WebSocket 协议要点

- 连接地址：`wss://{host}:{wss_port}/sub`

- 数据包：16 字节头 + body
  
  - 包头：`packetLen`(4) `headerLen=16`(2) `protoVersion`(2) `op`(4) `seq`(4)
  - protoVersion：0/1 无压缩，2 zlib，3 brotli
  - op：2 心跳，3 心跳回执，5 消息，7 认证，8 认证回执

- 认证包（op 7，连接后立即发送，5 秒内必须发出）：
  
  ```json
  { "uid": 0, "roomid": <真实room_id>, "protover": 3, "platform": "web", "type": 2, "key": "<token>" }
  ```

- 心跳：每 30 秒发送 op 2（空 body）。

- 弹幕消息：op 5，`cmd=DANMU_MSG`，`info[1]`=文本，`info[2][1]`=用户名，`info[0][4]`=时间戳(ms)。

- SC 消息：`cmd=SUPER_CHAT_MESSAGE`，`data.user.uname`=用户名，`data.message`=内容，`data.price`=金额，`data.start_time`/`end_time`。

## 后端设计（`server/`）

### 配置（`config.js`）

| 字段                | 说明                                              |
| ----------------- | ----------------------------------------------- |
| `ROOM_ID`         | 直播间号（URL 中数字），如 `1909416236`                    |
| `PORT`            | 后端服务端口，默认 `3000`                                |
| `BILIBILI_COOKIE` | 可选，B 站登录 Cookie（`SESSDATA=...`），提升连接稳定性并显示真实用户名 |
| `BILIBILI_UID`    | 可选，与 Cookie 对应的 uid                             |

### 模块

- **`packet.js`** — 二进制协议编解码
  - `encode(op, body)`：生成 16 字节头 + body
  - `decode(buffer)`：解析包头，按 protoVersion 解压（Node 内置 `zlib.inflateSync` / `zlib.brotliDecompressSync`），拆分包内多条 JSON 消息
- **`wbi.js`** — WBI 签名
  - 拉取 `/x/web-interface/nav` 的 `data.wbi_img.img_url` / `sub_url` → 取文件名（去扩展名）拼接 → 按 mixin 表重排取前 32 位
  - 业务参数 + 秒级时间戳 `wts` → 按参数名升序排序 URL encode → `md5(query + mixin_key)` 作为 `w_rid`
- **`danmaku.js`** — B 站弹幕客户端类
  - `room_init` 解析短房间号 → 真实 room_id
  - `getDanmuInfo`（WBI 签名）→ token + host_list
  - 连接 `wss://host/sub` → 发认证包 → 30s 心跳
  - 解析 op 5 消息，过滤 `DANMU_MSG` / `SUPER_CHAT_MESSAGE`，通过事件回调输出
  - 断线指数退避自动重连；错误映射为状态：`connected` / `connecting` / `disconnected` / `error` / `room_not_found` / `not_live` / `risk_control`
- **`index.js`** — express + ws 服务
  - `GET /api/status` → 当前房间 / 连接状态 / 累计弹幕数 / SC 数
  - `WS /ws` → 向前端广播 `danmu` / `superchat` / `status` 事件

## 前端设计（`client/`，Vue 3 + Vite）

- `vite.config.js`：dev 代理 `/api` 与 `/ws` 到后端（`ws: true`）
- `src/ws.js`：前端 WebSocket 封装，自动重连
- `src/App.vue`：布局 = 顶部状态栏 + 弹幕列表
- 组件：
  - `StatusBar.vue` — 连接状态、房间号、弹幕/SC 计数
  - `DanmakuList.vue` — 列表容器，自动滚到底，手动上滑暂停自动滚动
  - `DanmakuItem.vue` — 普通弹幕行（用户名 + 时间 + 文字）
  - `SuperChatItem.vue` — SC 行（高亮背景 + 用户名 + 金额 + 内容）

## 目录结构

```
排队/
├── package.json          # 一键启动（concurrently）
├── README.md
├── docs/superpowers/specs/
├── server/
│   ├── package.json
│   ├── config.js
│   ├── index.js
│   ├── wbi.js
│   ├── danmaku.js
│   ├── packet.js
│   └── test/packet.test.js
└── client/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.js
        ├── App.vue
        ├── ws.js
        └── components/
            ├── StatusBar.vue
            ├── DanmakuList.vue
            ├── DanmakuItem.vue
            └── SuperChatItem.vue
```

## 错误处理

- 房间不存在 / 未开播 / 风控 → 状态栏显示具体原因，自动重试
- 弹幕连接断开 → 指数退避自动重连（重置 token 后重连）
- 前端 WS 断开 → 自动重连
- 用户列表 DOM 无限增长 → 限制列表长度（如最多 1000 条），超出丢弃最旧

## 测试

- `packet.js` 单元测试：构造已知帧（无压缩 / zlib / brotli 压缩的多消息帧）验证解码正确
- 连接真实房间手动验证弹幕与 SC 显示

## 依赖

- 后端：`express`、`ws`（压缩/解压用 Node 内置 `zlib`）
- 前端：`vue`（Vite 模板自带）
- 根目录：`concurrently`