import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from './helpers/mount'

vi.mock('@/api', () => ({
  saveSettings: vi.fn(async () => ({ data: { ok: true } })),
}))

import QueueKeySettingsForm from '@/view/manage/components/QueueKeySettingsForm.vue'
import { saveSettings } from '@/api'

describe('QueueKeySettingsForm', () => {
  it('两个触发词相同时报错且不请求', async () => {
    const wrapper = mount(QueueKeySettingsForm, { props: { settings: { roomId: null } } })
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('签到')
    await inputs[1].setValue('签到')
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('两个触发词不能一样哦')
    expect(saveSettings).not.toHaveBeenCalled()
  })

  it('入队触发词为空时报错', async () => {
    const wrapper = mount(QueueKeySettingsForm, { props: { settings: { roomId: null } } })
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('入队触发词不能为空哦')
  })

  it('填写合法后保存成功', async () => {
    const wrapper = mount(QueueKeySettingsForm, { props: { settings: { roomId: null } } })
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('排队')
    await inputs[1].setValue('取消排队')
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(saveSettings).toHaveBeenCalledWith({ roomId: null, queueEnterKey: '排队', queueLeaveKey: '取消排队' })
    expect(wrapper.text()).toContain('保存好啦，已经生效')
  })
})
