import { test, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { app, queue, settings, danmakuClient, state, login } from '../index';
import * as settingsModule from '../settings';

let baseUrl = '';
let server: any;

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(() => {
  server.close();
});

async function postOverlay(body: Record<string, unknown>): Promise<{ status: number; json: any }> {
  const r = await fetch(`${baseUrl}/api/overlay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json() };
}

const BASE_OVERLAY = { showChat: 1, chatMax: 8, scMax: 3, showQueue: 1, queueMax: 6 };

test('POST /api/overlay 横排 / 竖排都能带流动开关并回写', async () => {
  const saved = { ...settings.overlay };
  try {
    for (const mode of ['list', 'horizontal'] as const) {
      const r = await postOverlay({ ...BASE_OVERLAY, queueMode: mode, queueFlow: 1, queueFlowSpeed: 5, queueFlowPause: 0 });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.ok, true);
      assert.strictEqual(r.json.overlay.queueMode, mode);
      assert.strictEqual(r.json.overlay.queueFlow, 1);
      assert.strictEqual(r.json.overlay.queueFlowSpeed, 5);
      assert.strictEqual(r.json.overlay.queueFlowPause, 0);

      const g = await fetch(`${baseUrl}/api/overlay`);
      const persisted: any = await g.json();
      assert.strictEqual(persisted.queueMode, mode);
      assert.strictEqual(persisted.queueFlow, 1);
      assert.strictEqual(persisted.queueFlowSpeed, 5);
    }
  } finally {
    Object.assign(settings.overlay, saved);
  }
});

test('POST /api/overlay 可以单独关掉流动而不动排列方式', async () => {
  const saved = { ...settings.overlay };
  try {
    settings.overlay.queueMode = 'horizontal';
    settings.overlay.queueFlow = 1;
    const r = await postOverlay({ ...BASE_OVERLAY, queueFlow: 0 });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.overlay.queueMode, 'horizontal');
    assert.strictEqual(r.json.overlay.queueFlow, 0);
  } finally {
    Object.assign(settings.overlay, saved);
  }
});

test('POST /api/overlay 流动字段越界或非整数返回 400', async () => {
  for (const body of [
    { queueFlowSpeed: 0 },
    { queueFlowSpeed: 16 },
    { queueFlowSpeed: 2.5 },
    { queueFlowSpeed: 'abc' },
    { queueFlowPause: -1 },
    { queueFlowPause: 16 },
    { queueFlowPause: 1.5 },
  ]) {
    const r = await postOverlay({ ...BASE_OVERLAY, queueFlow: 1, ...body });
    assert.strictEqual(r.status, 400, `应拒绝 ${JSON.stringify(body)}`);
    assert.strictEqual(r.json.ok, false);
  }
});

test('POST /api/overlay 拒绝未知排队模式（含已移除的 flow）', async () => {
  for (const mode of ['diagonal', 'flow']) {
    const r = await postOverlay({ ...BASE_OVERLAY, queueMode: mode });
    assert.strictEqual(r.status, 400, `应拒绝 queueMode=${mode}`);
    assert.match(r.json.error, /list（竖排）或 horizontal（横排）/);
  }
});

test('POST /api/overlay 未传流动字段时沿用当前值', async () => {
  const saved = { ...settings.overlay };
  try {
    settings.overlay.queueFlow = 1;
    settings.overlay.queueFlowSpeed = 7;
    settings.overlay.queueFlowPause = 4;
    const r = await postOverlay({ ...BASE_OVERLAY, queueMode: 'list' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.overlay.queueFlow, 1);
    assert.strictEqual(r.json.overlay.queueFlowSpeed, 7);
    assert.strictEqual(r.json.overlay.queueFlowPause, 4);
  } finally {
    Object.assign(settings.overlay, saved);
  }
});

test('POST /api/queue/import 按数组顺序整体替换并重算位置', async () => {
  queue.reset();
  const items = [
    { uid: 2, user: '乙', joinedAt: 200, done: false },
    { uid: 1, user: '甲', color: '#1abcfe', joinedAt: 100, done: false },
    { uid: 3, user: '丙', joinedAt: 300, done: true, completedAt: 400 },
  ];
  const r = await fetch(`${baseUrl}/api/queue/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  assert.strictEqual(r.status, 200);
  const json: any = await r.json();
  assert.strictEqual(json.ok, true);
  assert.deepStrictEqual(json.queue.map((it: any) => it.uid), [2, 1, 3]);
  assert.deepStrictEqual(json.queue.map((it: any) => it.position), [1, 2, 3]);
  assert.strictEqual(json.queue[1].color, '#1abcfe');
  assert.strictEqual(json.queue[2].done, true);
  assert.strictEqual(json.queue[2].completedAt, 400);
  queue.reset();
});

test('POST /api/queue/import 已完成项缺 completedAt 时补当前时间', async () => {
  queue.reset();
  const r = await fetch(`${baseUrl}/api/queue/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ uid: 9, user: '丁', joinedAt: 1, done: true }] }),
  });
  assert.strictEqual(r.status, 200);
  const json: any = await r.json();
  assert.ok(json.queue[0].completedAt > 0);
  queue.reset();
});

test('POST /api/queue/import 校验非法 / 非数组 / 超量', async () => {
  const cases: Array<{ body: unknown; re: RegExp }> = [
    { body: { items: 'nope' }, re: /数组/ },
    { body: { items: [{ uid: 0, user: 'a', joinedAt: 1, done: false }] }, re: /uid/ },
    { body: { items: [{ uid: 1, user: 'a', joinedAt: 'x', done: false }] }, re: /joinedAt/ },
    { body: { items: [{ uid: 1, user: 'a', joinedAt: 1, done: 'yes' }] }, re: /done/ },
    { body: { items: Array.from({ length: 1001 }, (_, i) => ({ uid: i + 1, user: 'a', joinedAt: 1, done: false })) }, re: /1000/ },
  ];
  for (const { body, re } of cases) {
    const r = await fetch(`${baseUrl}/api/queue/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.strictEqual(r.status, 400);
    const json: any = await r.json();
    assert.match(json.error, re);
  }
});

test('POST /api/queue/import 拒绝不合理的时间戳', async () => {
  const cases: Array<{ item: Record<string, unknown>; re: RegExp }> = [
    { item: { uid: 1, user: 'a', joinedAt: 1e15, done: false }, re: /joinedAt/ },
    { item: { uid: 2, user: 'a', joinedAt: -5, done: false }, re: /joinedAt/ },
    { item: { uid: 3, user: 'a', joinedAt: Date.now(), done: true, completedAt: 1e15 }, re: /completedAt/ },
    { item: { uid: 4, user: 'a', joinedAt: Date.now(), done: false, moves: [{ id: '1', at: -1, from: 1, to: 2, by: 'gift' }] }, re: /at/ },
    { item: { uid: 4, user: 'a', joinedAt: Date.now(), done: false, moves: [{ id: '2', at: Date.now(), from: 0, to: 2, by: 'gift' }] }, re: /from\/to/ },
    { item: { uid: 4, user: 'a', joinedAt: Date.now(), done: false, moves: [{ id: '3', at: Date.now(), from: 1, to: 2, by: 'other' }] }, re: /by/ },
  ];
  for (const { item, re } of cases) {
    const r = await fetch(`${baseUrl}/api/queue/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [item] }),
    });
    assert.strictEqual(r.status, 400, `应拒绝 ${JSON.stringify(item)}`);
    const json: any = await r.json();
    assert.match(json.error, re);
  }
  queue.reset();
});

test('POST /api/queue/import 只保留字段并截断昵称', async () => {
  queue.reset();
  const long = 'x'.repeat(80);
  const r = await fetch(`${baseUrl}/api/queue/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{
        uid: 5,
        user: long,
        joinedAt: 1,
        done: false,
        moves: [{ id: 'm1', at: Date.now(), from: 2, to: 1, by: 'gift', gift: '辣条' }],
        hack: '应被丢弃',
      }],
    }),
  });
  assert.strictEqual(r.status, 200);
  const json: any = await r.json();
  assert.strictEqual(json.queue[0].user.length, 50);
  assert.strictEqual(json.queue[0].moves.length, 1);
  assert.strictEqual(json.queue[0].moves[0].id, 'm1');
  assert.strictEqual(json.queue[0].moves[0].gift, '辣条');
  assert.strictEqual(json.queue[0].hack, undefined, '未知字段应被丢弃');
  assert.ok(json.queue[0].id, '条目应带雪花 ID');
  queue.reset();
});

test('POST /api/queue/import 为缺失 ID 的条目补发雪花 ID', async () => {
  queue.reset();
  const r = await fetch(`${baseUrl}/api/queue/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        { uid: 10, user: 'a', joinedAt: Date.now(), done: false },
        { uid: 11, user: 'b', joinedAt: Date.now(), done: false },
      ],
    }),
  });
  assert.strictEqual(r.status, 200);
  const json: any = await r.json();
  assert.ok(json.queue[0].id && json.queue[1].id);
  assert.notStrictEqual(json.queue[0].id, json.queue[1].id, '补发的 ID 不应重复');
  queue.reset();
});

test('POST /api/queue/import 允许同一 uid 的已完成与重新排队记录共存', async () => {
  queue.reset();
  const now = Date.now();
  const r = await fetch(`${baseUrl}/api/queue/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        { id: 'a', uid: 285834432, user: 'bi御坂li', joinedAt: now - 60000, done: true, completedAt: now - 50000 },
        { id: 'b', uid: 285834432, user: 'bi御坂li', joinedAt: now - 30000, done: false },
      ],
    }),
  });
  assert.strictEqual(r.status, 200);
  const json: any = await r.json();
  assert.strictEqual(json.queue.length, 2, '同 uid 两条都应保留');
  assert.strictEqual(json.queue[0].done, true);
  assert.strictEqual(json.queue[1].done, false);
  assert.deepStrictEqual(json.queue.map((it: any) => it.id), ['a', 'b']);
  queue.reset();
});

test('POST /api/queue/import 重复的条目 id 会被补发新雪花 ID', async () => {
  queue.reset();
  const now = Date.now();
  const r = await fetch(`${baseUrl}/api/queue/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        { id: 'same', uid: 1, user: 'a', joinedAt: now, done: false },
        { id: 'same', uid: 2, user: 'b', joinedAt: now, done: false },
      ],
    }),
  });
  assert.strictEqual(r.status, 200);
  const json: any = await r.json();
  assert.strictEqual(json.queue[0].id, 'same');
  assert.notStrictEqual(json.queue[1].id, 'same', '重复 id 应被替换');
  assert.ok(json.queue[1].id.length > 0);
  queue.reset();
});

test('settings.ts 导出的默认值与校验常量保持稳定', () => {
  assert.deepStrictEqual(settingsModule.OVERLAY_LIMITS.queueFlowSpeed, { min: 1, max: 15 });
  assert.deepStrictEqual(settingsModule.OVERLAY_LIMITS.queueFlowPause, { min: 0, max: 15 });
  assert.deepStrictEqual(settingsModule.QUEUE_MODES, ['list', 'horizontal']);
});

test('GET /api/status 快照含 uname 字符串', async () => {
  const r = await fetch(`${baseUrl}/api/status`);
  const json: any = await r.json();
  assert.strictEqual(typeof json.uname, 'string');
});

test('POST /api/logout 清空凭据并进入扫码态', async () => {
  const r = await fetch(`${baseUrl}/api/logout`, { method: 'POST' });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(await r.json(), { ok: true });
  const s: any = await (await fetch(`${baseUrl}/api/status`)).json();
  assert.strictEqual(s.loginRequired, true);
  assert.strictEqual(s.uid, 0);
  assert.strictEqual(s.uname, '');
  const authOnDisk = JSON.parse(fs.readFileSync(settingsModule.AUTH_FILE, 'utf8'));
  assert.strictEqual(authOnDisk.cookie, '');
  assert.strictEqual(authOnDisk.uid, 0);
  assert.strictEqual(authOnDisk.uname, '');
});

test('POST /api/logout 同时清掉弹幕客户端里的旧账号凭据', async () => {
  // 回归：退出登录只清 auth.json/state 时，client 仍带着旧 Cookie 去解析房间与重连
  danmakuClient.setCredentials('SESSDATA=stale; DedeUserID=777', 777);
  state.uid = 777;
  try {
    await fetch(`${baseUrl}/api/logout`, { method: 'POST' });
    assert.strictEqual(danmakuClient.cookie, '');
    assert.strictEqual(danmakuClient.uid, 0);
    assert.strictEqual(state.uid, 0);
  } finally {
    danmakuClient.clearCredentials();
    state.uid = 0;
  }
});

test('扫码登录成功后 Cookie 立即落盘（回归：重启后不必重扫）', () => {
  // 回归：onLoggedIn 曾只调 client.setCredentials，日志却说「已保存」，重启后 auth.json 仍为空
  const savedAuth = settingsModule.loadAuth();
  try {
    settingsModule.saveAuth(settingsModule.defaultAuth());
    assert.ok(login.onLoggedIn, '扫码回调应已注册');
    login.onLoggedIn('SESSDATA=fresh; DedeUserID=12345', 12345);

    const onDisk = JSON.parse(fs.readFileSync(settingsModule.AUTH_FILE, 'utf8'));
    assert.strictEqual(onDisk.cookie, 'SESSDATA=fresh; DedeUserID=12345');
    assert.strictEqual(onDisk.uid, 12345);
    assert.ok(onDisk.updatedAt, '应记录写入时间');
    assert.strictEqual(state.uid, 12345);
    assert.strictEqual(state.loginRequired, false);
  } finally {
    settingsModule.saveAuth(savedAuth);
    danmakuClient.clearCredentials();
    state.uid = 0;
    state.loginRequired = true;
  }
});
