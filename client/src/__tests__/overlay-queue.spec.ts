import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from './helpers/mount'

const wsListeners = new Map<string, Set<(data: unknown) => void>>()

vi.mock('@/api/ws', () => ({
  default: {
    connect: vi.fn(),
    nextSeq: () => 1,
    on: vi.fn((type: string, handler: (data: unknown) => void) => {
      if (!wsListeners.has(type)) wsListeners.set(type, new Set())
      wsListeners.get(type)!.add(handler)
      return () => wsListeners.get(type)?.delete(handler)
    }),
  },
}))

let overlayResponse: Record<string, unknown> = { showChat: 1, chatMax: 8, scMax: 3, showQueue: 1, queueMax: 3, queueMode: 'list' }

vi.mock('@/api', () => ({
  fetchOverlay: vi.fn(async () => ({ data: overlayResponse })),
  fetchStatus: vi.fn(async () => ({
    data: { status: 'idle', statusText: '未连接', roomId: null, online: 0, loginRequired: false, counters: { danmu: 0, superchat: 0 }, queue: [] },
  })),
}))

import OverlayQueue from '@/view/overlay/queue/index.vue'

function emit(type: string, data: unknown): void {
  for (const handler of wsListeners.get(type) ?? []) handler(data)
}

const QUEUE = [
  { uid: 1, user: 'a', position: 1, done: true, joinedAt: 0 },
  { uid: 2, user: 'b', position: 2, done: false, joinedAt: 0 },
  { uid: 3, user: 'c', position: 3, done: false, joinedAt: 0 },
  { uid: 4, user: 'd', position: 4, done: false, joinedAt: 0 },
]

describe('OverlayQueue', () => {
  beforeEach(() => {
    wsListeners.clear()
    overlayResponse = { showChat: 1, chatMax: 8, scMax: 3, showQueue: 1, queueMax: 3, queueMode: 'list' }
  })

  it('未收到队列消息时展示占位卡「虚位以待」', async () => {
    const wrapper = mount(OverlayQueue)
    await flushPromises()
    expect(wrapper.text()).toContain('虚位以待')
  })

  it('ws 队列消息过滤已完成项并截断到 queueMax', async () => {
    const wrapper = mount(OverlayQueue)
    await flushPromises()
    emit('queue', QUEUE)
    await flushPromises()
    const cards = wrapper.findAll('.q_card')
    expect(cards).toHaveLength(3)
    expect(wrapper.text()).toContain('b')
    expect(wrapper.text()).not.toContain('a')
  })

  it('showQueue 为 0 时不渲染', async () => {
    const wrapper = mount(OverlayQueue)
    await flushPromises()
    emit('overlay', { showQueue: 0, queueMax: 3, queueMode: 'list' })
    await flushPromises()
    expect(wrapper.find('.overlay_queue').exists()).toBe(false)
  })

  it('流动形态渲染全部未完成条目并限高容器', async () => {
    overlayResponse = { showQueue: 1, queueMax: 2, queueMode: 'flow', queueFlowSpeed: 1, queueFlowPause: 0 }
    const wrapper = mount(OverlayQueue)
    await flushPromises()
    emit('queue', QUEUE)
    await flushPromises()
    expect(wrapper.find('.overlay_queue.flow').exists()).toBe(true)
    expect(wrapper.find('.flow_viewport').exists()).toBe(true)
    // 3 条未完成全部渲染（不是截到 queueMax=2）
    expect(wrapper.findAll('.flow_track .q_card')).toHaveLength(3)
    expect(wrapper.text()).toContain('d')
  })

  it('流动形态在 prefers-reduced-motion 下不动画', async () => {
    overlayResponse = { showQueue: 1, queueMax: 1, queueMode: 'flow', queueFlowSpeed: 1, queueFlowPause: 0 }
    const original = window.matchMedia
    window.matchMedia = ((q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    try {
      const wrapper = mount(OverlayQueue)
      await flushPromises()
      emit('queue', QUEUE)
      await flushPromises()
      expect(raf).not.toHaveBeenCalled()
      expect(wrapper.findAll('.flow_track .q_card')).toHaveLength(3)
    } finally {
      window.matchMedia = original
      raf.mockRestore()
    }
  })
})
