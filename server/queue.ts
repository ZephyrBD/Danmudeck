import { snowflake } from './snowflake';

/** 一次位置变动：礼物插队与管理员调整共用同一结构 */
export interface QueueMove {
  /** 雪花 ID，稳定唯一 key（不展示给用户） */
  id: string;
  /** 发生时间（毫秒） */
  at: number;
  /** 原位置（1 起） */
  from: number;
  /** 新位置（1 起） */
  to: number;
  /** 触发方 */
  by: 'gift' | 'admin';
  /** by='gift' 时的礼物名 */
  gift?: string;
}

export interface QueueItem {
  /** 雪花 ID，同一 uid 多次排队时区分不同条目 */
  id: string;
  uid: number;
  user: string;
  color: string;
  joinedAt: number;
  done: boolean;
  completedAt: number;
  /** 全部位置变动记录，按时间先后追加，全量保留 */
  moves?: QueueMove[];
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
  id?: string;
  uid: number;
  user: string;
  color?: string;
  joinedAt: number;
  done: boolean;
  completedAt?: number;
  moves?: QueueMove[];
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
    const item: QueueItem = { id: snowflake(), uid, user: user || '匿名', color: color || '', joinedAt: Date.now(), done: false, completedAt: 0 };
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

  move(
    uid: number,
    toIndex: number,
    { by = 'admin', gift }: { by?: 'gift' | 'admin'; gift?: string } = {}
  ): { ok: true; item: QueueItem; position: number } | { ok: false; reason: QueueFailReason } {
    const from = this.indexOf(uid, false);
    if (from === -1) return { ok: false, reason: 'not_found' };
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= this.items.length) {
      return { ok: false, reason: 'bad_index' };
    }
    // 原地不动不产生记录，避免刷出无意义的 moves
    if (from === toIndex) {
      return { ok: true, item: this.items[from], position: toIndex + 1 };
    }
    const [item] = this.items.splice(from, 1);
    this.items.splice(toIndex, 0, item);
    // 礼物插队与管理员调整走同一条记录路径
    const entry: QueueMove = { id: snowflake(), at: Date.now(), from: from + 1, to: toIndex + 1, by };
    if (by === 'gift' && gift) entry.gift = gift;
    if (!item.moves) item.moves = [];
    item.moves.push(entry);
    return { ok: true, item, position: toIndex + 1 };
  }

  // 礼物插队：mode='top' 置顶，mode='up' 前进 steps 位
  skip(
    uid: number,
    mode: 'top' | 'up',
    steps = 0,
    user: SkipUser | null = null,
    gift?: string
  ): { ok: true; item?: QueueItem; position?: number } | { ok: false; reason: QueueFailReason } {
    const from = this.indexOf(uid, false);
    if (from === -1) {
      if (!user) return { ok: false, reason: 'not_found' };
      const entered = this.enter(user.uid, user.user, user.color);
      if (!entered.ok) return entered;
      // 新入队者位于队尾，再执行插队
      return this.skip(uid, mode, steps, null, gift);
    }
    const toIndex = mode === 'up'
      ? Math.max(0, from - Math.max(1, steps))
      : 0;
    return this.move(uid, toIndex, { by: 'gift', gift });
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
      id: it.id || snowflake(),
      uid: it.uid,
      user: it.user || '匿名',
      color: it.color || '',
      joinedAt: it.joinedAt,
      done: !!it.done,
      completedAt: it.done ? it.completedAt || Date.now() : 0,
      moves: it.moves,
    }));
  }
}
