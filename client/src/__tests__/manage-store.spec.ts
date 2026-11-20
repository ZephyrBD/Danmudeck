import { describe, it, expect } from 'vitest'
import { status, booted, applyStatus } from '@/store/manage'

function baseStatus(): Parameters<typeof applyStatus>[0] {
  return {
    status: 'idle',
    statusText: '未连接',
    roomId: null,
    online: 0,
    loginRequired: false,
    counters: { danmu: 0, superchat: 0 },
  }
}

describe('manage store', () => {
  it('applyStatus 透传 uname 并置 booted', () => {
    applyStatus({ ...baseStatus(), loginRequired: false, uid: 10001, uname: 'ZephyrZBD' })
    expect(status.uname).toBe('ZephyrZBD')
    expect(status.uid).toBe(10001)
    expect(booted.value).toBe(true)
  })

  it('uname 缺失时回落空字符串，旧快照不炸', () => {
    applyStatus(baseStatus())
    expect(status.uname).toBe('')
  })
})
