import * as crypto from 'crypto';

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52,
];

const FILTER_CHARS = "!'()*";

function getMixinKey(orig: string): string {
  return MIXIN_KEY_ENC_TAB.map((n) => orig[n]).join('').slice(0, 32);
}

function filter(value: unknown): string {
  return String(value)
    .split('')
    .filter((c) => !FILTER_CHARS.includes(c))
    .join('');
}

export function encodeWbi(params: Record<string, unknown>, imgUrl: string, subUrl: string, _cookie?: string): string {
  const imgKey = imgUrl.slice(imgUrl.lastIndexOf('/') + 1, imgUrl.lastIndexOf('.'));
  const subKey = subUrl.slice(subUrl.lastIndexOf('/') + 1, subUrl.lastIndexOf('.'));
  const mixinKey = getMixinKey(imgKey + subKey);

  const wts = Math.round(Date.now() / 1000);
  const signed: Record<string, unknown> = { ...params, wts };

  const query = Object.keys(signed)
    .sort()
    .map((key) => `${filter(key)}=${encodeURIComponent(filter(signed[key]))}`)
    .join('&');

  const wRid = crypto.createHash('md5').update(query + mixinKey).digest('hex');
  return `${query}&w_rid=${wRid}`;
}

export async function fetchWbiKeys(cookie?: string): Promise<{ imgUrl: string; subUrl: string }> {
  const url = 'https://api.bilibili.com/x/web-interface/nav';
  const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`nav 请求失败: HTTP ${res.status}`);
  const json: any = await res.json();
  const img = json && json.data && json.data.wbi_img;
  if (!img || !img.img_url || !img.sub_url) {
    throw new Error(`nav 未返回 wbi_img: code=${json && json.code}, message=${json && json.message}`);
  }
  return { imgUrl: img.img_url, subUrl: img.sub_url };
}

export async function signWbi(params: Record<string, unknown>, cookie?: string): Promise<string> {
  const keys = await fetchWbiKeys(cookie);
  return encodeWbi(params, keys.imgUrl, keys.subUrl, cookie);
}
