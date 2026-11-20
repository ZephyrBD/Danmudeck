import { test } from 'node:test';
import assert from 'node:assert';
import { buildCookie, buildCookieFromInfo, parseUid, evaluateNav } from '../login';

test('buildCookie 只保留登录相关字段', () => {
  const setCookie = [
    'SESSDATA=abc123; Path=/; HttpOnly',
    'bili_jct=xyz789; Path=/',
    'DedeUserID=123456; Path=/',
    'DedeUserID__ckMd5=deadbeef; Path=/',
    'buvid3=XXXX-BUID; Path=/',
    'buvid4=YYYY-BUID; Path=/',
    '_uuid=unrelated; Path=/',
  ];
  const cookie = buildCookie(setCookie);
  assert.ok(cookie.includes('SESSDATA=abc123'));
  assert.ok(cookie.includes('bili_jct=xyz789'));
  assert.ok(cookie.includes('DedeUserID=123456'));
  assert.ok(cookie.includes('buvid3=XXXX-BUID'));
  assert.ok(!cookie.includes('_uuid'));
});

test('buildCookie 忽略无值条目', () => {
  const cookie = buildCookie(['SESSDATA; Path=/', 'bili_jct=abc; Path=/']);
  assert.ok(!cookie.includes('SESSDATA'));
  assert.ok(cookie.includes('bili_jct=abc'));
});

test('parseUid 从 cookie 提取 uid', () => {
  assert.strictEqual(parseUid('SESSDATA=x; DedeUserID=987654; bili_jct=y'), 987654);
  assert.strictEqual(parseUid('SESSDATA=x'), 0);
});

test('buildCookieFromInfo 从 poll body 提取 cookie', () => {
  const data = {
    code: 0,
    mid: 555,
    cookie_info: {
      cookies: [
        { name: 'SESSDATA', value: 'sess1' },
        { name: 'bili_jct', value: 'jct1' },
        { name: 'DedeUserID', value: '555' },
        { name: 'DedeUserID__ckMd5', value: 'md51' },
        { name: '_uuid', value: 'junk' },
      ],
    },
  };
  const cookie = buildCookieFromInfo(data);
  assert.ok(cookie.includes('SESSDATA=sess1'));
  assert.ok(cookie.includes('DedeUserID=555'));
  assert.ok(!cookie.includes('_uuid'));
  assert.strictEqual(parseUid(cookie), 555);
});

test('evaluateNav 已登录返回 valid', () => {
  const r = evaluateNav({ code: 0, message: 'OK', data: { isLogin: true, uname: 'ZephyrZBD' } });
  assert.strictEqual(r.state, 'valid');
  assert.strictEqual(r.uname, 'ZephyrZBD');
});

test('evaluateNav code=-101 返回 invalid', () => {
  const r = evaluateNav({ code: -101, message: '账号未登录', data: { isLogin: false } });
  assert.strictEqual(r.state, 'invalid');
  assert.strictEqual(r.code, -101);
});

test('evaluateNav 未登录但 code=0 返回 invalid', () => {
  const r = evaluateNav({ code: 0, message: 'OK', data: { isLogin: false } });
  assert.strictEqual(r.state, 'invalid');
});

test('evaluateNav 其他 code 或异常响应返回 unknown', () => {
  assert.strictEqual(evaluateNav({ code: -403, message: '风控拦截' }).state, 'unknown');
  assert.strictEqual(evaluateNav(null).state, 'unknown');
  assert.strictEqual(evaluateNav({ code: 'oops' }).state, 'unknown');
});
