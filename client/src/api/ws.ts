import type { WsEventMap, WsEventType, WsMessage, Unsubscribe } from '@/types/models'

// WebSocket 传输层：仅负责连接、重连与事件分发；运行态归 store（docs/frontend/08 §1）
let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let closedByUser = false
let seq = 0
const listeners = new Map<WsEventType, Set<(data: never) => void>>()

function connect(onOpen?: () => void): void {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  socket = new WebSocket(`${proto}//${location.host}/ws`)

  socket.onopen = () => {
    if (onOpen) onOpen()
  }

  socket.onmessage = (event: MessageEvent) => {
    let msg: WsMessage
    try {
      msg = JSON.parse(event.data as string) as WsMessage
    } catch {
      return
    }
    const handlers = listeners.get(msg.type as WsEventType)
    if (handlers) {
      for (const handler of handlers) handler(msg.data as never)
    }
  }

  socket.onclose = () => {
    if (closedByUser) return
    reconnectTimer = setTimeout(() => connect(onOpen), 3000)
  }

  socket.onerror = () => {
    try {
      socket?.close()
    } catch {
      /* ignore */
    }
  }
}

function on<K extends WsEventType>(type: K, handler: (data: WsEventMap[K]) => void): Unsubscribe {
  if (!listeners.has(type)) listeners.set(type, new Set())
  listeners.get(type)!.add(handler as (data: never) => void)
  return () => {
    listeners.get(type)?.delete(handler as (data: never) => void)
  }
}

function nextSeq(): number {
  return ++seq
}

export default { connect, on, nextSeq }
