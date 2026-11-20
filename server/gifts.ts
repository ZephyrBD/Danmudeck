export interface GiftRule {
  giftId: number;
  giftName?: string;
  threshold: number;
  mode: 'top' | 'up';
  steps: number;
}

export interface GiftEvent {
  uid: number;
  giftId: number;
  num: number;
  [key: string]: unknown;
}

export interface GiftEffect {
  rule: GiftRule;
  times: number;
}

// 从 GIFT_RULES JSON 字符串解析规则数组（容错，非法返回 []）
export function parseRules(json: unknown): GiftRule[] {
  if (!json || !String(json).trim()) return [];
  try {
    const parsed = JSON.parse(String(json));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidRule) as GiftRule[];
  } catch {
    return [];
  }
}

export function isValidRule(rule: unknown): boolean {
  const r = rule as GiftRule | null;
  return !!r
    && Number.isInteger(r.giftId) && r.giftId > 0
    && Number.isInteger(r.threshold) && r.threshold > 0
    && (r.mode === 'top' || r.mode === 'up')
    && (r.mode === 'top' || (Number.isInteger(r.steps) && r.steps > 0));
}

type NormalizeResult =
  | { ok: true; rules: GiftRule[] }
  | { ok: false; error: string };

export function normalizeRules(rules: unknown): NormalizeResult {
  if (!Array.isArray(rules)) return { ok: false, error: '规则必须是数组' };
  for (const [i, raw] of rules.entries()) {
    const r = raw as Record<string, unknown> | null;
    if (!r || typeof r !== 'object') return { ok: false, error: `第 ${i + 1} 条规则格式错误` };
    const giftId = Number(r.giftId);
    const threshold = Number(r.threshold);
    const steps = r.mode === 'up' ? Number(r.steps) : 0;
    if (!Number.isInteger(giftId) || giftId <= 0) {
      return { ok: false, error: `第 ${i + 1} 条规则：礼物 ID 无效` };
    }
    if (!Number.isInteger(threshold) || threshold <= 0 || threshold > 100000) {
      return { ok: false, error: `第 ${i + 1} 条规则：阈值需在 1-100000 之间` };
    }
    if (r.mode !== 'top' && r.mode !== 'up') {
      return { ok: false, error: `第 ${i + 1} 条规则：效果必须是 top 或 up` };
    }
    if (r.mode === 'up' && (!Number.isInteger(steps) || steps <= 0 || steps > 50)) {
      return { ok: false, error: `第 ${i + 1} 条规则：前进位数需在 1-50 之间` };
    }
  }
  return {
    ok: true,
    rules: (rules as Record<string, unknown>[]).map((r) => ({
      giftId: Number(r.giftId),
      giftName: String(r.giftName || '').slice(0, 50),
      threshold: Number(r.threshold),
      mode: r.mode as 'top' | 'up',
      steps: r.mode === 'up' ? Number(r.steps) : 0,
    })),
  };
}

// 累计送礼并计算触发的插队效果（不直接操作队列）
export class GiftEngine {
  rules: GiftRule[] = [];
  counts: Map<string, number> = new Map();

  constructor(rules: GiftRule[] = []) {
    this.reload(rules);
  }

  reload(rules: GiftRule[]): void {
    this.rules = Array.isArray(rules) ? rules.filter(isValidRule) : [];
    this.counts = new Map();
  }

  key(uid: number, giftId: number): string {
    return `${uid}:${giftId}`;
  }

  recordGift({ uid, giftId, num }: GiftEvent): GiftEffect[] {
    if (!uid || !giftId || !Number.isInteger(num) || num <= 0) return [];
    const matched = this.rules.filter((r) => r.giftId === giftId);
    if (!matched.length) return [];

    const k = this.key(uid, giftId);
    const before = this.counts.get(k) || 0;
    const after = before + num;
    this.counts.set(k, after);

    const effects: GiftEffect[] = [];
    for (const rule of matched) {
      const beforeLevel = Math.floor(before / rule.threshold);
      const afterLevel = Math.floor(after / rule.threshold);
      if (afterLevel > beforeLevel) {
        effects.push({ rule, times: afterLevel - beforeLevel });
      }
    }
    return effects;
  }

  reset(): void {
    this.counts = new Map();
  }
}
