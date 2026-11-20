import type { QueueImportItem, QueueItem } from '@/types/models'

// 队列导出 / 解析 / 合并（plan §7 / §8）
// 数组顺序即队列顺序；同 uid 保留 joinedAt 更早者

export const QUEUE_SCHEMA = 1
export const QUEUE_APP = 'danmudeck'
export const MAX_IMPORT_ITEMS = 1000

export interface QueueFileItem {
  uid: number
  user: string
  color: string
  joinedAt: number
  done: boolean
  completedAt: number
  skippedAt?: number
}

export interface QueueFile {
  app: typeof QUEUE_APP
  schema: number
  exportedAt: string
  items: QueueFileItem[]
}

export interface ParseResult {
  ok: boolean
  error?: string
  items: QueueFileItem[]
  /** 单条非法被跳过的数量 */
  ignored: number
}

export type MergeKind = 'keep' | 'new' | 'replace' | 'append'

export interface MergeRow {
  /** 预览行稳定 key：uid */
  uid: number
  item: QueueFileItem
  kind: MergeKind
  /** 默认是否勾选 */
  checked: boolean
}

export interface MergeStats {
  /** 新增（文件独有） */
  added: number
  /** 替换（文件记录更早，原位替换本机） */
  replaced: number
  /** 保留（本机记录更早或更晚入队，文件项不采用） */
  kept: number
  /** 本机独有、保持原样的条目 */
  local: number
}

export interface MergePreview {
  rows: MergeRow[]
  stats: MergeStats
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function queueFileName(date: Date = new Date()): string {
  const ymd = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const hm = `${pad(date.getHours())}${pad(date.getMinutes())}`
  return `danmudeck-queue-${ymd}-${hm}.json`
}

export function buildExportFile(queue: QueueItem[], now: Date = new Date()): QueueFile {
  return {
    app: QUEUE_APP,
    schema: QUEUE_SCHEMA,
    exportedAt: now.toISOString(),
    items: queue.map((it) => {
      const item: QueueFileItem = {
        uid: it.uid,
        user: it.user || '匿名',
        color: it.color ?? '',
        joinedAt: it.joinedAt,
        done: !!it.done,
        completedAt: it.completedAt ?? 0,
      }
      if (it.skippedAt) item.skippedAt = it.skippedAt
      return item
    }),
  }
}

function toFileItem(raw: unknown): QueueFileItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const uid = Number(r.uid)
  const joinedAt = Number(r.joinedAt)
  if (!Number.isInteger(uid) || uid <= 0) return null
  if (!Number.isFinite(joinedAt)) return null
  if (typeof r.done !== 'boolean') return null
  const item: QueueFileItem = {
    uid,
    user: String(r.user ?? '').slice(0, 50) || '匿名',
    color: typeof r.color === 'string' ? r.color : '',
    joinedAt,
    done: r.done,
    completedAt: Number.isFinite(Number(r.completedAt)) ? Number(r.completedAt) : 0,
  }
  if (Number.isFinite(Number(r.skippedAt)) && Number(r.skippedAt) > 0) item.skippedAt = Number(r.skippedAt)
  return item
}

export function parseQueueFile(text: string): ParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: '这不是 DanmuDeck 的队列文件：不是合法 JSON', items: [], ignored: 0 }
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { ok: false, error: '这不是 DanmuDeck 的队列文件：顶层必须是对象', items: [], ignored: 0 }
  }
  const root = json as Record<string, unknown>
  if (!Array.isArray(root.items)) {
    return { ok: false, error: '这不是 DanmuDeck 的队列文件：缺少 items 数组', items: [], ignored: 0 }
  }
  const seen = new Set<number>()
  const items: QueueFileItem[] = []
  let ignored = 0
  for (const raw of root.items) {
    if (items.length >= MAX_IMPORT_ITEMS) {
      // 与服务端上限对齐：超出部分计入忽略，避免预览到确认才被 400 打回
      ignored += 1
      continue
    }
    const item = toFileItem(raw)
    if (!item || seen.has(item.uid)) {
      ignored += 1
      continue
    }
    seen.add(item.uid)
    items.push(item)
  }
  return { ok: true, items, ignored }
}

/**
 * 合并预览：以本机顺序为骨架；文件独有条目默认勾选并追加到末尾；
 * 同 uid 由 joinedAt 更早者胜出（plan §8）。
 */
export function mergePreview(local: QueueItem[], fileItems: QueueFileItem[]): MergePreview {
  const fileByUid = new Map<number, QueueFileItem>()
  for (const item of fileItems) {
    const prev = fileByUid.get(item.uid)
    if (!prev || item.joinedAt < prev.joinedAt) fileByUid.set(item.uid, item)
  }

  const rows: MergeRow[] = []
  const localUids = new Set<number>()
  let replaced = 0
  let kept = 0

  for (const it of local) {
    localUids.add(it.uid)
    const fromFile = fileByUid.get(it.uid)
    if (fromFile && fromFile.joinedAt < it.joinedAt) {
      rows.push({ uid: it.uid, item: fromFile, kind: 'replace', checked: true })
      replaced += 1
    } else {
      const localItem: QueueFileItem = {
        uid: it.uid,
        user: it.user || '匿名',
        color: it.color ?? '',
        joinedAt: it.joinedAt,
        done: !!it.done,
        completedAt: it.completedAt ?? 0,
      }
      if (it.skippedAt) localItem.skippedAt = it.skippedAt
      rows.push({ uid: it.uid, item: localItem, kind: 'keep', checked: true })
      if (fromFile) kept += 1
    }
  }

  let added = 0
  const orderedFileItems = fileItems.slice().sort((a, b) => a.joinedAt - b.joinedAt)
  for (const item of orderedFileItems) {
    if (localUids.has(item.uid)) continue
    if (fileByUid.get(item.uid) !== item) continue
    rows.push({ uid: item.uid, item, kind: 'append', checked: true })
    added += 1
  }

  return {
    rows,
    stats: { added, replaced, kept, local: local.length },
  }
}

/** 按勾选与当前顺序生成导入请求体（plan §6.4） */
export function buildImportItems(rows: MergeRow[]): QueueImportItem[] {
  return rows
    .filter((r) => r.checked)
    .map((r) => {
      const item: QueueImportItem = {
        uid: r.item.uid,
        user: r.item.user,
        color: r.item.color,
        joinedAt: r.item.joinedAt,
        done: r.item.done,
      }
      if (r.item.done) item.completedAt = r.item.completedAt
      if (r.item.skippedAt) item.skippedAt = r.item.skippedAt
      return item
    })
}

/** 在数组内把 from 位置移动到 to 位置（预览拖拽排序） */
export function moveRow<T>(rows: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return rows
  const next = rows.slice()
  const [picked] = next.splice(from, 1)
  next.splice(to, 0, picked)
  return next
}
