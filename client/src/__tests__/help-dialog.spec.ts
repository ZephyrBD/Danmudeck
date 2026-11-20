import { describe, it, expect } from 'vitest'
import { mount } from './helpers/mount'
import { renderHelp } from '@/view/manage/composables/helpDoc'
import HelpDialog from '@/view/manage/components/HelpDialog.vue'

describe('helpDoc', () => {
  it('渲染 md 并把覆盖地址填入占位', () => {
    const html = renderHelp({ chatUrl: 'http://x/overlay/chat', queueUrl: 'http://x/overlay/queue' })
    expect(html).toContain('<h1>')
    expect(html).toContain('DanmuDeck 使用教程')
    expect(html).toContain('http://x/overlay/chat')
    expect(html).toContain('http://x/overlay/queue')
    expect(html).not.toContain('{chat_url}')
    expect(html).not.toContain('{queue_url}')
  })

  it('同时覆盖直播姬与 OBS 两段教程', () => {
    const html = renderHelp({ chatUrl: 'a', queueUrl: 'b' })
    expect(html).toContain('直播姬教程')
    expect(html).toContain('OBS 教程')
  })

  it('教程不含截图（纯文字教程）', () => {
    const html = renderHelp({ chatUrl: 'a', queueUrl: 'b' })
    expect(html).not.toContain('<img')
    expect(html).not.toContain('/help/')
  })
})

describe('HelpDialog', () => {
  it('展示教程标题与复制按钮', async () => {
    const wrapper = mount(HelpDialog, { props: { modelValue: true } })
    await wrapper.vm.$nextTick()
    const text = wrapper.text()
    expect(text).toContain('使用帮助')
    expect(text).toContain('/overlay/chat')
    expect(wrapper.findAll('.links button')).toHaveLength(2)
    expect(wrapper.find('.markdown').exists()).toBe(true)
  })
})
