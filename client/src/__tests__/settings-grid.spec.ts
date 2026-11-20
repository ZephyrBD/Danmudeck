import { describe, it, expect } from 'vitest'
import { mount } from './helpers/mount'
import SettingsGrid from '@/view/manage/components/SettingsGrid.vue'

const settings = { roomId: null, queueEnterKey: '排队', queueLeaveKey: '取消排队' }
const status = {
  status: 'idle',
  statusText: '未连接',
  roomId: null,
  online: 0,
  loginRequired: false,
  counters: { danmu: 0, superchat: 0 },
}
const overlay = { showChat: 1, chatMax: 8, scMax: 3, showQueue: 1, queueMax: 6, queueMode: 'list' as const }

describe('SettingsGrid', () => {
  it('四个 Seg 页签：直播 / 排队 / 覆盖 / 规则', () => {
    const wrapper = mount(SettingsGrid, { props: { settings, status, overlay } })
    const labels = wrapper.findAll('.el-segmented__item-label').map((n) => n.text())
    expect(labels).toEqual(['直播', '排队', '覆盖', '规则'])
  })

  it('默认展示直播间页签内容', () => {
    const wrapper = mount(SettingsGrid, { props: { settings, status, overlay } })
    expect(wrapper.text()).toContain('直播间房间号')
    expect(wrapper.text()).not.toContain('流动速度')
  })

  it('切到 覆盖后展示两个覆盖页直链与流动选项', async () => {
    const wrapper = mount(SettingsGrid, { props: { settings, status, overlay } })
    // 真实点击路径：点 Segmented 的「覆盖」项（第 3 项），走原生 change 事件
    const label = wrapper.findAll('.el-segmented__item-label').find((n) => n.text() === '覆盖')
    expect(label).toBeTruthy()
    await wrapper.findAll('.el-segmented__item-input')[2].trigger('change')
    expect(wrapper.findComponent({ name: 'ElSegmented' }).props('modelValue')).toBe('overlay')
    expect(wrapper.text()).toContain('弹幕覆盖')
    expect(wrapper.text()).toContain('排队覆盖')
    expect(wrapper.text()).toContain('/overlay/chat')
    expect(wrapper.text()).toContain('/overlay/queue')
  })
})
