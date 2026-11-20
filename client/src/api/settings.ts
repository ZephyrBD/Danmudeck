import request from '@/api/request'
import type { ApiResult, StatusData } from '@/types/models'

export function fetchStatus(): Promise<{ data: StatusData }> {
  return request.get<StatusData, { data: StatusData }>('/api/status')
}

export function fetchSettings(): Promise<{ data: ApiResult }> {
  return request.get('/api/settings')
}

export function saveSettings(body: { roomId: number | null; queueEnterKey: string; queueLeaveKey: string }): Promise<{
  data: ApiResult
}> {
  return request.post('/api/settings', body)
}

export function fetchOverlay(): Promise<{ data: ApiResult }> {
  return request.get('/api/overlay')
}

export function saveOverlay(body: {
  showChat: number
  chatMax: number
  scMax: number
  showQueue: number
  queueMax: number
  queueMode: string
  queueFlowSpeed: number
  queueFlowPause: number
}): Promise<{ data: ApiResult }> {
  return request.post('/api/overlay', body)
}
