import { describe, it, expect } from 'vitest'
import { mount } from './helpers/mount'
import OverlaySettingsWidget from '@/view/manage/components/OverlaySettingsWidget.vue'

// 流动是独立开关：横排、竖排都能叠加，不再是一种独立的「排队形式」
const overlay = {
  showChat: 1,
  chatMax: 8,
  scMax: 3,
  showQueue: 1,
  queueMax: 6,
  queueMode: 'list' as const,
  queueFlow: 0,
  queueFlowSpeed: 3,
  queueFlowPause: 2,
}

function fieldByText(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('.field').find((f) => f.text().includes(text))
}

describe('OverlaySettingsWidget 流动开关', () => {
  it('排列方式只有竖排 / 横排两个选项，流动是单独一行开关', () => {
    const wrapper = mount(OverlaySettingsWidget, { props: { overlay } })
    const text = wrapper.text()
    expect(text).toContain('排列方式')
    // 流动开关：标签文案以「自动翻页」为关键字（完整写法可能微调）
    expect(text).toContain('自动翻页')
    // 旧的三值「排队形式」下拉已经不存在
    expect(text).not.toContain('排队形式')
    // 排列方式下拉里只有竖排 / 横排，不再有旧的「流动」选项
    const selects = wrapper.findAllComponents({ name: 'EpSelect' })
    expect(selects).toHaveLength(1)
    const modeField = wrapper.findAll('.field').find((f) => f.text().includes('排列方式'))
    expect(modeField?.find('.el_select').exists()).toBe(true)
    const flowRow = wrapper.findAll('.toggle_row').find((r) => r.text().includes('自动翻页'))
    expect(flowRow).toBeTruthy()
  })

  it('流动关闭时两个参数常驻但置灰，不显示提示', () => {
    const wrapper = mount(OverlaySettingsWidget, { props: { overlay } })
    const speed = fieldByText(wrapper, '流动速度')
    expect(speed?.classes()).toContain('inactive')
    expect(speed?.find('input').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.flow_hint').exists()).toBe(false)
  })

  it('流动打开后可编辑并显示一屏条数提示', () => {
    const wrapper = mount(OverlaySettingsWidget, { props: { overlay: { ...overlay, queueFlow: 1 } } })
    const speed = fieldByText(wrapper, '流动速度')
    expect(speed?.classes()).not.toContain('inactive')
    expect(speed?.find('input').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.flow_hint').text()).toContain('一屏显示 6 条')
  })

  it('横排搭配流动时参数同样可用', () => {
    const wrapper = mount(OverlaySettingsWidget, {
      props: { overlay: { ...overlay, queueMode: 'horizontal' as const, queueFlow: 1 } },
    })
    const speed = fieldByText(wrapper, '流动速度')
    expect(speed?.classes()).not.toContain('inactive')
    expect(wrapper.find('.flow_hint').exists()).toBe(true)
  })
})
