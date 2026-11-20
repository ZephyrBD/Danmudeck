import type { QueueImportItem, QueueItem, QueueMove } from '@/types/models'

// 队列导出 / 解析 / 合并（plan §7 / §8）
// 数组顺序即队列顺序；同 uid 保留 joinedAt 更早者

export const QUEUE_SCHEMA = 1
export const QUEUE_APP = 'danmudeck'
export const MAX_IMPORT_ITEMS = 1000

export interface QueueFileItem {
  id?: string
  uid: number
  user: string
  color: string
  joinedAt: number
  done: boolean
  completedAt: number
  moves?: QueueMove[]
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
        id: it.id,
        uid: it.uid,
        user: it.user || '匿名',
        color: it.color ?? '',
        joinedAt: it.joinedAt,
        done: !!it.done,
        completedAt: it.completedAt ?? 0,
      }
      if (it.moves && it.moves.length) item.moves = it.moves
      return item
    }),
  }
}

/** 逐条校验 moves 数组；非法条目整条丢弃，避免脏数据流进预览 */
function toMoves(raw: unknown): QueueMove[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: QueueMove[] = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue
    const r = m as Record<string, unknown>
    const at = Number(r.at)
    const from = Number(r.from)
    const to = Number(r.to)
    if (!Number.isFinite(at) || at <= 0) continue
    if (!Number.isInteger(from) || from < 1 || !Number.isInteger(to) || to < 1) continue
    if (r.by !== 'gift' && r.by !== 'admin') continue
    const move: QueueMove = {
      id: typeof r.id === 'string' && r.id ? r.id : `local-${at}-${out.length}`,
      at,
      from,
      to,
      by: r.by,
    }
    if (typeof r.gift === 'string' && r.gift) move.gift = r.gift.slice(0, 50)
    out.push(move)
  }
  return out.length ? out : undefined
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
    id: typeof r.id === 'string' && r.id ? r.id : '',
    uid,
    user: String(r.user ?? '').slice(0, 50) || '匿名',
    color: typeof r.color === 'string' ? r.color : '',
    joinedAt,
    done: r.done,
    completedAt: Number.isFinite(Number(r.completedAt)) ? Number(r.completedAt) : 0,
  }
  const moves = toMoves(r.moves)
  if (moves) item.moves = moves
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
  // 去重键：优先雪花 ID（同 uid 的已完成记录与重新排队记录可共存），无 ID 时回退 uid
  const seen = new Set<string>()
  const items: QueueFileItem[] = []
  let ignored = 0
  for (const raw of root.items) {
    if (items.length >= MAX_IMPORT_ITEMS) {
      // 与服务端上限对齐：超出部分计入忽略，避免预览到确认才被 400 打回
      ignored += 1
      continue
    }
    const item = toFileItem(raw)
    const key = item ? (item.id ? `id:${item.id}` : `uid:${item.uid}`) : ''
    if (!item || seen.has(key)) {
      ignored += 1
      continue
    }
    seen.add(key)
    items.push(item)
  }
  return { ok: true, items, ignored }
}

/**
 * 合并预览：以本机顺序为骨架；文件独有条目默认勾选并追加到末尾；
 * 同 uid 由 joinedAt 更早者胜出（plan §8）。
 */
export function mergePreview(local: QueueItem[], fileItems: QueueFileItem[]): MergePreview {
  // 用雪花 ID（缺省回退 uid）定位，避免同一 uid 的已完成记录与重新排队记录互相覆盖
  const keyOf = (it: { id?: string; uid: number }): string => (it.id ? `id:${it.id}` : `uid:${it.uid}`)
  const fileById = new Map<string, QueueFileItem>()
  for (const item of fileItems) {
    const prev = fileById.get(keyOf(item))
    if (!prev || item.joinedAt < prev.joinedAt) fileById.set(keyOf(item), item)
  }

  const rows: MergeRow[] = []
  const localKeys = new Set<string>()
  let replaced = 0
  let kept = 0

  for (const it of local) {
    localKeys.add(keyOf(it))
    const fromFile = fileById.get(keyOf(it))
    if (fromFile && fromFile.joinedAt < it.joinedAt) {
      rows.push({ uid: it.uid, item: fromFile, kind: 'replace', checked: true })
      replaced += 1
    } else {
      const localItem: QueueFileItem = {
        id: it.id,
        uid: it.uid,
        user: it.user || '匿名',
        color: it.color ?? '',
        joinedAt: it.joinedAt,
        done: !!it.done,
        completedAt: it.completedAt ?? 0,
      }
      if (it.moves && it.moves.length) localItem.moves = it.moves
      rows.push({ uid: it.uid, item: localItem, kind: 'keep', checked: true })
      if (fromFile) kept += 1
    }
  }

  let added = 0
  const orderedFileItems = fileItems.slice().sort((a, b) => a.joinedAt - b.joinedAt)
  for (const item of orderedFileItems) {
    if (localKeys.has(keyOf(item))) continue
    if (fileById.get(keyOf(item)) !== item) continue
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
        id: r.item.id,
        uid: r.item.uid,
        user: r.item.user,
        color: r.item.color,
        joinedAt: r.item.joinedAt,
        done: r.item.done,
      }
      if (r.item.done) item.completedAt = r.item.completedAt
      if (r.item.moves && r.item.moves.length) item.moves = r.item.moves
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
