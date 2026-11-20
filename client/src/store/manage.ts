import { reactive, ref } from 'vue'
import ws from '@/api/ws'
import { fetchStatus, fetchSettings, fetchOverlay } from '@/api/settings'
import type { Counters, FeedItem, OverlayData, QueueItem, SettingsData, StatusData } from '@/types/models'

// 管理台运行态：连接状态 + 信息流 + 设置/覆盖（docs/frontend/08 §3，仅内存）
const MAX_ITEMS = 1000

const EMPTY_COUNTERS: Counters = { danmu: 0, superchat: 0 }

const status = reactive<StatusData>({
  status: 'idle',
  statusText: '未连接',
  roomId: null,
  online: 0,
  loginRequired: false,
  counters: { ...EMPTY_COUNTERS },
})

// 首帧防闪：在拿到第一个 /api/status 之前不渲染登录态分支（plan §13）
const booted = ref(false)

const settings = ref<SettingsData>({ roomId: null, queueEnterKey: '排队', queueLeaveKey: '取消排队' })
const overlay = ref<OverlayData>({
  showChat: 1,
  chatMax: 8,
  scMax: 3,
  showQueue: 1,
  queueMax: 6,
  queueMode: 'list',
  queueFlowSpeed: 3,
  queueFlowPause: 2,
})
const queue = ref<QueueItem[]>([])
const feed = ref<FeedItem[]>([])

function pushFeed(item: Omit<FeedItem, 'seq'>): void {
  feed.value.push({ ...item, seq: ws.nextSeq() })
  if (feed.value.length > MAX_ITEMS) {
    feed.value.splice(0, feed.value.length - MAX_ITEMS)
  }
}

function clearFeed(): void {
  feed.value = []
}

function applyStatus(data: StatusData): void {
  Object.assign(status, {
    status: data.status,
    statusText: data.statusText,
    roomId: data.roomId,
    online: data.online,
    loginRequired: data.loginRequired,
    counters: data.counters || { ...EMPTY_COUNTERS },
    liveStatus: data.liveStatus,
    uid: data.uid,
    uname: data.uname || '',
  })
  booted.value = true
  if (data.settings) settings.value = data.settings
  if (data.queue) queue.value = data.queue
}

const unsubscribers: Array<() => void> = []

/** 连接 WS 并拉取初始数据；幂等，供页面 onMounted 调用 */
async function initManageStore(): Promise<void> {
  if (unsubscribers.length) return
  ws.connect()
  unsubscribers.push(
    ws.on('status', applyStatus),
    ws.on('danmu', (data) => {
      status.counters = data.counters || { ...EMPTY_COUNTERS }
      pushFeed({ type: 'danmu', user: data.user, text: data.text, color: data.color, timestamp: data.timestamp })
    }),
    ws.on('superchat', (data) => {
      status.counters = data.counters || { ...EMPTY_COUNTERS }
      pushFeed({
        type: 'superchat',
        user: data.user,
        message: data.message,
        price: data.price,
        background: data.background,
        color: data.color,
        timestamp: data.timestamp,
      })
    }),
    ws.on('gift', (data) => {
      pushFeed({ type: 'gift', user: data.user, giftName: data.giftName, num: data.num, timestamp: data.timestamp })
    }),
    ws.on('online', (count) => {
      status.online = count
    }),
    ws.on('queue', (data) => {
      queue.value = data
    }),
    ws.on('settings', (data) => {
      settings.value = data
    }),
    ws.on('overlay', (data) => {
      overlay.value = data
    })
  )

  try {
    const { data } = await fetchStatus()
    applyStatus(data)
    const [settingsRes, overlayRes] = await Promise.allSettled([fetchSettings(), fetchOverlay()])
    if (settingsRes.status === 'fulfilled') settings.value = settingsRes.value.data as SettingsData
    if (overlayRes.status === 'fulfilled') overlay.value = overlayRes.value.data as OverlayData
  } catch {
    /* backend not ready, status will arrive via ws */
  }
}

export {
  status,
  booted,
  settings,
  overlay,
  queue,
  feed,
  pushFeed,
  clearFeed,
  applyStatus,
  initManageStore,
  unsubscribers,
}
