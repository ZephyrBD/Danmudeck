import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  defaultAuth,
  defaultSettings,
  loadAuth,
  loadSettings,
  normalizeAuth,
  normalizeSettings,
  resolveDataDir,
  saveAuth,
  saveSettings,
  clearAuth,
  type AppSettings,
} from '../settings';

function tmpFile(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-settings-'));
  return path.join(dir, name);
}

function collectWarnings(): { warnings: string[]; warn: (m: string) => void } {
  const warnings: string[] = [];
  return { warnings, warn: (m: string) => { warnings.push(m); } };
}

test('defaultSettings 含流动开关与流动参数默认值', () => {
  const d = defaultSettings();
  assert.strictEqual(d.roomId, null);
  assert.strictEqual(d.queue.enterKey, '排队');
  assert.strictEqual(d.queue.leaveKey, '取消排队');
  assert.strictEqual(d.overlay.queueMode, 'list');
  assert.strictEqual(d.overlay.queueFlow, 0);
  assert.strictEqual(d.overlay.queueFlowSpeed, 3);
  assert.strictEqual(d.overlay.queueFlowPause, 2);
  assert.deepStrictEqual(d.giftRules, []);
});

test('loadSettings 文件不存在时用默认值创建，2 空格缩进 + 末尾换行', () => {
  const file = tmpFile('settings.json');
  const s = loadSettings(file);
  assert.deepStrictEqual(s, defaultSettings());
  assert.ok(fs.existsSync(file));
  const raw = fs.readFileSync(file, 'utf8');
  assert.ok(raw.endsWith('\n'));
  assert.ok(raw.includes('\n  "roomId"'));
  assert.deepStrictEqual(JSON.parse(raw), defaultSettings());
});

test('saveSettings 后 loadSettings 原样读回', () => {
  const file = tmpFile('settings.json');
  const custom: AppSettings = {
    roomId: 1774678,
    queue: { enterKey: '上车', leaveKey: '下车' },
    overlay: {
      showChat: 0,
      chatMax: 5,
      scMax: 2,
      showQueue: 1,
      queueMax: 4,
      queueMode: 'horizontal',
      queueFlow: 1,
      queueFlowSpeed: 5,
      queueFlowPause: 1,
    },
    giftRules: [{ giftId: 1, giftName: '辣条', threshold: 10, mode: 'up', steps: 1 }],
  };
  saveSettings(custom, file);
  assert.deepStrictEqual(loadSettings(file), custom);
});

test('normalizeSettings 非法值逐项回退默认并打日志', () => {
  const { warnings, warn } = collectWarnings();
  const s = normalizeSettings(
    {
      roomId: -5,
      queue: { enterKey: '', leaveKey: '取消排队' },
      overlay: {
        showChat: 7,
        chatMax: 0,
        scMax: 99,
        showQueue: 1,
        queueMax: 'abc',
        queueMode: 'diagonal',
        queueFlow: 5,
        queueFlowSpeed: 0,
        queueFlowPause: 99,
      },
      giftRules: 'nope',
    },
    warn
  );
  const d = defaultSettings();
  assert.strictEqual(s.roomId, null);
  assert.strictEqual(s.queue.enterKey, d.queue.enterKey);
  assert.strictEqual(s.overlay.showChat, 1);
  assert.strictEqual(s.overlay.chatMax, d.overlay.chatMax);
  assert.strictEqual(s.overlay.scMax, d.overlay.scMax);
  assert.strictEqual(s.overlay.queueMax, d.overlay.queueMax);
  assert.strictEqual(s.overlay.queueMode, 'list');
  assert.strictEqual(s.overlay.queueFlow, 0);
  assert.strictEqual(s.overlay.queueFlowSpeed, 3);
  assert.strictEqual(s.overlay.queueFlowPause, 2);
  assert.deepStrictEqual(s.giftRules, []);
  assert.ok(warnings.length >= 8, `应逐项告警，实际 ${warnings.length}`);
});

test('normalizeSettings 合法值保留，非法礼物规则被过滤', () => {
  const { warnings, warn } = collectWarnings();
  const s = normalizeSettings(
    {
      roomId: 42,
      overlay: { queueMode: 'horizontal', queueFlow: 1, queueFlowSpeed: 15, queueFlowPause: 0, queueMax: 50 },
      giftRules: [
        { giftId: 1, threshold: 5, mode: 'up', steps: 2 },
        { giftId: 0, threshold: 5, mode: 'top' },
      ],
    },
    warn
  );
  assert.strictEqual(s.roomId, 42);
  assert.strictEqual(s.overlay.queueMode, 'horizontal');
  assert.strictEqual(s.overlay.queueFlow, 1);
  assert.strictEqual(s.overlay.queueFlowSpeed, 15);
  assert.strictEqual(s.overlay.queueFlowPause, 0);
  assert.strictEqual(s.overlay.queueMax, 50);
  assert.strictEqual(s.giftRules.length, 1);
  assert.ok(warnings.some((w) => w.includes('giftRules')));
});

test('normalizeSettings 把旧 queueMode=flow 迁移成竖排 + 流动', () => {
  const { warnings, warn } = collectWarnings();
  const s = normalizeSettings(
    { overlay: { queueMode: 'flow', queueMax: 6, queueFlowSpeed: 4, queueFlowPause: 1 } },
    warn
  );
  assert.strictEqual(s.overlay.queueMode, 'list');
  assert.strictEqual(s.overlay.queueFlow, 1);
  assert.strictEqual(s.overlay.queueFlowSpeed, 4);
  assert.strictEqual(s.overlay.queueFlowPause, 1);
  // 迁移是正常路径，不应产生告警
  assert.deepStrictEqual(warnings, []);
});

test('normalizeSettings 排队词相同时回退默认', () => {
  const { warnings, warn } = collectWarnings();
  const s = normalizeSettings({ queue: { enterKey: '排队', leaveKey: '排队' } }, warn);
  assert.strictEqual(s.queue.leaveKey, defaultSettings().queue.leaveKey);
  assert.ok(warnings.some((w) => w.includes('相同')));
});

test('损坏的 settings.json 读取失败时回退默认值并备份原文件', () => {
  const file = tmpFile('settings.json');
  fs.writeFileSync(file, '{ broken', 'utf8');
  const { warnings, warn } = collectWarnings();
  const s = loadSettings(file, warn);
  assert.deepStrictEqual(s, defaultSettings());
  assert.ok(warnings.some((w) => w.includes('corrupt')), '应提示已备份');
  const backup = fs.readdirSync(path.dirname(file)).find((n) => n.startsWith('settings.json.corrupt-'));
  assert.ok(backup, '原文件应被备份而不是原地丢弃');
  assert.strictEqual(fs.readFileSync(path.join(path.dirname(file), backup!), 'utf8'), '{ broken');
});

test('auth：save/load/clear 往返，uid 非正整数回退 0', () => {
  const file = tmpFile('auth.json');
  assert.deepStrictEqual(loadAuth(file), defaultAuth());
  saveAuth({ cookie: 'SESSDATA=x', uid: 10001, uname: '昵称', updatedAt: '2026-11-20T08:30:00.000Z' }, file);
  assert.deepStrictEqual(loadAuth(file), {
    cookie: 'SESSDATA=x',
    uid: 10001,
    uname: '昵称',
    updatedAt: '2026-11-20T08:30:00.000Z',
  });
  clearAuth(file);
  assert.deepStrictEqual(loadAuth(file), defaultAuth());

  const { warn } = collectWarnings();
  const bad = normalizeAuth({ cookie: 5, uid: -1, uname: 3 }, warn);
  assert.deepStrictEqual(bad, defaultAuth());
});

test('resolveDataDir：源码运行落在 server/data，打包运行落在 exe 同级 data', () => {
  const g = globalThis as Record<string, unknown>;
  const savedEntry = g.__DANMUDECK_ENTRY__;
  const savedEnv = process.env.DANMUDECK_DATA_DIR;
  const savedExec = process.execPath;
  try {
    delete g.__DANMUDECK_ENTRY__;
    delete process.env.DANMUDECK_DATA_DIR;
    assert.strictEqual(resolveDataDir(), path.join(__dirname, '..', 'data'));

    // 模拟单文件 exe：bundle-entry.ts 注入的标记 + 可执行文件路径
    g.__DANMUDECK_ENTRY__ = true;
    process.execPath = path.join('D:', 'Tools', 'DanmuDeck', 'danmudeck.exe');
    assert.strictEqual(resolveDataDir(), path.join('D:', 'Tools', 'DanmuDeck', 'data'));

    // 环境变量优先级最高，用于程序放在只读目录时重定向
    process.env.DANMUDECK_DATA_DIR = path.join(os.tmpdir(), 'dd-custom');
    assert.strictEqual(resolveDataDir(), path.join(os.tmpdir(), 'dd-custom'));
  } finally {
    process.execPath = savedExec;
    if (savedEnv === undefined) delete process.env.DANMUDECK_DATA_DIR;
    else process.env.DANMUDECK_DATA_DIR = savedEnv;
    if (savedEntry === undefined) delete g.__DANMUDECK_ENTRY__;
    else g.__DANMUDECK_ENTRY__ = savedEntry;
  }
});

test('writeJsonFile 生成目录失败时抛出可读错误', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-bad-'));
  const blocker = path.join(dir, 'file-not-dir');
  fs.writeFileSync(blocker, 'x');
  try {
    assert.throws(
      () => saveSettings(defaultSettings(), path.join(blocker, 'settings.json')),
      /无法创建数据目录/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
