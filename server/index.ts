import * as http from 'http';
import * as path from 'path';
import express, { Express, Request, Response } from 'express';
import { WebSocketServer } from 'ws';
import config, { auth, settings } from './config';
import { DanmakuClient, STATUS } from './danmaku';
import { QrLogin, checkCookieLogin } from './login';
import { GiftEngine, normalizeRules, type GiftRule } from './gifts';
import { Queue, type QueueItemInput } from './queue';
import {
  saveSettings,
  saveAuth,
  clearAuth,
  QUEUE_MODES,
  OVERLAY_LIMITS,
  type AuthData,
  type OverlaySettings,
  type QueueMode,
} from './settings';

// 单文件打包时由 scripts/bundle-entry.ts 注入的静态文件表（Bun compile 模式）

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const app: Express = express();
app.use(express.json());

// 单文件打包时由 scripts/bundle-entry.ts 注入的静态文件表（Bun compile 模式）
const STATIC_FILES =
  ((globalThis as Record<string, unknown>).__STATIC_FILES__ as Record<string, { data: string; type: string }> | undefined) ?? null;
if (STATIC_FILES) {
  app.use((req: Request, res: Response, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const p = req.path;
    let key = p;
    if (key === '/' || key.endsWith('/')) {
      key = '/index.html';
    } else if (!p.startsWith('/api/') && !path.extname(p)) {
      key = '/index.html';
    }
    const entry = STATIC_FILES[key];
    if (!entry) return next();
    const buf = Buffer.from(entry.data, 'base64');
    res.setHeader('Content-Type', entry.type);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  });
} else {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  // SPA 回退：非 /api、无扩展名的 GET 请求统一回 index.html（history 路由直刷）
  app.get(/^(?!\/api\/).*/, (req: Request, res: Response, next) => {
    if (path.extname(req.path)) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set<any>();

const queue = new Queue({
  enterKey: config.queueEnterKey,
  leaveKey: config.queueLeaveKey,
});

const giftEngine = new GiftEngine(settings.giftRules.slice());

const state = {
  roomId: config.roomId,
  status: STATUS.IDLE as string,
  statusText: '未连接',
  error: '',
  online: 0,
  uid: config.uid || 0,
  uname: auth.uname || '',
  loginRequired: config.cookie === '',
};

// 凭据变更统一落盘到 data/auth.json，并同步 state（plan §4.3）
function storeAuth(patch: Partial<AuthData>): void {
  Object.assign(auth, patch, { updatedAt: new Date().toISOString() });
  saveAuth(auth);
}

const login = new QrLogin({
  onLoggedIn(cookie: string, uid: number) {
    state.loginRequired = false;
    state.uid = uid;
    state.statusText = '已登录，连接中…';
    cookieCheckDone = false;
    log(`[登录] 成功 uid=${uid}，Cookie 已保存到 data/auth.json`);
    client.setCredentials(cookie, uid);
    connectClient();
    broadcast('status', snapshot());
    void refreshUname(cookie);
  },
});

// 扫码成功后在后台补昵称（nav 接口），失败静默保留空昵称
async function refreshUname(cookie: string): Promise<void> {
  try {
    const r = await checkCookieLogin(cookie);
    if (r.state === 'valid' && r.uname) {
      state.uname = r.uname;
      storeAuth({ uname: r.uname });
      broadcast('status', snapshot());
    }
  } catch {
    /* 网络问题：昵称稍后由 Cookie 检查补齐 */
  }
}

function log(message: string): void {
  const time = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${time}] ${message}`);
}

function snapshot() {
  return {
    ...state,
    counters: client.counters,
    login: login.getStatus(),
    queue: queue.list(),
    overlay: settings.overlay,
    settings: {
      roomId: client.roomId,
      queueEnterKey: queue.enterKey,
      queueLeaveKey: queue.leaveKey,
    },
  };
}

function broadcast(type: string, payload: unknown): void {
  const data = JSON.stringify({ type, data: payload, ts: Date.now() });
  for (const ws of clients) {
    try {
      if (ws.readyState === 1) ws.send(data);
    } catch (e) {
      clients.delete(ws);
    }
  }
}

let cookieChecking = false;
let cookieCheckDone = false;

function handleCookieExpired(reason: string): void {
  if (state.loginRequired) return;
  log(`[登录] Cookie 已过期（${reason}），停止弹幕连接并自动发起扫码`);
  client.stop();
  client.clearCredentials();
  state.uid = 0;
  state.uname = '';
  state.loginRequired = true;
  state.statusText = 'Cookie 已过期，请重新扫码';
  state.error = '';
  // 过期凭据不再保留（plan D24 / §4.3：清认证 → loginRequired → 自动出新二维码）
  storeAuth({ cookie: '', uid: 0, uname: '' });
  broadcast('status', snapshot());
  const phase = login.getStatus().phase;
  if (phase !== 'generating' && phase !== 'waiting' && phase !== 'scanned') {
    login.start();
  }
}

async function runCookieCheck(reason: string): Promise<void> {
  if (cookieChecking || !client.cookie) return;
  cookieChecking = true;
  try {
    log(`[登录] 触发 Cookie 检查（${reason}）`);
    const r = await checkCookieLogin(client.cookie);
    if (r.state === 'invalid') {
      log(`[登录] Cookie 检查: 已过期 code=${r.code} message=${r.message}`);
      handleCookieExpired(reason);
    } else if (r.state === 'valid') {
      log(`[登录] Cookie 检查: 有效 uname=${r.uname}，排除过期原因，继续重连`);
      if (r.uname && r.uname !== state.uname) {
        state.uname = r.uname;
        storeAuth({ uname: r.uname });
        broadcast('status', snapshot());
      }
    } else {
      log(`[登录] Cookie 检查: 无法判断 code=${r.code} message=${r.message}，继续重连`);
    }
  } catch (e) {
    log(`[登录] Cookie 检查失败(网络): ${(e as Error).message}`);
  } finally {
    cookieChecking = false;
  }
}

async function resolveOwnRoomId(): Promise<number | null> {
  const uid = state.uid;
  if (!uid) return null;
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (client.cookie) headers.Cookie = client.cookie;
  try {
    const res = await fetch(`https://api.live.bilibili.com/live_user/v1/Master/info?uid=${uid}`, { headers });
    const json: any = await res.json();
    const roomId = json.data && json.data.room_id;
    if (json.code === 0 && roomId) {
      log(`[连接] 扫码用户 uid=${uid} 的直播间: ${roomId}`);
      return roomId;
    }
    log(`[连接] 获取扫码用户直播间失败: code=${json.code} message=${json.message}`);
  } catch (e) {
    log(`[连接] 获取扫码用户直播间出错: ${(e as Error).message}`);
  }
  return null;
}

async function connectClient(): Promise<void> {
  let target = client.roomId;
  if (!target) {
    const own = await resolveOwnRoomId();
    if (!own) {
      state.statusText = '未设置房间号';
      log('[连接] 未设置房间号，且无法自动获取直播间，请在管理页填写');
      broadcast('status', snapshot());
      return;
    }
    target = own;
    client.setRoom(own);
    state.roomId = own;
    settings.roomId = own;
    config.roomId = own;
    saveSettings(settings);
  }
  client.stop();
  client.connect();
}

const client = new DanmakuClient({
  roomId: config.roomId,
  cookie: config.cookie,
  uid: config.uid,
});

client.on('status', (payload: any) => {
  const { status, error, ...extra } = payload;
  state.status = status;
  state.error = error || '';
  const map: Record<string, string> = {
    idle: '未连接',
    connecting: '连接中…',
    connected: '已连接',
    disconnected: '连接断开，重连中…',
    room_not_found: '房间不存在',
    risk_control: '触发风控，重连中…',
    error: '连接出错',
  };
  state.statusText = map[status] || status;
  Object.assign(state, extra);
  const detail = [
    extra.realRoomId ? `房间=${extra.realRoomId}` : '',
    extra.liveStatus !== undefined ? `直播状态=${extra.liveStatus}` : '',
    extra.code !== undefined ? `code=${extra.code}` : '',
    error ? `错误=${error}` : '',
  ].filter(Boolean).join(' ');
  log(`[状态] ${state.statusText}${detail ? ' ' + detail : ''}`);
  broadcast('status', snapshot());

  if (status === 'connected') {
    cookieCheckDone = false;
    return;
  }
  if (status !== 'risk_control' && status !== 'error' && status !== 'disconnected') return;
  if (cookieCheckDone || state.loginRequired) return;
  if (status === 'risk_control' || client.retryCount >= 3) {
    cookieCheckDone = true;
    runCookieCheck(`${status} retry=${client.retryCount}`);
  }
});

client.on('danmu', (d: any) => {
  broadcast('danmu', { ...d, counters: client.counters });
  const text = (d.text || '').trim();
  if (text === queue.enterKey) {
    const r = queue.enter(d.uid, d.user, d.color);
    if (r.ok) {
      log(`[队列] ${d.user || '匿名'} (uid=${d.uid}) 入队，位置 ${r.position}`);
      broadcast('queue', queue.list());
    } else if (r.reason === 'already') {
      log(`[队列] ${d.user || '匿名'} (uid=${d.uid}) 已在队列中`);
    } else if (r.reason === 'no_uid') {
      log('[队列] 忽略匿名用户入队请求 (uid=0)');
    }
  } else if (text === queue.leaveKey) {
    const r = queue.leave(d.uid);
    if (r.ok) {
      log(`[队列] ${d.user || '匿名'} (uid=${d.uid}) 已取消排队`);
      broadcast('queue', queue.list());
    } else {
      log(`[队列] ${d.user || '匿名'} (uid=${d.uid}) 取消排队但不在队列中`);
    }
  }
});

client.on('superchat', (d: any) => {
  log(`[醒目留言] ${d.user || '匿名'} ￥${d.price} : ${d.message}`);
  broadcast('superchat', { ...d, counters: client.counters });
});

client.on('gift', (d: any) => {
  log(`[礼物] ${d.user || '匿名'} (uid=${d.uid}) 送出 ${d.giftName} x${d.num}`);
  broadcast('gift', d);

  const effects = giftEngine.recordGift(d);
  if (!effects.length) return;
  for (const { rule, times } of effects) {
    for (let t = 0; t < times; t++) {
      const r = queue.skip(d.uid, rule.mode, rule.steps, {
        uid: d.uid,
        user: d.user,
        color: '',
      });
      if (r.ok) {
        const how = rule.mode === 'top' ? '置顶' : `前进 ${rule.steps} 位`;
        log(`[队列] ${d.user || '匿名'} 送出 ${rule.giftName || rule.giftId} 达阈值 → ${how}，现第 ${r.position} 位`);
      } else {
        log(`[队列] 礼物插队失败 uid=${d.uid} reason=${r.reason}`);
      }
    }
  }
  broadcast('queue', queue.list());
});

client.on('online', (count: number) => {
  state.online = count;
  log(`[人气] ${count}`);
  broadcast('online', count);
});

client.on('error', (message: string) => {
  console.error(`[danmaku] ${message}`);
});

app.get('/api/status', (_req: Request, res: Response) => {
  res.json(snapshot());
});

app.get('/api/login/status', (_req: Request, res: Response) => {
  res.json(login.getStatus());
});

app.post('/api/login/restart', (_req: Request, res: Response) => {
  state.loginRequired = true;
  state.statusText = '等待扫码登录';
  broadcast('status', snapshot());
  login.start();
  res.json({ ok: true });
});

app.post('/api/logout', (_req: Request, res: Response) => {
  clearAuth();
  auth.cookie = '';
  auth.uid = 0;
  auth.uname = '';
  auth.updatedAt = new Date().toISOString();
  client.stop();
  client.clearCredentials();
  state.uid = 0;
  state.uname = '';
  state.statusText = '等待扫码登录';
  state.error = '';
  state.online = 0;
  state.loginRequired = true;
  log('[登录] 已退出登录，清空凭据并重新生成二维码');
  login.start();
  broadcast('status', snapshot());
  res.json({ ok: true });
});
app.get('/api/settings', (_req: Request, res: Response) => {
  res.json({
    roomId: client.roomId,
    queueEnterKey: queue.enterKey,
    queueLeaveKey: queue.leaveKey,
  });
});

app.post('/api/settings', (req: Request, res: Response) => {
  const body = req.body || {};
  const rawRoomId = body.roomId;
  const roomId = rawRoomId === '' || rawRoomId === null || rawRoomId === undefined
    ? null
    : Number(rawRoomId);
  const enterKey = String(body.queueEnterKey ?? '').trim();
  const leaveKey = String(body.queueLeaveKey ?? '').trim();
  if (roomId !== null && (!Number.isInteger(roomId) || roomId <= 0)) {
    return res.status(400).json({ ok: false, error: '房间号必须是正整数或留空' });
  }
  if (!enterKey || enterKey.length > 20) {
    return res.status(400).json({ ok: false, error: '排队词不能为空且不超过20字' });
  }
  if (!leaveKey || leaveKey.length > 20) {
    return res.status(400).json({ ok: false, error: '取消排队词不能为空且不超过20字' });
  }
  if (enterKey === leaveKey) {
    return res.status(400).json({ ok: false, error: '排队词与取消排队词不能相同' });
  }

  settings.roomId = roomId;
  settings.queue.enterKey = enterKey;
  settings.queue.leaveKey = leaveKey;
  saveSettings(settings);
  queue.setKeywords(enterKey, leaveKey);
  state.roomId = roomId;
  client.setRoom(roomId);

  if (!state.loginRequired) {
    connectClient();
  }
  log(`[设置] 房间号=${roomId || '空(自动取扫码用户直播间)'} 排队词=${enterKey} 取消词=${leaveKey}`);
  broadcast('settings', { roomId, queueEnterKey: enterKey, queueLeaveKey: leaveKey });
  broadcast('status', snapshot());
  res.json({ ok: true });
});

// 队列导入：前端完成合并，这里只做校验后整体替换（plan D21 / §6.4）
const MAX_IMPORT = 1000;

app.post('/api/queue/import', (req: Request, res: Response) => {
  const items = req.body && req.body.items;
  if (!Array.isArray(items)) {
    return res.status(400).json({ ok: false, error: 'items 必须是数组' });
  }
  if (items.length > MAX_IMPORT) {
    return res.status(400).json({ ok: false, error: `一次最多导入 ${MAX_IMPORT} 条` });
  }
  const seen = new Set<number>();
  const now = Date.now();
  const maxTs = now + 24 * 60 * 60 * 1000;
  const badTs = (v: number): boolean => !Number.isFinite(v) || v <= 0 || v > maxTs;
  const normalized: QueueItemInput[] = [];
  for (const [i, raw] of items.entries()) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const uid = Number(r.uid);
    const joinedAt = Number(r.joinedAt);
    if (!Number.isInteger(uid) || uid <= 0) {
      return res.status(400).json({ ok: false, error: `第 ${i + 1} 条：uid 必须是正整数` });
    }
    if (seen.has(uid)) {
      return res.status(400).json({ ok: false, error: `第 ${i + 1} 条：uid ${uid} 重复` });
    }
    seen.add(uid);
    if (badTs(joinedAt)) {
      return res.status(400).json({ ok: false, error: `第 ${i + 1} 条：joinedAt 必须是合理的时间戳` });
    }
    if (typeof r.done !== 'boolean') {
      return res.status(400).json({ ok: false, error: `第 ${i + 1} 条：done 必须是布尔值` });
    }
    const rawCompleted = Number(r.completedAt);
    const hasCompleted = r.completedAt !== undefined && r.completedAt !== null && r.completedAt !== 0;
    if (hasCompleted && badTs(rawCompleted)) {
      return res.status(400).json({ ok: false, error: `第 ${i + 1} 条：completedAt 必须是合理的时间戳` });
    }
    const rawSkipped = Number(r.skippedAt);
    const hasSkipped = r.skippedAt !== undefined && r.skippedAt !== null && r.skippedAt !== 0;
    if (hasSkipped && badTs(rawSkipped)) {
      return res.status(400).json({ ok: false, error: `第 ${i + 1} 条：skippedAt 必须是合理的时间戳` });
    }
    const completedAt = r.done ? (hasCompleted ? rawCompleted : now) : 0;
    normalized.push({
      uid,
      user: String(r.user ?? '').slice(0, 50) || '匿名',
      color: typeof r.color === 'string' ? r.color : '',
      joinedAt,
      done: r.done,
      completedAt,
      skippedAt: hasSkipped ? rawSkipped : undefined,
    });
  }
  queue.replace(normalized);
  log(`[队列] 导入队列 ${normalized.length} 条（已完成 ${normalized.filter((it) => it.done).length}）`);
  broadcast('queue', queue.list());
  res.json({ ok: true, queue: queue.list() });
});

app.post('/api/queue/complete', (req: Request, res: Response) => {
  const uid = Number(req.body && req.body.uid);
  if (!Number.isInteger(uid) || uid <= 0) {
    return res.status(400).json({ ok: false, error: 'uid 必须是正整数' });
  }
  const r = queue.complete(uid);
  if (!r.ok) {
    return res.status(404).json({ ok: false, error: '该用户不在队列中' });
  }
  log(`[队列] 管理员完成委托 uid=${uid}`);
  broadcast('queue', queue.list());
  res.json({ ok: true });
});

app.post('/api/queue/clearDone', (_req: Request, res: Response) => {
  const r = queue.clearDone();
  log(`[队列] 清除已完成 ${r.cleared} 人`);
  broadcast('queue', queue.list());
  res.json({ ok: true });
});

app.post('/api/queue/reset', (_req: Request, res: Response) => {
  const r = queue.reset();
  log(`[队列] 管理员清空队列（清除 ${r.cleared} 人）`);
  broadcast('queue', queue.list());
  res.json({ ok: true });
});

app.post('/api/queue/move', (req: Request, res: Response) => {
  const uid = Number(req.body && req.body.uid);
  const toIndex = Number(req.body && req.body.toIndex);
  if (!Number.isInteger(uid) || uid <= 0) {
    return res.status(400).json({ ok: false, error: 'uid 必须是正整数' });
  }
  if (!Number.isInteger(toIndex) || toIndex < 0) {
    return res.status(400).json({ ok: false, error: 'toIndex 必须是非负整数' });
  }
  const r = queue.move(uid, toIndex);
  if (!r.ok) {
    const msg = r.reason === 'not_found' ? '该用户不在队列中' : '目标位置无效';
    return res.status(r.reason === 'not_found' ? 404 : 400).json({ ok: false, error: msg });
  }
  log(`[队列] 管理员调整顺序 uid=${uid} → 第 ${r.position} 位`);
  broadcast('queue', queue.list());
  res.json({ ok: true, position: r.position });
});

const GIFT_LIST_URL = 'https://api.live.bilibili.com/xlive/web-room/v1/giftPanel/roomGiftList';

app.get('/api/gifts', async (req: Request, res: Response) => {
  const roomId = Number(req.query.roomId) || config.roomId;
  if (!roomId) {
    return res.status(400).json({ ok: false, error: '未设置房间号，无法获取礼物列表' });
  }
  try {
    const url = `${GIFT_LIST_URL}?platform=pc&room_id=${roomId}`;
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    const json: any = await r.json();
    const list = json && json.data && json.data.gift_config && json.data.gift_config.base_config
      && json.data.gift_config.base_config.list;
    if (json.code !== 0 || !Array.isArray(list)) {
      log(`[礼物] 获取礼物列表失败: code=${json.code} message=${json.message}`);
      return res.status(502).json({ ok: false, error: `礼物列表获取失败: ${json.message || json.code}` });
    }
    const gifts = list
      .filter((g: any) => g && g.id && g.name)
      .map((g: any) => ({
        id: g.id,
        name: g.name,
        price: Math.round((g.price || 0) / 1000 * 100) / 100,
        coinType: g.coin_type || '',
        img: g.img_basic || '',
      }));
    res.json({ ok: true, gifts });
  } catch (e) {
    log(`[礼物] 获取礼物列表出错: ${(e as Error).message}`);
    res.status(502).json({ ok: false, error: (e as Error).message });
  }
});

app.get('/api/gift-rules', (_req: Request, res: Response) => {
  res.json({ ok: true, rules: giftEngine.rules });
});

app.post('/api/gift-rules', (req: Request, res: Response) => {
  const result = normalizeRules(req.body && req.body.rules);
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.error });
  }
  giftEngine.reload(result.rules);
  settings.giftRules = result.rules.slice();
  saveSettings(settings);
  log(`[礼物] 规则已更新：${result.rules.length} 条（${result.rules.map((r: GiftRule) => `${r.giftName || r.giftId}×${r.threshold}→${r.mode === 'top' ? '置顶' : `+${r.steps}`}`).join(', ') || '无'}）`);
  res.json({ ok: true, rules: giftEngine.rules });
});

// 清空送礼计数，重新累计送礼触发阈值
app.post('/api/gift-rules/reset', (_req: Request, res: Response) => {
  giftEngine.reset();
  log('[礼物] 送礼计数已清零');
  res.json({ ok: true });
});

app.get('/api/overlay', (_req: Request, res: Response) => {
  res.json(settings.overlay);
});

app.post('/api/overlay', (req: Request, res: Response) => {
  const body = req.body || {};
  const ov = settings.overlay;

  const showChat = body.showChat === undefined ? ov.showChat : Number(body.showChat) ? 1 : 0;
  const chatMax = Number(body.chatMax ?? ov.chatMax);
  const scMax = Number(body.scMax ?? ov.scMax);
  const showQueue = body.showQueue === undefined ? ov.showQueue : Number(body.showQueue) ? 1 : 0;
  const queueMax = Number(body.queueMax ?? ov.queueMax);
  const queueMode = String(body.queueMode || ov.queueMode) as QueueMode;
  const queueFlowSpeed = Number(body.queueFlowSpeed ?? ov.queueFlowSpeed);
  const queueFlowPause = Number(body.queueFlowPause ?? ov.queueFlowPause);

  const L = OVERLAY_LIMITS;
  if (!Number.isInteger(chatMax) || chatMax < L.chatMax.min || chatMax > L.chatMax.max) {
    return res.status(400).json({ ok: false, error: `弹幕条数需在 ${L.chatMax.min}-${L.chatMax.max} 之间` });
  }
  if (!Number.isInteger(scMax) || scMax < L.scMax.min || scMax > L.scMax.max) {
    return res.status(400).json({ ok: false, error: `SC条数需在 ${L.scMax.min}-${L.scMax.max} 之间` });
  }
  if (!Number.isInteger(queueMax) || queueMax < L.queueMax.min || queueMax > L.queueMax.max) {
    return res.status(400).json({ ok: false, error: `排队人数需在 ${L.queueMax.min}-${L.queueMax.max} 之间` });
  }
  if (!QUEUE_MODES.includes(queueMode)) {
    return res.status(400).json({ ok: false, error: '排队模式必须是 list、horizontal 或 flow' });
  }
  if (!Number.isInteger(queueFlowSpeed) || queueFlowSpeed < L.queueFlowSpeed.min || queueFlowSpeed > L.queueFlowSpeed.max) {
    return res.status(400).json({ ok: false, error: `流动速度需为 ${L.queueFlowSpeed.min}-${L.queueFlowSpeed.max} 的整数（秒/屏）` });
  }
  if (!Number.isInteger(queueFlowPause) || queueFlowPause < L.queueFlowPause.min || queueFlowPause > L.queueFlowPause.max) {
    return res.status(400).json({ ok: false, error: `底部停留需为 ${L.queueFlowPause.min}-${L.queueFlowPause.max} 的整数（秒）` });
  }

  const next: OverlaySettings = {
    showChat, chatMax, scMax, showQueue, queueMax, queueMode, queueFlowSpeed, queueFlowPause,
  };
  Object.assign(ov, next);
  saveSettings(settings);
  config.overlay = ov;
  log(`[覆盖] 弹幕SC=${ov.showChat ? '开' : '关'}(${ov.chatMax}/${ov.scMax}) 排队=${ov.showQueue ? '开' : '关'}(${ov.queueMax} ${ov.queueMode}${ov.queueMode === 'flow' ? ` ${ov.queueFlowSpeed}s/${ov.queueFlowPause}s` : ''})`);
  broadcast('overlay', { ...ov });
  res.json({ ok: true, overlay: { ...ov } });
});

wss.on('connection', (ws) => {
  clients.add(ws);
  try {
    ws.send(JSON.stringify({ type: 'status', data: snapshot(), ts: Date.now() }));
  } catch (e) {
    clients.delete(ws);
    return;
  }
  ws.on('close', () => clients.delete(ws));
  ws.on('error', (err: Error) => {
    clients.delete(ws);
    log(`[ws客户端] ${err.message}`);
  });
});

process.on('uncaughtException', (err) => {
  log(`[未捕获异常] ${err.stack || err.message}`);
});

process.on('unhandledRejection', (reason: any) => {
  log(`[未处理拒绝] ${reason && (reason.stack || reason.message) || reason}`);
});

// 供测试导入（不触发监听）；直接运行或打包入口（bundle-entry 标记）时才启动服务器
const isEntry =
  require.main === module || Boolean((globalThis as Record<string, unknown>).__DANMUDECK_ENTRY__);
if (isEntry) {
  server.listen(config.port, () => {
    log(`弹幕台 DanmuDeck 已启动: http://localhost:${config.port}  房间号: ${config.roomId || '空(自动)'}`);
    if (config.cookie) {
      log(`[登录] 已使用 data/auth.json 中的 Cookie（uid=${config.uid || '未知'}），检查登录态…`);
      checkCookieLogin(config.cookie).then((r) => {
        if (r.state === 'valid') {
          log(`[登录] Cookie 检查: 有效 uname=${r.uname}`);
          if (r.uname) {
            state.uname = r.uname;
            storeAuth({ uname: r.uname });
          }
          connectClient();
        } else if (r.state === 'invalid') {
          log(`[登录] Cookie 检查: 已过期 code=${r.code} message=${r.message}`);
          handleCookieExpired('启动检查');
        } else {
          log(`[登录] Cookie 检查: 无法判断 code=${r.code} message=${r.message}，照常连接`);
          connectClient();
        }
      }).catch((e) => {
        log(`[登录] Cookie 检查失败(网络): ${e.message}，照常连接`);
        connectClient();
      });
    } else {
      state.statusText = '等待扫码登录';
      log('未配置 Cookie，开始扫码登录…');
      login.start();
    }
  });
}

export { app, server, queue, giftEngine, state, config, settings, auth };
export const danmakuClient = client;
