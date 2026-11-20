import { test } from 'node:test';
import assert from 'node:assert';
import { GiftEngine, parseRules, normalizeRules, isValidRule, GiftRule } from '../gifts';

const RULE_TOP: GiftRule = { giftId: 3, giftName: 'B坷垃', threshold: 1, mode: 'top', steps: 0 };
const RULE_UP: GiftRule = { giftId: 1, giftName: '辣条', threshold: 10, mode: 'up', steps: 1 };

test('parseRules 解析合法 JSON 并过滤非法项', () => {
  const rules = parseRules(JSON.stringify([RULE_TOP, { giftId: 0, threshold: 1, mode: 'top' }, null]));
  assert.strictEqual(rules.length, 1);
  assert.strictEqual(rules[0].giftId, 3);
  assert.deepStrictEqual(parseRules(''), []);
  assert.deepStrictEqual(parseRules('not json'), []);
  assert.deepStrictEqual(parseRules('{"a":1}'), []);
});

test('normalizeRules 校验各字段', () => {
  assert.strictEqual(normalizeRules([RULE_UP]).ok, true);
  assert.strictEqual(normalizeRules([{ giftId: 1, threshold: 0, mode: 'top' }]).ok, false);
  assert.strictEqual(normalizeRules([{ giftId: 1, threshold: 5, mode: 'up', steps: 0 }]).ok, false);
  assert.strictEqual(normalizeRules([{ giftId: 1, threshold: 5, mode: 'side' }]).ok, false);
  assert.strictEqual(normalizeRules('nope').ok, false);
});

test('isValidRule 结构', () => {
  assert.strictEqual(isValidRule(RULE_TOP), true);
  assert.strictEqual(isValidRule(RULE_UP), true);
  assert.strictEqual(isValidRule({ giftId: 1, threshold: 5, mode: 'up' }), false);
});

test('礼物规则改由 settings.json 承载（不再有 saveRules 写 .env）', () => {
  const giftsModule = require('../gifts') as Record<string, unknown>;
  assert.strictEqual(giftsModule.saveRules, undefined);
});


test('未达阈值不触发，跨过阈值触发一次', () => {
  const engine = new GiftEngine([RULE_UP]);
  assert.deepStrictEqual(engine.recordGift({ uid: 1, giftId: 1, num: 9 }), []);
  const effects = engine.recordGift({ uid: 1, giftId: 1, num: 1 });
  assert.strictEqual(effects.length, 1);
  assert.strictEqual(effects[0].rule.mode, 'up');
  assert.strictEqual(effects[0].times, 1);
});

test('累计跨多个倍数时 times 累加', () => {
  const engine = new GiftEngine([RULE_UP]);
  const effects = engine.recordGift({ uid: 1, giftId: 1, num: 35 });
  assert.strictEqual(effects.length, 1);
  assert.strictEqual(effects[0].times, 3);
});

test('单条消息直接跨过倍数边界', () => {
  const engine = new GiftEngine([RULE_UP]);
  const effects = engine.recordGift({ uid: 1, giftId: 1, num: 11 });
  assert.strictEqual(effects.length, 1);
  assert.strictEqual(effects[0].times, 1);
  const again = engine.recordGift({ uid: 1, giftId: 1, num: 8 });
  assert.strictEqual(again.length, 0);
  const cross = engine.recordGift({ uid: 1, giftId: 1, num: 1 });
  assert.strictEqual(cross.length, 1);
});

test('不同 uid 独立累计', () => {
  const engine = new GiftEngine([RULE_UP]);
  engine.recordGift({ uid: 1, giftId: 1, num: 10 });
  const other = engine.recordGift({ uid: 2, giftId: 1, num: 5 });
  assert.deepStrictEqual(other, []);
});

test('不匹配的礼物不触发', () => {
  const engine = new GiftEngine([RULE_UP]);
  assert.deepStrictEqual(engine.recordGift({ uid: 1, giftId: 999, num: 100 }), []);
});

test('多条规则同时匹配同礼物', () => {
  const extra: GiftRule = { giftId: 1, giftName: '辣条', threshold: 5, mode: 'top', steps: 0 };
  const engine = new GiftEngine([RULE_UP, extra]);
  const effects = engine.recordGift({ uid: 1, giftId: 1, num: 10 });
  assert.strictEqual(effects.length, 2);
  const modes = effects.map((e) => e.rule.mode).sort();
  assert.deepStrictEqual(modes, ['top', 'up']);
});

test('reload 替换规则，reset 清空累计', () => {
  const engine = new GiftEngine([RULE_UP]);
  engine.recordGift({ uid: 1, giftId: 1, num: 10 });
  engine.reload([RULE_TOP]);
  assert.strictEqual(engine.rules.length, 1);
  assert.deepStrictEqual(engine.recordGift({ uid: 1, giftId: 1, num: 10 }), []);
  engine.reset();
  engine.reload([RULE_UP]);
  assert.strictEqual(engine.recordGift({ uid: 1, giftId: 1, num: 10 }).length, 1);
});

test('非法输入不触发', () => {
  const engine = new GiftEngine([RULE_UP]);
  assert.deepStrictEqual(engine.recordGift({ uid: 0, giftId: 1, num: 10 }), []);
  assert.deepStrictEqual(engine.recordGift({ uid: 1, giftId: 1, num: 0 }), []);
  assert.deepStrictEqual(engine.recordGift({ uid: 1, giftId: 1, num: -5 }), []);
});

// 回归测试（bug5）：reset 清零计数后可再次触发
test('reset 后同 uid 送礼可再次触发', () => {
  const engine = new GiftEngine([RULE_UP]);
  assert.deepStrictEqual(engine.recordGift({ uid: 7, giftId: 1, num: 5 }), []);
  engine.reset();
  assert.strictEqual(engine.recordGift({ uid: 7, giftId: 1, num: 10 }).length, 1, '清零后应重新累计并触发');
});
