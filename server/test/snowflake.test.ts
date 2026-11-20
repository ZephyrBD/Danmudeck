import { test } from 'node:test';
import assert from 'node:assert';
import { setWorkerId, snowflake, snowflakeTime } from '../snowflake';

test('雪花 ID 递增且不重复', () => {
  const ids = new Set<string>();
  let prev = 0n;
  for (let i = 0; i < 5000; i++) {
    const id = snowflake();
    assert.ok(!ids.has(id), '不应重复');
    ids.add(id);
    const n = BigInt(id);
    assert.ok(n > prev, '应严格递增');
    prev = n;
  }
  assert.strictEqual(ids.size, 5000);
});

test('雪花 ID 可反解出接近当前的时间', () => {
  const before = Date.now();
  const t = snowflakeTime(snowflake());
  const after = Date.now();
  assert.ok(t >= before - 2 && t <= after + 2, `反解时间 ${t} 应落在 [${before}, ${after}]`);
});

test('固定机器号不改变唯一性', () => {
  setWorkerId(7);
  const a = snowflake();
  const b = snowflake();
  assert.notStrictEqual(a, b);
});
