import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from './helpers/mount'

vi.mock('@/api', () => ({
  fetchGifts: vi.fn(async () => ({ data: { ok: true, gifts: [{ id: 1, name: '小花', price: 1 }] } })),
  fetchGiftRules: vi.fn(async () => ({ data: { ok: true, rules: [] } })),
  saveGiftRules: vi.fn(async () => ({ data: { ok: true, rules: [] } })),
}))

import GiftRulesWidget from '@/view/manage/components/GiftRulesWidget.vue'
import { saveGiftRules } from '@/api'

describe('GiftRulesWidget', () => {
  it('无规则时展示空态文案', async () => {
    const wrapper = mount(GiftRulesWidget)
    await flushPromises()
    expect(wrapper.text()).toContain('暂无规则')
  })

  it('添加规则后保存请求带规则数组', async () => {
    const wrapper = mount(GiftRulesWidget)
    await flushPromises()
    await wrapper.find('.head button').trigger('click')
    expect(wrapper.findAll('.rule_row')).toHaveLength(1)
    await wrapper.find('.save_btn').trigger('click')
    await flushPromises()
    expect(saveGiftRules).toHaveBeenCalled()
    const rules = vi.mocked(saveGiftRules).mock.calls[0][0]
    expect(rules[0]).toMatchObject({ giftId: 1, threshold: 10, mode: 'up', steps: 1 })
  })

  it('删除规则后回到空态', async () => {
    const wrapper = mount(GiftRulesWidget)
    await flushPromises()
    await wrapper.find('.head button').trigger('click')
    await wrapper.find('.rule_row button').trigger('click')
    expect(wrapper.findAll('.rule_row')).toHaveLength(0)
  })
})
