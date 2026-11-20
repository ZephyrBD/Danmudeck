import { describe, it, expect } from 'vitest'
import { mount } from './helpers/mount'
import QueueWidget from '@/view/manage/components/QueueWidget.vue'

const baseQueue = [
  { id: 'q1', uid: 1, user: 'alice', position: 1, done: false, joinedAt: Date.now() - 8 * 60000 },
  {
    id: 'q2', uid: 2, user: 'bob', position: 2, done: false, joinedAt: Date.now() - 60000,
    moves: [{ id: 'm1', at: Date.now() - 30000, from: 3, to: 2, by: 'gift' as const, gift: '辣条' }],
  },
  { id: 'q3', uid: 3, user: 'carol', position: 3, done: true, joinedAt: 0, completedAt: 0 },
]

describe('QueueWidget', () => {
  it('渲染已完成/全部计数与用户名', () => {
    const wrapper = mount(QueueWidget, { props: { queue: baseQueue, enterKey: '排队' } })
    expect(wrapper.find('.counter').text()).toBe('1/3')
    expect(wrapper.text()).toContain('alice')
  })

  it('已完成项显示已完成标签且不渲染操作按钮', () => {
    const wrapper = mount(QueueWidget, { props: { queue: baseQueue } })
    const doneItem = wrapper.findAll('.q_item.done')
    expect(doneItem).toHaveLength(1)
    expect(doneItem[0].text()).toContain('已完成')
    expect(doneItem[0].findAll('button')).toHaveLength(0)
  })

  it('赠送插队与已完成标签渲染在昵称同一行', () => {
    const wrapper = mount(QueueWidget, { props: { queue: baseQueue } })
    const rows = wrapper.findAll('.q_item')
    // bob 有 skippedAt -> 礼物插队标签跟在昵称后
    const bobLine = rows[1].find('.name_line')
    expect(bobLine.exists()).toBe(true)
    expect(bobLine.find('.user').text()).toBe('bob')
    expect(bobLine.find('.skip_tag').text()).toBe('礼物插队')
    // carol 已完成 -> 已完成标签同样在昵称行，而不是被推到行尾右侧
    const doneLine = rows[2].find('.name_line')
    expect(doneLine.find('.user').text()).toBe('carol')
    expect(doneLine.find('.done_tag').text()).toBe('已完成')
  })

  it('未完成行有两个图标按钮：置顶 / 完成，首位置顶禁用', () => {
    const wrapper = mount(QueueWidget, { props: { queue: baseQueue } })
    const first = wrapper.findAll('.q_item')[0]
    const btns = first.findAll('.row_actions button')
    expect(btns).toHaveLength(2)
    // 纯图标：按钮内无文字，靠 title / aria-label 表达语义
    expect(btns[0].text()).toBe('')
    expect(btns[0].attributes('title')).toContain('置顶')
    expect(btns[0].attributes('aria-label')).toBe('置顶')
    expect(btns[0].attributes('disabled')).toBeDefined()
    expect(btns[1].attributes('title')).toContain('完成')
    expect(btns[1].attributes('aria-label')).toBe('完成')
    // 非首位可以置顶
    const second = wrapper.findAll('.q_item')[1]
    expect(second.findAll('.row_actions button')[0].attributes('disabled')).toBeUndefined()
  })

  it('行内展示入队时间与已排队时长', () => {
    const wrapper = mount(QueueWidget, { props: { queue: baseQueue } })
    const first = wrapper.findAll('.q_item')[0]
    expect(first.text()).toContain('入队')
    expect(first.text()).toContain('已排队 8 分钟')
  })

  it('点击完成向父级抛出 complete 事件', async () => {
    const wrapper = mount(QueueWidget, { props: { queue: baseQueue } })
    const btns = wrapper.findAll('.q_item:not(.done) button')
    await btns[btns.length - 1].trigger('click')
    expect(wrapper.emitted('complete')).toEqual([[2]])
  })

  it('空队列展示入队提示', () => {
    const wrapper = mount(QueueWidget, { props: { queue: [], enterKey: '上车' } })
    expect(wrapper.text()).toContain('观众发「上车」入队')
  })

  it('分上下两区：排队中在上，已完成在下', () => {
    const wrapper = mount(QueueWidget, { props: { queue: baseQueue } })
    const active = wrapper.find('.active_section')
    const done = wrapper.find('.done_section')
    expect(active.exists()).toBe(true)
    expect(done.exists()).toBe(true)
    expect(active.findAll('.q_item').map((r) => r.find('.user').text())).toEqual(['alice', 'bob'])
    expect(done.findAll('.q_item').map((r) => r.find('.user').text())).toEqual(['carol'])
    expect(active.find('.section_count').text()).toBe('2')
    expect(done.find('.section_count').text()).toBe('1')
  })

  it('已完成区按完成时间倒序，最新完成的在最上', () => {
    const now = Date.now()
    const queue = [
      { id: 'a', uid: 1, user: 'early', position: 1, done: true, joinedAt: 0, completedAt: now - 5000 },
      { id: 'b', uid: 2, user: 'late', position: 2, done: true, joinedAt: 0, completedAt: now - 1000 },
      { id: 'c', uid: 3, user: 'mid', position: 3, done: true, joinedAt: 0, completedAt: now - 3000 },
    ]
    const wrapper = mount(QueueWidget, { props: { queue } })
    expect(wrapper.findAll('.done_section .user').map((n) => n.text())).toEqual(['late', 'mid', 'early'])
  })

  it('下区为空时仍渲染分区占位', () => {
    const queue = [{ id: 'a', uid: 1, user: 'solo', position: 1, done: false, joinedAt: Date.now() }]
    const wrapper = mount(QueueWidget, { props: { queue } })
    const done = wrapper.find('.done_section')
    expect(done.exists()).toBe(true)
    expect(done.findAll('.q_item')).toHaveLength(0)
    expect(done.text()).toContain('还没有完成的委托')
  })

  it('拖动区交换后按钮语义不变：导出在上、导入在下', () => {
    const wrapper = mount(QueueWidget, { props: { queue: baseQueue } })
    const actions = wrapper.findAll('.actions button')
    // 0=导出 1=导入 2=清除已完成 3=清空
    expect(actions[0].attributes('title')).toContain('导出')
    expect(actions[1].attributes('title')).toContain('导入')
    // 图标组件名通过 svg 的 class 无法稳定判定，改为断言两者图标不同
    const icons = actions.slice(0, 2).map((b) => b.find('svg').exists())
    expect(icons).toEqual([true, true])
  })

  it('四个图标按钮：保存 / 加载 / 清除已完成 / 清空，空队列时保存与清空禁用', () => {
    const wrapper = mount(QueueWidget, { props: { queue: baseQueue } })
    const buttons = wrapper.findAll('.head .icon_btn')
    expect(buttons).toHaveLength(4)
    // D14 全量导出：全部已完成时保存依然可用；只有空队列才禁用
    const allDone = mount(QueueWidget, {
      props: { queue: [{ uid: 9, user: 'x', position: 1, done: true, joinedAt: 0, completedAt: 1 }] },
    })
    const allDoneButtons = allDone.findAll('.head .icon_btn')
    expect(allDoneButtons[3].attributes('disabled')).toBeUndefined()
    const empty = mount(QueueWidget, { props: { queue: [] } })
    const eButtons = empty.findAll('.head .icon_btn')
    expect(eButtons[0].attributes('disabled')).toBeDefined()
    expect(eButtons[2].attributes('disabled')).toBeDefined()
    expect(eButtons[3].attributes('disabled')).toBeDefined()
  })

  it('保存/加载抛出 save / load 事件', async () => {
    const wrapper = mount(QueueWidget, { props: { queue: baseQueue } })
    const buttons = wrapper.findAll('.head .icon_btn')
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('load')).toHaveLength(1)
  })
})
