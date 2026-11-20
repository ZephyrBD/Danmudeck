import { describe, it, expect } from 'vitest'
import {
  buildExportFile,
  buildImportItems,
  mergePreview,
  moveRow,
  parseQueueFile,
  queueFileName,
  type QueueFileItem,
} from '@/view/manage/composables/queueFile'
import type { QueueItem } from '@/types/models'

function local(uid: number, joinedAt: number, extra: Partial<QueueItem> = {}): QueueItem {
  return { id: `l${uid}-${joinedAt}`, uid, user: `u${uid}`, position: uid, done: false, joinedAt, ...extra }
}

function fileItem(uid: number, joinedAt: number, extra: Partial<QueueFileItem> = {}): QueueFileItem {
  return { id: `f${uid}-${joinedAt}`, uid, user: `f${uid}`, color: '', joinedAt, done: false, completedAt: 0, ...extra }
}

describe('buildExportFile', () => {
  it('导出全量（含已完成）并按队列顺序排列', () => {
    const queue = [
      local(2, 200),
      local(1, 100, { color: '#fff', done: true, completedAt: 300 }),
      local(3, 300, { moves: [{ id: 'm1', at: 400, from: 3, to: 1, by: 'gift', gift: '辣条' }] }),
    ]
    const file = buildExportFile(queue, new Date('2026-11-20T08:30:00.000Z'))
    expect(file.app).toBe('danmudeck')
    expect(file.schema).toBe(1)
    expect(file.exportedAt).toBe('2026-11-20T08:30:00.000Z')
    expect(file.items.map((i) => i.uid)).toEqual([2, 1, 3])
    expect(file.items[1]).toMatchObject({ uid: 1, color: '#fff', done: true, completedAt: 300 })
    expect(file.items[1].moves).toBeUndefined()
    expect(file.items[2].moves?.[0]).toMatchObject({ id: 'm1', by: 'gift', gift: '辣条' })
  })

  it('文件名带日期与时分', () => {
    expect(queueFileName(new Date(2026, 10, 20, 8, 5))).toBe('danmudeck-queue-20261120-0805.json')
  })
})

describe('parseQueueFile', () => {
  it('非 JSON / 非对象 / 缺 items 均提示不是 DanmuDeck 文件', () => {
    expect(parseQueueFile('oops').error).toMatch(/不是 DanmuDeck 的队列文件/)
    expect(parseQueueFile('[]').error).toMatch(/不是 DanmuDeck 的队列文件/)
    expect(parseQueueFile('{"items":"x"}').error).toMatch(/不是 DanmuDeck 的队列文件/)
  })

  it('单条非法跳过并计入忽略，同 key 去重', () => {
    const text = JSON.stringify({
      app: 'danmudeck',
      items: [
        fileItem(1, 100),
        { uid: 0, joinedAt: 1, done: false },
        { uid: 2, joinedAt: 'x', done: false },
        { uid: 3, joinedAt: 1, done: 'yes' },
        fileItem(1, 100), // 同 id 重复
        fileItem(4, 400, { done: true, completedAt: 500 }),
      ],
    })
    const r = parseQueueFile(text)
    expect(r.ok).toBe(true)
    expect(r.items.map((i) => i.uid)).toEqual([1, 4])
    expect(r.ignored).toBe(4)
  })

  it('同一 uid 的已完成记录与重新排队记录可以共存', () => {
    const text = JSON.stringify({
      items: [
        { id: 'a', uid: 7, user: '甲', joinedAt: 100, done: true, completedAt: 200 },
        { id: 'b', uid: 7, user: '甲', joinedAt: 300, done: false },
      ],
    })
    const r = parseQueueFile(text)
    expect(r.ok).toBe(true)
    expect(r.items).toHaveLength(2)
    expect(r.items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(r.ignored).toBe(0)
  })

  it('往返：导出结果可被原样解析', () => {
    const queue = [local(1, 100), local(2, 200, { done: true, completedAt: 250 })]
    const r = parseQueueFile(JSON.stringify(buildExportFile(queue)))
    expect(r.ok).toBe(true)
    expect(r.items).toHaveLength(2)
    expect(r.items[1]).toMatchObject({ uid: 2, done: true, completedAt: 250 })
  })

  it('超过服务端上限的条目被截断并计入忽略', () => {
    const items = Array.from({ length: 1005 }, (_, i) => fileItem(i + 1, i + 1))
    const r = parseQueueFile(JSON.stringify({ items }))
    expect(r.ok).toBe(true)
    expect(r.items).toHaveLength(1000)
    expect(r.ignored).toBe(5)
  })
})

describe('mergePreview', () => {
  it('本机记录更早时保留本机，同一条目不新增', () => {
    const p = mergePreview([local(1, 100)], [fileItem(1, 200, { id: 'l1-100' })])
    expect(p.rows).toHaveLength(1)
    expect(p.rows[0].kind).toBe('keep')
    expect(p.rows[0].item.joinedAt).toBe(100)
    expect(p.stats).toEqual({ added: 0, replaced: 0, kept: 1, local: 1 })
  })

  it('文件记录更早时原位替换本机记录并默认勾选', () => {
    const p = mergePreview([local(1, 200), local(2, 300)], [fileItem(1, 100, { id: 'l1-200' })])
    expect(p.rows.map((r) => r.uid)).toEqual([1, 2])
    expect(p.rows[0].kind).toBe('replace')
    expect(p.rows[0].checked).toBe(true)
    expect(p.rows[0].item.joinedAt).toBe(100)
    expect(p.stats.replaced).toBe(1)
  })

  it('不同 id 的同一 uid 视为不同条目', () => {
    const p = mergePreview([local(1, 200)], [fileItem(1, 100, { id: 'other-id' })])
    expect(p.rows).toHaveLength(2)
    expect(p.stats.added).toBe(1)
    expect(p.stats.replaced).toBe(0)
  })

  it('文件独有条目按文件顺序追加到末尾并默认勾选', () => {
    const p = mergePreview([local(9, 950)], [fileItem(3, 300), fileItem(1, 100), fileItem(4, 400)])
    expect(p.rows.map((r) => r.uid)).toEqual([9, 1, 3, 4])
    expect(p.rows.slice(1).every((r) => r.kind === 'append' && r.checked)).toBe(true)
    expect(p.stats.added).toBe(3)
  })

  it('合并后顺序保持：本机骨架在前，之后才是新条目', () => {
    const p = mergePreview([local(5, 500), local(6, 600)], [fileItem(1, 1), fileItem(2, 2)])
    expect(p.rows.map((r) => r.uid)).toEqual([5, 6, 1, 2])
  })
})

describe('buildImportItems / moveRow', () => {
  it('只提交勾选行，且保持当前排序', () => {
    const p = mergePreview([local(1, 100), local(2, 200)], [fileItem(3, 300)])
    const rows = p.rows.map((r, i) => ({ ...r, checked: i !== 0 }))
    expect(buildImportItems(rows).map((i) => i.uid)).toEqual([2, 3])
  })

  it('已完成条目带 completedAt，未完成不带', () => {
    const items = buildImportItems([
      { uid: 1, item: fileItem(1, 1, { done: true, completedAt: 9 }), kind: 'keep', checked: true },
      { uid: 2, item: fileItem(2, 2, { completedAt: 5 }), kind: 'append', checked: true },
    ])
    expect(items[0].completedAt).toBe(9)
    expect(items[1].completedAt).toBeUndefined()
  })

  it('moveRow 移位并忽略越界', () => {
    expect(moveRow([1, 2, 3], 0, 2)).toEqual([2, 3, 1])
    expect(moveRow([1, 2, 3], 2, 0)).toEqual([3, 1, 2])
    expect(moveRow([1, 2, 3], 1, 1)).toEqual([1, 2, 3])
    expect(moveRow([1, 2, 3], 0, 9)).toEqual([1, 2, 3])
  })
})
