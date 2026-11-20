import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('ws 单例', () => {
  class MockWebSocket {
    static instances: MockWebSocket[] = []
    onopen: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    onclose: (() => void) | null = null
    onerror: (() => void) | null = null
    url: string

    constructor(url: string) {
      this.url = url
      MockWebSocket.instances.push(this)
    }

    close(): void {}
  }

  beforeEach(() => {
    vi.resetModules()
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  async function loadWs() {
    const ws = (await import('@/api/ws')).default
    ws.connect()
    const socket = MockWebSocket.instances[0]
    expect(socket.url).toBe('ws://localhost:3000/ws')
    return ws
  }

  it('按消息类型分发 payload', async () => {
    const ws = await loadWs()
    const socket = MockWebSocket.instances[0]
    const received: unknown[] = []
    ws.on('danmu', (data) => received.push(data))

    socket.onmessage!({ data: JSON.stringify({ type: 'danmu', data: { text: 'hi', timestamp: 1 } }) })
    socket.onmessage!({ data: JSON.stringify({ type: 'gift', data: { giftName: '辣条', num: 1, timestamp: 2 } }) })
    socket.onmessage!({ data: 'not json' })
    socket.onmessage!({ data: JSON.stringify({ type: 'danmu', data: { text: '第二条', timestamp: 3 } }) })

    expect(received).toEqual([
      { text: 'hi', timestamp: 1 },
      { text: '第二条', timestamp: 3 },
    ])
  })

  it('退订后不再收到消息', async () => {
    const ws = await loadWs()
    const socket = MockWebSocket.instances[0]
    const received: unknown[] = []
    const off = ws.on('online', (count) => received.push(count))

    socket.onmessage!({ data: JSON.stringify({ type: 'online', data: 42 }) })
    off()
    socket.onmessage!({ data: JSON.stringify({ type: 'online', data: 99 }) })

    expect(received).toEqual([42])
  })

  it('nextSeq 单调递增', async () => {
    const ws = await loadWs()
    expect(ws.nextSeq()).toBe(1)
    expect(ws.nextSeq()).toBe(2)
    expect(ws.nextSeq()).toBe(3)
  })
})
