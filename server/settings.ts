import * as fs from 'fs';
import * as path from 'path';
import { isValidRule, type GiftRule } from './gifts';

// 配置持久化：server/data/settings.json（配置）+ server/data/auth.json（凭据）
// 旧 server/.env 不再读取、不再写入、不再删除（plan D27/D28）

export type QueueMode = 'list' | 'horizontal';

export interface OverlaySettings {
  showChat: number;
  chatMax: number;
  scMax: number;
  showQueue: number;
  queueMax: number;
  /** 横排 / 竖排，与是否流动互相独立 */
  queueMode: QueueMode;
  /** 流动开关：超出 queueMax 时自动翻页 */
  queueFlow: number;
  queueFlowSpeed: number;
  queueFlowPause: number;
}

export interface QueueSettings {
  enterKey: string;
  leaveKey: string;
}

export interface AppSettings {
  roomId: number | null;
  queue: QueueSettings;
  overlay: OverlaySettings;
  giftRules: GiftRule[];
}

export interface AuthData {
  cookie: string;
  uid: number;
  uname: string;
  updatedAt: string;
}

export function resolveDataDir(): string {
  const fromEnv = process.env.DANMUDECK_DATA_DIR;
  if (fromEnv && fromEnv.trim()) return path.resolve(fromEnv.trim());

  const packaged = Boolean((globalThis as Record<string, unknown>).__DANMUDECK_ENTRY__);
  if (packaged) {
    const exeDir = path.dirname(process.execPath);
    return path.join(exeDir, 'data');
  }
  return path.join(__dirname, 'data');
}

export const DATA_DIR = resolveDataDir();

export const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
export const AUTH_FILE = path.join(DATA_DIR, 'auth.json');

export const OVERLAY_LIMITS = {
  chatMax: { min: 1, max: 50 },
  scMax: { min: 1, max: 10 },
  queueMax: { min: 1, max: 50 },
  queueFlowSpeed: { min: 1, max: 15 },
  queueFlowPause: { min: 0, max: 15 },
} as const;

export const QUEUE_MODES: QueueMode[] = ['list', 'horizontal'];

export type WarnFn = (message: string) => void;

const defaultWarn: WarnFn = (message) => console.warn(`[设置] ${message}`);

export function defaultSettings(): AppSettings {
  return {
    roomId: null,
    queue: { enterKey: '排队', leaveKey: '取消排队' },
    overlay: {
      showChat: 1,
      chatMax: 8,
      scMax: 3,
      showQueue: 1,
      queueMax: 6,
      queueMode: 'list',
      queueFlow: 0,
      queueFlowSpeed: 3,
      queueFlowPause: 2,
    },
    giftRules: [],
  };
}

export function defaultAuth(): AuthData {
  return { cookie: '', uid: 0, uname: '', updatedAt: '' };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pickInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
  label: string,
  warn: WarnFn
): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    warn(`${label} 非法（${String(value)}），已回退默认值 ${fallback}`);
    return fallback;
  }
  return n;
}

function pickFlag(value: unknown, fallback: number, label: string, warn: WarnFn): number {
  if (value === undefined) return fallback;
  if (value === 0 || value === 1 || value === false || value === true) {
    return Number(value);
  }
  const n = Number(value);
  if (n === 0 || n === 1) return n;
  warn(`${label} 非法（${String(value)}），已回退默认值 ${fallback}`);
  return fallback;
}

function pickKeyword(value: unknown, fallback: string, label: string, warn: WarnFn): string {
  if (value === undefined) return fallback;
  const text = String(value).trim();
  if (!text || text.length > 20) {
    warn(`${label} 非法（需 1-20 字），已回退默认值 ${fallback}`);
    return fallback;
  }
  return text;
}

// 校验并归一化配置：非法字段逐项回退默认值并打日志，不阻塞启动（plan L10）
export function normalizeSettings(raw: unknown, warn: WarnFn = defaultWarn): AppSettings {
  const defaults = defaultSettings();
  const root = asRecord(raw);

  let roomId = defaults.roomId;
  if (root.roomId !== undefined && root.roomId !== null) {
    const n = Number(root.roomId);
    if (Number.isInteger(n) && n > 0) roomId = n;
    else warn(`roomId 非法（${String(root.roomId)}），已回退默认值 null`);
  }

  const rawQueue = asRecord(root.queue);
  let enterKey = pickKeyword(rawQueue.enterKey, defaults.queue.enterKey, 'queue.enterKey', warn);
  let leaveKey = pickKeyword(rawQueue.leaveKey, defaults.queue.leaveKey, 'queue.leaveKey', warn);
  if (enterKey === leaveKey) {
    warn('排队词与取消排队词相同，已回退默认值');
    enterKey = defaults.queue.enterKey;
    leaveKey = defaults.queue.leaveKey;
  }

  const rawOverlay = asRecord(root.overlay);
  const defaultsOverlay = defaults.overlay;
  // 旧版本的 queueMode='flow' 是「竖排 + 流动」的独立形态，直接迁移成新模型
  const legacyFlow = rawOverlay.queueMode === 'flow';
  const rawMode = legacyFlow ? 'list' : String(rawOverlay.queueMode ?? defaultsOverlay.queueMode);
  const queueMode = (QUEUE_MODES as string[]).includes(rawMode) ? (rawMode as QueueMode) : (() => {
    warn(`overlay.queueMode 非法（${String(rawOverlay.queueMode)}），已回退默认值 list`);
    return defaultsOverlay.queueMode;
  })();
  const queueFlow = legacyFlow
    ? 1
    : pickFlag(rawOverlay.queueFlow, defaultsOverlay.queueFlow, 'overlay.queueFlow', warn);

  const overlay: OverlaySettings = {
    showChat: pickFlag(rawOverlay.showChat, defaultsOverlay.showChat, 'overlay.showChat', warn),
    chatMax: pickInt(rawOverlay.chatMax, OVERLAY_LIMITS.chatMax.min, OVERLAY_LIMITS.chatMax.max, defaultsOverlay.chatMax, 'overlay.chatMax', warn),
    scMax: pickInt(rawOverlay.scMax, OVERLAY_LIMITS.scMax.min, OVERLAY_LIMITS.scMax.max, defaultsOverlay.scMax, 'overlay.scMax', warn),
    showQueue: pickFlag(rawOverlay.showQueue, defaultsOverlay.showQueue, 'overlay.showQueue', warn),
    queueMax: pickInt(rawOverlay.queueMax, OVERLAY_LIMITS.queueMax.min, OVERLAY_LIMITS.queueMax.max, defaultsOverlay.queueMax, 'overlay.queueMax', warn),
    queueMode,
    queueFlow,
    queueFlowSpeed: pickInt(rawOverlay.queueFlowSpeed, OVERLAY_LIMITS.queueFlowSpeed.min, OVERLAY_LIMITS.queueFlowSpeed.max, defaultsOverlay.queueFlowSpeed, 'overlay.queueFlowSpeed', warn),
    queueFlowPause: pickInt(rawOverlay.queueFlowPause, OVERLAY_LIMITS.queueFlowPause.min, OVERLAY_LIMITS.queueFlowPause.max, defaultsOverlay.queueFlowPause, 'overlay.queueFlowPause', warn),
  };

  let giftRules: GiftRule[] = [];
  if (root.giftRules !== undefined) {
    if (Array.isArray(root.giftRules)) {
      const valid = root.giftRules.filter(isValidRule) as GiftRule[];
      if (valid.length !== root.giftRules.length) {
        warn(`giftRules 有 ${root.giftRules.length - valid.length} 条非法规则，已忽略`);
      }
      giftRules = valid;
    } else {
      warn('giftRules 必须是数组，已回退为空');
    }
  }

  return { roomId, queue: { enterKey, leaveKey }, overlay, giftRules };
}

export function normalizeAuth(raw: unknown, warn: WarnFn = defaultWarn): AuthData {
  const defaults = defaultAuth();
  const root = asRecord(raw);
  const uid = Number(root.uid);
  const cookie = typeof root.cookie === 'string' ? root.cookie : '';
  if (root.cookie !== undefined && typeof root.cookie !== 'string') {
    warn('auth.cookie 非法，已回退为空');
  }
  if (root.uid !== undefined && (!Number.isInteger(uid) || uid < 0)) {
    warn(`auth.uid 非法（${String(root.uid)}），已回退为 0`);
  }
  return {
    cookie,
    uid: Number.isInteger(uid) && uid > 0 ? uid : defaults.uid,
    uname: typeof root.uname === 'string' ? root.uname : '',
    updatedAt: typeof root.updatedAt === 'string' ? root.updatedAt : '',
  };
}

export function readJsonFile(filePath: string, warn: WarnFn = defaultWarn): unknown {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    // 坏文件先挪走留证，避免下一次保存把用户全部配置静默覆盖成默认值（plan L10 + 数据安全）
    const backup = `${filePath}.corrupt-${Date.now()}`;
    try {
      fs.renameSync(filePath, backup);
      warn(`${filePath} 解析失败（${(e as Error).message}），已备份为 ${backup}，本次使用默认值`);
    } catch {
      warn(`${filePath} 解析失败（${(e as Error).message}），无法备份，本次使用默认值`);
    }
    return null;
  }
}

// 原子写：2 空格缩进 + 末尾换行，先写临时文件再 rename（plan L9）
let writeSeq = 0;

export function writeJsonFile(filePath: string, data: unknown): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  } catch (e) {
    throw new Error(`无法创建数据目录 ${path.dirname(filePath)}（${(e as Error).message}）`);
  }
  writeSeq += 1;
  const tmp = `${filePath}.${process.pid}.${writeSeq}.tmp`;
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* 临时文件可能已被 rename */
    }
    throw new Error(`无法写入 ${filePath}（${(e as Error).message}）。若程序放在 Program Files 等只读目录，请改用 DANMUDECK_DATA_DIR 指定可写目录`);
  }
}

export function loadSettings(filePath: string = SETTINGS_FILE, warn: WarnFn = defaultWarn): AppSettings {
  if (!fs.existsSync(filePath)) {
    const created = defaultSettings();
    writeJsonFile(filePath, created);
    return created;
  }
  return normalizeSettings(readJsonFile(filePath, warn), warn);
}

export function saveSettings(settings: AppSettings, filePath: string = SETTINGS_FILE): void {
  writeJsonFile(filePath, settings);
}

export function loadAuth(filePath: string = AUTH_FILE, warn: WarnFn = defaultWarn): AuthData {
  if (!fs.existsSync(filePath)) return defaultAuth();
  return normalizeAuth(readJsonFile(filePath, warn), warn);
}

export function saveAuth(auth: AuthData, filePath: string = AUTH_FILE): void {
  writeJsonFile(filePath, auth);
}

export function clearAuth(filePath: string = AUTH_FILE): void {
  writeJsonFile(filePath, defaultAuth());
}
