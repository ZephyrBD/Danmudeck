import request from '@/api/request'
import type { ApiResult, Gift, GiftRule, LoginState, QueueImportItem, QueueItem } from '@/types/models'

export { fetchStatus, fetchSettings, saveSettings, fetchOverlay, saveOverlay } from './settings'

export function fetchLoginStatus(): Promise<{ data: LoginState }> {
  return request.get<LoginState, { data: LoginState }>('/api/login/status')
}

export function restartLogin(): Promise<void> {
  return request.post('/api/login/restart')
}

export function fetchGifts(): Promise<{ data: ApiResult<{ gifts?: Gift[] }> }> {
  return request.get('/api/gifts')
}

export function fetchGiftRules(): Promise<{ data: ApiResult<{ rules?: GiftRule[] }> }> {
  return request.get('/api/gift-rules')
}

export function saveGiftRules(rules: GiftRule[]): Promise<{ data: ApiResult<{ rules?: GiftRule[] }> }> {
  return request.post('/api/gift-rules', { rules })
}

export function fetchQueue(): Promise<{ data: ApiResult<{ queue?: QueueItem[] }> }> {
  return request.get('/api/queue')
}

export function completeQueue(uid: number): Promise<void> {
  return request.post('/api/queue/complete', { uid })
}

export function resetQueue(): Promise<void> {
  return request.post('/api/queue/reset')
}

export function clearDoneQueue(): Promise<void> {
  return request.post('/api/queue/clearDone')
}

export function moveQueueApi(uid: number, toIndex: number): Promise<void> {
  return request.post('/api/queue/move', { uid, toIndex })
}

export function importQueue(items: QueueImportItem[]): Promise<{ data: ApiResult<{ queue?: QueueItem[] }> }> {
  return request.post('/api/queue/import', { items })
}

export function logout(): Promise<{ data: ApiResult }> {
  return request.post('/api/logout')
}

export default request
