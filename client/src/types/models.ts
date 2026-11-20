// 跨文件复用类型（docs/frontend/02 §6）
export interface Counters {
  danmu: number
  superchat: number
}

export interface SettingsData {
  roomId?: number | null
  queueEnterKey?: string
  queueLeaveKey?: string
}

/** 一次位置变动：礼物插队与管理员调整共用 */
export interface QueueMove {
  /** 雪花 ID，稳定唯一 key（不展示给用户） */
  id: string
  at: number
  from: number
  to: number
  by: 'gift' | 'admin'
  gift?: string
}

export interface QueueItem {
  /** 雪花 ID，同一 uid 多次排队时区分不同条目（不展示给用户） */
  id: string
  uid: number
  user: string
  color?: string
  position: number
  done: boolean
  joinedAt: number
  completedAt?: number
  moves?: QueueMove[]
}

/** 排列方式：竖排 / 横排；是否流动由 queueFlow 单独控制 */
export type QueueMode = 'list' | 'horizontal'

export interface OverlayData {
  showChat?: number
  chatMax?: number
  scMax?: number
  showQueue?: number
  queueMax?: number
  queueMode?: QueueMode
  /** 流动开关：超出 queueMax 时自动翻页 */
  queueFlow?: number
  queueFlowSpeed?: number
  queueFlowPause?: number
}

export interface StatusData {
  status: string
  statusText: string
  roomId: number | null
  online: number
  loginRequired: boolean
  counters: Counters
  liveStatus?: number
  uid?: number
  uname?: string
  settings?: SettingsData
  queue?: QueueItem[]
}

export interface ChatItem {
  seq?: number
  user?: string
  text?: string
  color?: string
  timestamp: number
  counters?: Counters
}

export interface SuperChatData {
  seq?: number
  user?: string
  message: string
  price: number
  background?: string
  color?: string
  timestamp: number
  counters?: Counters
}

export interface GiftData {
  seq?: number
  user?: string
  giftName: string
  num: number
  timestamp: number
}

export interface WsEventMap {
  status: StatusData
  danmu: ChatItem
  superchat: SuperChatData
  gift: GiftData
  online: number
  queue: QueueItem[]
  settings: SettingsData
  overlay: OverlayData
}

export type WsEventType = keyof WsEventMap
export type WsMessage = { [K in WsEventType]: { type: K; data: WsEventMap[K] } }[WsEventType]
export type Unsubscribe = () => void

/** 管理页信息流条目：弹幕 / SC / 礼物三态合一 */
export interface FeedItem {
  seq: number
  type: 'danmu' | 'superchat' | 'gift'
  timestamp: number
  user?: string
  text?: string
  color?: string
  message?: string
  price?: number
  background?: string
  giftName?: string
  num?: number
}

export interface Gift {
  id: number
  name: string
  price: number
}

export type GiftRuleMode = 'top' | 'up'

export interface GiftRule {
  giftId: number
  giftName: string
  threshold: number
  mode: GiftRuleMode
  steps: number
}

export interface LoginState {
  phase: string
  url: string
  qrDataUrl: string
  scanned: boolean
  expired: boolean
  error: string
  uid: number
}

/** 队列导入请求条目（plan §6.4） */
export interface QueueImportItem {
  id?: string
  uid: number
  user: string
  color?: string
  joinedAt: number
  done: boolean
  completedAt?: number
  moves?: QueueMove[]
}

export type ApiResult<T = unknown> = {
  ok?: boolean
  error?: string
} & T

/** 覆盖页信息流条目：弹幕 / SC / 礼物三态合一（含渲染 key） */
export interface OverlayFeedItem extends Omit<ChatItem, 'counters'> {
  _k: number
  message?: string
  price?: number
  background?: string
  giftName?: string
  num?: number
  text?: string
}