import { describe, it, expect } from 'vitest'
import { mount } from './helpers/mount'
import DanmakuList from '@/view/manage/components/DanmakuList.vue'
import type { FeedItem } from '@/types/models'

function item(partial: Partial<FeedItem>): FeedItem {
  return { seq: 1, type: 'danmu', timestamp: 0, ...partial }
}

describe('DanmakuList', () => {
  it('空列表展示空态', () => {
    const wrapper = mount(DanmakuList, { props: { items: [] } })
    expect(wrapper.text()).toContain('等待弹幕…')
  })

  it('按类型渲染弹幕与礼物条目', () => {
    const wrapper = mount(DanmakuList, {
      props: {
        items: [
          item({ seq: 1, type: 'danmu', user: 'a', text: 'hello' }),
          item({ seq: 2, type: 'gift', user: 'b', giftName: '小花', num: 1 }),
        ],
      },
    })
    expect(wrapper.findAll('.danmu_item')).toHaveLength(1)
    expect(wrapper.findAll('.gift_item')).toHaveLength(1)
    expect(wrapper.text()).toContain('hello')
  })

  it('点击清空抛出 clear 事件', async () => {
    const wrapper = mount(DanmakuList, { props: { items: [item({})] } })
    await wrapper.find('.clear_btn').trigger('click')
    expect(wrapper.emitted('clear')).toBeTruthy()
  })

  it('SC 条目渲染价格', () => {
    const wrapper = mount(DanmakuList, {
      props: { items: [item({ seq: 1, type: 'superchat', user: 'c', message: 'nb', price: 30 })] },
    })
    expect(wrapper.text()).toContain('¥30')
  })
})
