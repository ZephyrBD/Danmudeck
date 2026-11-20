import { describe, it, expect } from 'vitest'
import { mount } from './helpers/mount'
import StatusBar from '@/view/manage/components/StatusBar.vue'

const baseStatus = {
  status: 'connected',
  statusText: '已连接',
  roomId: 1774678,
  online: 123,
  loginRequired: false,
  counters: { danmu: 5, superchat: 2 },
  liveStatus: 1,
  uid: 10001,
  uname: 'ZephyrZBD',
}

describe('StatusBar', () => {
  it('左侧展示昵称、房间、直播状态与弹幕/SC 计数', () => {
    const wrapper = mount(StatusBar, { props: { status: baseStatus } })
    const text = wrapper.text()
    expect(text).toContain('ZephyrZBD')
    expect(text).toContain('房间：1774678')
    expect(text).toContain('直播中')
    expect(text).toContain('弹幕 5')
    expect(text).toContain('SC 2')
  })

  it('不再展示人气', () => {
    const wrapper = mount(StatusBar, { props: { status: baseStatus } })
    expect(wrapper.text()).not.toContain('人气')
  })

  it('右侧三个操作按钮：主题 / 帮助 / 退出', async () => {
    const wrapper = mount(StatusBar, { props: { status: baseStatus } })
    const buttons = wrapper.findAll('.right .icon_btn')
    expect(buttons).toHaveLength(3)
    await buttons[1].trigger('click')
    await buttons[2].trigger('click')
    expect(wrapper.emitted('help')).toHaveLength(1)
    expect(wrapper.emitted('logout')).toHaveLength(1)
  })

  it('昵称为空时显示未登录', () => {
    const wrapper = mount(StatusBar, { props: { status: { ...baseStatus, uname: '' } } })
    expect(wrapper.text()).toContain('未登录')
  })
})
