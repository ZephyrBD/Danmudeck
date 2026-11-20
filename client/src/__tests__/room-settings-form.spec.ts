import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from './helpers/mount'

vi.mock('@/api', () => ({
  saveSettings: vi.fn(async () => ({ data: { ok: true } })),
  restartLogin: vi.fn(async () => undefined),
}))

import RoomSettingsForm from '@/view/manage/components/RoomSettingsForm.vue'
import { saveSettings } from '@/api'

const settings = { roomId: 1234, queueEnterKey: '排队', queueLeaveKey: '取消排队' }
const status = {
  status: 'connected',
  statusText: '已连接',
  roomId: 1234,
  online: 10,
  loginRequired: false,
  counters: { danmu: 0, superchat: 0 },
}

describe('RoomSettingsForm', () => {
  it('非法房间号显示校验错误且不请求', async () => {
    const wrapper = mount(RoomSettingsForm, { props: { settings: { roomId: 0 }, status } })
    const input = wrapper.find('input')
    await input.setValue(0)
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('房间号得是大于 0 的整数哦')
    expect(saveSettings).not.toHaveBeenCalled()
  })

  it('保存成功展示成功提示', async () => {
    const wrapper = mount(RoomSettingsForm, { props: { settings, status } })
    await wrapper.findAll('button')[0].trigger('click')
    await flushPromises()
    expect(saveSettings).toHaveBeenCalled()
    expect(wrapper.text()).toContain('保存好啦，已经生效')
  })

  it('连接状态透传显示', () => {
    const wrapper = mount(RoomSettingsForm, { props: { settings, status } })
    expect(wrapper.text()).toContain('已连接')
  })
})
