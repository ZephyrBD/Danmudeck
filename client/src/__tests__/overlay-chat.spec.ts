import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from './helpers/mount'

const wsListeners = new Map<string, Set<(data: unknown) => void>>()

vi.mock('@/api/ws', () => ({
  default: {
    connect: vi.fn(),
    nextSeq: (() => { let n = 0; return () => ++n })(),
    on: vi.fn((type: string, handler: (data: unknown) => void) => {
      if (!wsListeners.has(type)) wsListeners.set(type, new Set())
      wsListeners.get(type)!.add(handler)
      return () => wsListeners.get(type)?.delete(handler)
    }),
  },
}))

vi.mock('@/api', () => ({
  fetchOverlay: vi.fn(async () => ({ data: { showChat: 1, chatMax: 2, scMax: 1, showQueue: 1, queueMax: 6, queueMode: 'list' } })),
}))

import OverlayChat from '@/view/overlay/chat/index.vue'

function emit(type: string, data: unknown): void {
  for (const handler of wsListeners.get(type) ?? []) handler(data)
}

describe('OverlayChat', () => {
  beforeEach(() => {
    wsListeners.clear()
  })

  it('弹幕超过 chatMax 时截断保留最新', async () => {
    const wrapper = mount(OverlayChat)
    await flushPromises()
    for (let i = 1; i <= 4; i++) emit('danmu', { user: `u${i}`, text: `t${i}`, timestamp: 0 })
    await flushPromises()
    const rows = wrapper.findAll('.danmu_row')
    expect(rows).toHaveLength(2)
    expect(wrapper.text()).toContain('t4')
    expect(wrapper.text()).not.toContain('t1')
  })

  it('礼物消息转换为文本行', async () => {
    const wrapper = mount(OverlayChat)
    await flushPromises()
    emit('gift', { user: 'u', giftName: '小花', num: 2, timestamp: 0 })
    await flushPromises()
    expect(wrapper.text()).toContain('送出 小花 ×2')
  })

  it('showChat 为 0 时整体不渲染', async () => {
    const wrapper = mount(OverlayChat)
    await flushPromises()
    emit('overlay', { showChat: 0, chatMax: 2, scMax: 1 })
    await flushPromises()
    expect(wrapper.find('.overlay_chat').exists()).toBe(false)
  })
})
