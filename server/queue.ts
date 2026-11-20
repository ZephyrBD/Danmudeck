export interface QueueItem {
  uid: number;
  user: string;
  color: string;
  joinedAt: number;
  done: boolean;
  completedAt: number;
  skippedAt?: number;
}

export interface QueueListEntry extends QueueItem {
  position: number;
}

export type QueueFailReason = 'no_uid' | 'already' | 'not_found' | 'bad_index';

export type QueueResult =
  | { ok: true; item: QueueItem; position: number }
  | { ok: true }
  | { ok: false; reason: QueueFailReason };

export interface QueueItemInput {
  uid: number;
  user: string;
  color?: string;
  joinedAt: number;
  done: boolean;
  completedAt?: number;
  skippedAt?: number;
}

interface QueueOptions {
  enterKey?: string;
  leaveKey?: string;
}

export interface SkipUser {
  uid: number;
  user: string;
  color: string;
}

export class Queue {
  enterKey: string;
  leaveKey: string;
  items: QueueItem[];

  constructor({ enterKey = '排队', leaveKey = '取消排队' }: QueueOptions = {}) {
    this.enterKey = enterKey;
    this.leaveKey = leaveKey;
    this.items = [];
  }

  setKeywords(enterKey: string, leaveKey: string): void {
    this.enterKey = enterKey;
    this.leaveKey = leaveKey;
  }

  list(): QueueListEntry[] {
    return this.items.map((item, i) => ({ ...item, position: i + 1 }));
  }

  activeList(): QueueListEntry[] {
    const active = this.items.filter((it) => !it.done);
    return active.map((item, i) => ({ ...item, position: i + 1 }));
  }

  enter(uid: number, user?: string, color?: string): { ok: true; position: number; item: QueueItem } | { ok: false; reason: QueueFailReason } {
    if (!uid) return { ok: false, reason: 'no_uid' };
    // 查重只针对未完成的条目，完成委托后可再次排队
    if (this.items.some((it) => it.uid === uid && !it.done)) return { ok: false, reason: 'already' };
    const item: QueueItem = { uid, user: user || '匿名', color: color || '', joinedAt: Date.now(), done: false, completedAt: 0 };
    this.items.push(item);
    return { ok: true, position: this.items.length, item };
  }

  leave(uid: number): { ok: true } | { ok: false; reason: QueueFailReason } {
    const idx = this.indexOf(uid, false);
    if (idx === -1) return { ok: false, reason: 'not_found' };
    this.items.splice(idx, 1);
    return { ok: true };
  }

  // 查找 uid 的下标；includeDone=false 时跳过已完成条目（避免“诈尸”操作）
  indexOf(uid: number, includeDone = true): number {
    return this.items.findIndex((it) => it.uid === uid && (includeDone || !it.done));
  }

  move(uid: number, toIndex: number, { markSkip = false }: { markSkip?: boolean } = {}): { ok: true; item: QueueItem; position: number } | { ok: false; reason: QueueFailReason } {
    const from = this.indexOf(uid, false);
    if (from === -1) return { ok: false, reason: 'not_found' };
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= this.items.length) {
      return { ok: false, reason: 'bad_index' };
    }
    if (from === toIndex) {
      if (markSkip) this.items[from].skippedAt = Date.now();
      return { ok: true, item: this.items[from], position: toIndex + 1 };
    }
    const [item] = this.items.splice(from, 1);
    this.items.splice(toIndex, 0, item);
    if (markSkip) item.skippedAt = Date.now();
    return { ok: true, item, position: toIndex + 1 };
  }

  // 礼物插队：mode='top' 置顶，mode='up' 前进 steps 位
  skip(uid: number, mode: 'top' | 'up', steps = 0, user: SkipUser | null = null): { ok: true; item?: QueueItem; position?: number } | { ok: false; reason: QueueFailReason } {
    const from = this.indexOf(uid, false);
    if (from === -1) {
      if (!user) return { ok: false, reason: 'not_found' };
      const entered = this.enter(user.uid, user.user, user.color);
      if (!entered.ok) return entered;
      // 新入队者位于队尾，再执行插队
      return this.skip(uid, mode, steps, null);
    }
    const toIndex = mode === 'up'
      ? Math.max(0, from - Math.max(1, steps))
      : 0;
    return this.move(uid, toIndex, { markSkip: true });
  }

  complete(uid: number): { ok: true; item: QueueItem } | { ok: false; reason: QueueFailReason } {
    const item = this.items.find((it) => it.uid === uid);
    if (!item) return { ok: false, reason: 'not_found' };
    if (!item.done) {
      item.done = true;
      item.completedAt = Date.now();
    }
    return { ok: true, item };
  }

  clearDone(): { ok: true; cleared: number } {
    const before = this.items.length;
    this.items = this.items.filter((it) => !it.done);
    return { ok: true, cleared: before - this.items.length };
  }

  reset(): { ok: true; cleared: number } {
    const cleared = this.items.length;
    this.items = [];
    return { ok: true, cleared };
  }

  // 导入：按传入数组顺序整体替换（位置由 list() 重算，plan §6.4）
  replace(items: QueueItemInput[]): void {
    this.items = items.map((it) => ({
      uid: it.uid,
      user: it.user || '匿名',
      color: it.color || '',
      joinedAt: it.joinedAt,
      done: !!it.done,
      completedAt: it.done ? it.completedAt || Date.now() : 0,
      skippedAt: it.skippedAt,
    }));
  }
}
