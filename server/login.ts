import QRCode from 'qrcode';
import { saveAuth } from './settings';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const QR_GENERATE = 'https://passport.bilibili.com/x/passport-login/web/qrcode/generate';
const QR_POLL = 'https://passport.bilibili.com/x/passport-login/web/qrcode/poll';

const COOKIE_KEYS = ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'buvid3', 'buvid4'];

export type LoginPhase = 'idle' | 'generating' | 'waiting' | 'scanned' | 'expired' | 'error' | 'logged_in';

export interface LoginState {
  phase: LoginPhase;
  qrcodeKey: string;
  url: string;
  qrDataUrl: string;
  scanned: boolean;
  expired: boolean;
  error: string;
  uid: number;
}

export function getSetCookie(headers: Headers): string[] {
  if (typeof (headers as any).getSetCookie === 'function') return (headers as any).getSetCookie();
  const v = headers.get('set-cookie');
  if (!v) return [];
  return v.split(/,(?=\s*[A-Za-z_][A-Za-z0-9_]*=)/);
}

export function buildCookie(setCookie: string[]): string {
  const parts: string[] = [];
  for (const entry of setCookie) {
    const kv = entry.split(';')[0];
    const key = kv.split('=')[0].trim();
    if (COOKIE_KEYS.includes(key) && kv.includes('=')) parts.push(kv.trim());
  }
  return parts.join('; ');
}

export function buildCookieFromInfo(data: any): string {
  const cookies = data && data.cookie_info && Array.isArray(data.cookie_info.cookies)
    ? data.cookie_info.cookies
    : [];
  const parts: string[] = [];
  for (const c of cookies) {
    if (c && c.name && c.value !== undefined && COOKIE_KEYS.includes(c.name)) {
      parts.push(`${c.name}=${c.value}`);
    }
  }
  return parts.join('; ');
}

export function parseUid(cookie: string): number {
  const m = cookie.match(/DedeUserID=(\d+)/);
  return m ? Number(m[1]) : 0;
}

const NAV_URL = 'https://api.bilibili.com/x/web-interface/nav';

export interface NavResult {
  state: 'valid' | 'invalid' | 'unknown';
  code: number | null;
  message: string;
  uname: string;
}

// 解析 nav 接口响应，判断登录态：'valid' | 'invalid' | 'unknown'
export function evaluateNav(json: any): NavResult {
  if (!json || typeof json.code !== 'number') {
    return { state: 'unknown', code: null, message: '响应格式异常', uname: '' };
  }
  const uname = (json.data && json.data.uname) || '';
  if (json.code === 0 && json.data && json.data.isLogin === true) {
    return { state: 'valid', code: 0, message: 'OK', uname };
  }
  if (json.code === -101 || (json.data && json.data.isLogin === false)) {
    return { state: 'invalid', code: json.code, message: json.message || '账号未登录', uname: '' };
  }
  return { state: 'unknown', code: json.code, message: json.message || '', uname };
}

type FetchLike = typeof fetch;

// 检查 Cookie 登录态是否有效。网络错误抛异常，由调用方按 unknown 处理。
export async function checkCookieLogin(cookie: string, fetchImpl: FetchLike = fetch): Promise<NavResult> {
  const res = await fetchImpl(NAV_URL, {
    headers: { 'User-Agent': UA, Cookie: cookie },
  });
  if (!res.ok) throw new Error(`nav 请求失败: HTTP ${res.status}`);
  const json: any = await res.json();
  return evaluateNav(json);
}

export class QrLogin {
  onLoggedIn: ((cookie: string, uid: number) => void) | null;
  timer: NodeJS.Timeout | null;
  state: LoginState;
  pollCookie: string;

  constructor({ onLoggedIn }: { onLoggedIn?: (cookie: string, uid: number) => void } = {}) {
    this.onLoggedIn = onLoggedIn || null;
    this.timer = null;
    this.pollCookie = '';
    this.state = {
      phase: 'idle',
      qrcodeKey: '',
      url: '',
      qrDataUrl: '',
      scanned: false,
      expired: false,
      error: '',
      uid: 0,
    };
  }

  getStatus(): LoginState {
    return { ...this.state };
  }

  stop(): void {
    clearTimeout(this.timer as NodeJS.Timeout);
    this.timer = null;
  }

  async start(): Promise<void> {
    this.stop();
    this.state = {
      phase: 'generating',
      qrcodeKey: '',
      url: '',
      qrDataUrl: '',
      scanned: false,
      expired: false,
      error: '',
      uid: 0,
    };
    try {
      const res = await fetch(QR_GENERATE, { headers: { 'User-Agent': UA } });
      this.pollCookie = buildCookie(getSetCookie(res.headers));
      const json: any = await res.json();
      if (json.code !== 0 || !json.data || !json.data.qrcode_key) {
        throw new Error(`生成二维码失败: code=${json.code} message=${json.message}`);
      }
      this.state.qrcodeKey = json.data.qrcode_key;
      this.state.url = json.data.url;
      this.state.qrDataUrl = await QRCode.toDataURL(json.data.url, { margin: 1, width: 240 });
      this.state.phase = 'waiting';
      this.schedulePoll(0);
    } catch (e) {
      this.state.error = (e as Error).message;
      this.state.phase = 'error';
    }
  }

  schedulePoll(delay: number): void {
    clearTimeout(this.timer as NodeJS.Timeout);
    this.timer = setTimeout(() => this.poll(), delay);
  }

  async poll(): Promise<void> {
    if (this.state.phase !== 'waiting' && this.state.phase !== 'scanned') return;
    try {
      const res = await fetch(`${QR_POLL}?qrcode_key=${encodeURIComponent(this.state.qrcodeKey)}`, {
        headers: { 'User-Agent': UA, Cookie: this.pollCookie || '' },
      });
      const json: any = await res.json();
      const data = json && json.data;
      const code = data && typeof data.code === 'number' ? data.code : -1;

      if (code === 0) {
        const cookies = buildCookieFromInfo(data) || buildCookie(getSetCookie(res.headers));
        const uid = data.mid || parseUid(cookies);
        this.finish(cookies, uid);
        return;
      }
      if (code === 86038) {
        this.state.expired = true;
        this.state.phase = 'expired';
        return;
      }
      this.state.scanned = code === 86090;
      this.state.phase = this.state.scanned ? 'scanned' : 'waiting';
      this.schedulePoll(2000);
    } catch (e) {
      this.state.error = (e as Error).message;
      this.schedulePoll(3000);
    }
  }

  finish(cookie: string, uid: number): void {
    if (!cookie) {
      this.state.error = '登录成功但未拿到 Cookie';
      this.state.phase = 'error';
      return;
    }
    this.state.uid = uid;
    this.state.phase = 'logged_in';
    // 扫码成功先落盘凭据；昵称由 index.ts 通过 nav 接口补齐
    saveAuth({ cookie, uid, uname: '', updatedAt: new Date().toISOString() });
    if (this.onLoggedIn) this.onLoggedIn(cookie, uid);
  }
}
