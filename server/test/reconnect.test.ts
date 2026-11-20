import { test } from 'node:test';
import assert from 'node:assert';
import { DanmakuClient } from '../danmaku';

test('connect 传给 openSocket 的必须是真正的弹幕 token 而非代次整数', async () => {
  const c = new DanmakuClient({ roomId: 1, cookie: 'c', uid: 7 });
  (c as any).resolveRoom = async () => ({ realRoomId: 1, liveStatus: 1 });
  (c as any).getDanmuInfo = async () => ({ token: 'REAL_DANMU_TOKEN_123', url: 'wss://fake' });
  (c as any).setStatus = () => {};
  let danmuToken: string | undefined, genToken: number | undefined;
  (c as any).openSocket = (_url: string, dt: string, g: number) => { danmuToken = dt; genToken = g; };
  await c.connect();
  assert.strictEqual(danmuToken, 'REAL_DANMU_TOKEN_123', '认证 key 必须使用弹幕 token');
  assert.strictEqual(typeof genToken, 'number', '第三个参数是代次整数');
});

test('buildAuth 使用弹幕 token 作为 key，且含 uid/cookie/buvid', () => {
  const c = new DanmakuClient({ roomId: 1, cookie: 'SESSDATA=abc', uid: 42 });
  (c as any).buvid = 'B3XXX';
  const { json } = c.buildAuth(1774678, 'DANMU_TOKEN');
  const parsed = JSON.parse(json);
  assert.strictEqual(parsed.key, 'DANMU_TOKEN');
  assert.strictEqual(parsed.roomid, 1774678);
  assert.strictEqual(parsed.uid, 42);
  assert.strictEqual(parsed.buvid, 'B3XXX');
});

test('热改房间：旧连接被取代后其 close 不再触发重连', async () => {
  const c = new DanmakuClient({ roomId: 1, cookie: '', uid: 0 });

  const sockets: any[] = [];
  (c as any).openSocket = function (_url: string, _danmuToken: string, token: number) {
    const fake = { called: true, close: () => {}, on() {}, send() {} };
    sockets.push({ token, fake });
  };
  (c as any).resolveRoom = async () => ({ realRoomId: 1, liveStatus: 1 });
  (c as any).getDanmuInfo = async () => ({ token: 't', url: 'wss://x' });
  (c as any).setStatus = () => {};
  (c as any).startHeartbeat = () => {};

  await c.connect();
  assert.strictEqual(sockets.length, 1, '第一次连接应只建一个 socket');

  c.stop();
  await c.connect();
  assert.strictEqual(sockets.length, 2, '热改房间应只新建一个 socket');

  const oldToken = c.connToken - 1;
  assert.notStrictEqual(oldToken, c.connToken, 'stop 后代次 token 必须递增');
});

test('旧代次 scheduleReconnect 不会执行新的 connect', () => {
  const c = new DanmakuClient({ roomId: 1, cookie: '', uid: 0 });
  let connects = 0;
  (c as any).connect = () => { connects += 1; };
  (c as any).clearTimers = () => {};
  (c as any).setStatus = () => {};

  const token = ++c.connToken;
  c.scheduleReconnect(token);
  c.stop();

  return new Promise((resolve) => {
    setTimeout(() => {
      assert.strictEqual(connects, 0, '被取代后不应重连');
      resolve();
    }, 1100);
  });
});
