import { test } from 'node:test';
import assert from 'node:assert';
import { Queue } from '../queue';

test('入队：按顺序记录位置', () => {
  const q = new Queue();
  const r = q.enter(1, '甲');
  assert.strictEqual(r.ok, true);
  assert.strictEqual((r as any).position, 1);
  assert.strictEqual((r as any).item.uid, 1);
  assert.strictEqual((r as any).item.done, false);
  q.enter(2, '乙');
  q.enter(3, '丙');
  const list = q.list();
  assert.strictEqual(list.length, 3);
  assert.deepStrictEqual(list.map((i) => i.position), [1, 2, 3]);
  assert.strictEqual(list[1].user, '乙');
});

test('入队去重：同 uid 不重复入队', () => {
  const q = new Queue();
  q.enter(100, '甲');
  const r = q.enter(100, '甲');
  assert.strictEqual(r.ok, false);
  assert.strictEqual((r as any).reason, 'already');
  assert.strictEqual(q.list().length, 1);
});

test('匿名 uid=0 不入队', () => {
  const q = new Queue();
  const r = q.enter(0, '匿名');
  assert.strictEqual(r.ok, false);
  assert.strictEqual((r as any).reason, 'no_uid');
});

test('取消排队：移除该 uid 并保持顺序', () => {
  const q = new Queue();
  q.enter(1, '甲');
  q.enter(2, '乙');
  q.enter(3, '丙');
  assert.deepStrictEqual(q.leave(2), { ok: true });
  const list = q.list();
  assert.deepStrictEqual(list.map((i) => i.uid), [1, 3]);
  assert.deepStrictEqual(list.map((i) => i.position), [1, 2]);
  assert.deepStrictEqual(q.leave(999), { ok: false, reason: 'not_found' });
});

test('完成委托：标记已完成而非移除', () => {
  const q = new Queue();
  q.enter(1, '甲');
  q.enter(2, '乙');
  const r = q.complete(1);
  assert.strictEqual(r.ok, true);
  assert.strictEqual((r as any).item.done, true);
  assert.ok((r as any).item.completedAt > 0);
  assert.strictEqual(q.list().length, 2);
  const list = q.list();
  assert.strictEqual(list[0].uid, 1);
  assert.strictEqual(list[0].done, true);
  assert.strictEqual(list[1].uid, 2);
  assert.strictEqual(list[1].done, false);
});

test('activeList 只返回未完成者并重排位置', () => {
  const q = new Queue();
  q.enter(1, '甲');
  q.enter(2, '乙');
  q.enter(3, '丙');
  q.complete(1);
  q.complete(3);
  const active = q.activeList();
  assert.strictEqual(active.length, 1);
  assert.strictEqual(active[0].uid, 2);
  assert.strictEqual(active[0].position, 1);
});

test('clearDone 移除所有已完成者', () => {
  const q = new Queue();
  q.enter(1, '甲');
  q.enter(2, '乙');
  q.complete(1);
  const r = q.clearDone();
  assert.deepStrictEqual(r, { ok: true, cleared: 1 });
  assert.deepStrictEqual(q.list().map((i) => i.uid), [2]);
});

// 回归测试（bug1）：查重只针对未完成条目，完成委托后可再次排队
test('完成委托后可再次排队', () => {
  const q = new Queue();
  q.enter(100, '甲');
  q.complete(100);
  const r = q.enter(100, '甲');
  assert.strictEqual(r.ok, true, '完成后再次入队应成功');
  assert.strictEqual(q.list().length, 2, '旧条目保留为已完成记录');
  assert.strictEqual(q.list()[0].done, true);
  assert.strictEqual(q.list()[1].done, false);
  // 新条目未完成时重复入队仍判 already
  const again = q.enter(100, '甲');
  assert.strictEqual(again.ok, false);
  assert.strictEqual((again as any).reason, 'already');
});

test('enter 记录用户名颜色', () => {
  const q = new Queue();
  q.enter(1, '甲', '#61a7ff');
  assert.strictEqual(q.list()[0].color, '#61a7ff');
});

test('清空队列', () => {
  const q = new Queue();
  q.enter(1, '甲');
  q.enter(2, '乙');
  assert.deepStrictEqual(q.reset(), { ok: true, cleared: 2 });
  assert.deepStrictEqual(q.list(), []);
});

test('setKeywords 实时更新关键词', () => {
  const q = new Queue({ enterKey: '排队', leaveKey: '取消排队' });
  q.setKeywords('上号', '下号');
  assert.strictEqual(q.enterKey, '上号');
  assert.strictEqual(q.leaveKey, '下号');
});

test('move 移动到指定位置', () => {
  const q = new Queue();
  q.enter(1, '甲');
  q.enter(2, '乙');
  q.enter(3, '丙');
  const r = q.move(3, 0);
  assert.strictEqual(r.ok, true);
  assert.strictEqual((r as any).position, 1);
  assert.deepStrictEqual(q.list().map((i) => i.uid), [3, 1, 2]);
  q.move(3, 2);
  assert.deepStrictEqual(q.list().map((i) => i.uid), [1, 2, 3]);
});

test('move 无效 uid 与越界位置报错', () => {
  const q = new Queue();
  q.enter(1, '甲');
  assert.strictEqual((q.move(999, 0) as any).reason, 'not_found');
  assert.strictEqual((q.move(1, 5) as any).reason, 'bad_index');
  assert.strictEqual((q.move(1, -1) as any).reason, 'bad_index');
  assert.strictEqual((q.move(1, 0.5) as any).reason, 'bad_index');
});

test('skip 置顶并标记 skippedAt', () => {
  const q = new Queue();
  q.enter(1, '甲');
  q.enter(2, '乙');
  q.enter(3, '丙');
  const r = q.skip(3, 'top');
  assert.strictEqual(r.ok, true);
  assert.strictEqual((r as any).position, 1);
  assert.deepStrictEqual(q.list().map((i) => i.uid), [3, 1, 2]);
  assert.ok(q.list()[0].skippedAt! > 0);
});

test('skip 前进 N 位且不越过队首', () => {
  const q = new Queue();
  for (let i = 1; i <= 5; i++) q.enter(i, `用户${i}`);
  q.skip(4, 'up', 2);
  assert.deepStrictEqual(q.list().map((i) => i.uid), [1, 4, 2, 3, 5]);
  q.skip(4, 'up', 10);
  assert.strictEqual(q.list()[0].uid, 4);
});

test('skip 不在队列时自动入队再插队', () => {
  const q = new Queue();
  q.enter(1, '甲');
  q.enter(2, '乙');
  const r = q.skip(3, 'top', 0, { uid: 3, user: '丙', color: '' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual((r as any).position, 1);
  const list = q.list();
  assert.deepStrictEqual(list.map((i) => i.uid), [3, 1, 2]);
  assert.strictEqual(list[0].user, '丙');
});

test('skip 自动入队拒绝匿名 uid=0', () => {
  const q = new Queue();
  const r = q.skip(0, 'top', 0, { uid: 0, user: '匿名', color: '' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual((r as any).reason, 'no_uid');
});

// 回归测试（bug2）：已完成条目不应被 skip 移到队首（“诈尸”）
test('skip 不会把已完成条目移到队首', () => {
  const q = new Queue();
  q.enter(1, '甲');
  q.enter(2, '乙');
  q.complete(1);
  const r = q.skip(1, 'top');
  assert.strictEqual(r.ok, false, '已完成条目不应可被插队');
  assert.strictEqual((r as any).reason, 'not_found');
  assert.deepStrictEqual(q.list().map((i) => i.uid), [1, 2], '顺序不变');
  assert.strictEqual(q.list()[0].skippedAt, undefined, '不应被标记 skippedAt');
});

// 回归测试（bug2）：move/leave 对已完成条目同样视为不存在
test('move 与 leave 忽略已完成条目', () => {
  const q = new Queue();
  q.enter(1, '甲');
  q.enter(2, '乙');
  q.complete(1);
  assert.strictEqual((q.move(1, 0) as any).reason, 'not_found');
  assert.deepStrictEqual(q.leave(1), { ok: false, reason: 'not_found' });
  // indexOf 两个变体
  assert.strictEqual(q.indexOf(1), 0, 'includeDone=true 找到已完成条目');
  assert.strictEqual(q.indexOf(1, false), -1, 'includeDone=false 跳过已完成条目');
  assert.strictEqual(q.indexOf(2, false), 1);
  // 未完成条目不受影响
  assert.strictEqual(q.move(2, 0).ok, true);
});
