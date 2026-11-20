import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { app, config, giftEngine, queue } from '../index';

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

// 回归测试（bug3）：排队词与取消排队词不能相同
test('POST /api/settings 排队词与取消词相同返回 400', async () => {
  const r = await fetch(`${baseUrl}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: '', queueEnterKey: '上号', queueLeaveKey: '上号' }),
  });
  assert.strictEqual(r.status, 400);
  const json: any = await r.json();
  assert.strictEqual(json.ok, false);
  assert.match(json.error, /不能相同/);
  // 关键词未被修改
  assert.notStrictEqual(queue.enterKey, '上号');
});

test('POST /api/settings 排队词与取消词不同时通过校验（不落盘直接测 400 之外路径前半段）', async () => {
  // 只验证不触发“相同”报错：用缺房间号触发 saveEnv 之前的另一个 400 分支即可
  const r = await fetch(`${baseUrl}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: '', queueEnterKey: '', queueLeaveKey: '取消' }),
  });
  assert.strictEqual(r.status, 400);
  const json: any = await r.json();
  assert.match(json.error, /排队词/);
});

// 回归测试（bug4）：/api/gifts 无房间号时返回 400，不再使用硬编码兜底房间
test('GET /api/gifts 无 roomId 且 config.roomId 为空返回 400', async () => {
  const saved = config.roomId;
  config.roomId = null;
  try {
    const r = await fetch(`${baseUrl}/api/gifts`);
    assert.strictEqual(r.status, 400);
    const json: any = await r.json();
    assert.strictEqual(json.ok, false);
    assert.match(json.error, /房间号/);
    // roomId=0 同样无效
    const r2 = await fetch(`${baseUrl}/api/gifts?roomId=0`);
    assert.strictEqual(r2.status, 400);
  } finally {
    config.roomId = saved;
  }
});

// 回归测试（bug5）：POST /api/gift-rules/reset 清空送礼计数
test('POST /api/gift-rules/reset 清零计数并返回 {ok:true}', async () => {
  const savedRules = giftEngine.rules;
  giftEngine.rules = [{ giftId: 1, giftName: '辣条', threshold: 10, mode: 'top', steps: 0 }];
  try {
    assert.deepStrictEqual(giftEngine.recordGift({ uid: 9, giftId: 1, num: 5 }), []);
    // 未清零前 5 个不触发
    assert.deepStrictEqual(giftEngine.recordGift({ uid: 9, giftId: 1, num: 4 }), []);

    const r = await fetch(`${baseUrl}/api/gift-rules/reset`, { method: 'POST' });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(await r.json(), { ok: true });

    // 清零后重新累计并触发
    assert.strictEqual(giftEngine.recordGift({ uid: 9, giftId: 1, num: 10 }).length, 1);
  } finally {
    giftEngine.rules = savedRules;
    giftEngine.reset();
    queue.reset();
  }
});
