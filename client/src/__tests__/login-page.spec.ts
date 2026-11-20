import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from './helpers/mount'
import LoginPage from '@/view/manage/components/LoginPage.vue'

describe('LoginPage', () => {
  it('全屏扫码页含品牌与模式按钮，且无顶栏/页脚', async () => {
    const wrapper = mount(LoginPage, { props: { login: null } })
    await flushPromises()
    expect(wrapper.find('.status_bar').exists()).toBe(false)
    expect(wrapper.find('.footbar').exists()).toBe(false)
    expect(wrapper.text()).toContain('弹幕台')
    expect(wrapper.text()).toContain('DanmuDeck')
    expect(wrapper.find('.theme_btn').exists()).toBe(true)
  })

  it('展示二维码与扫码提示', async () => {
    const wrapper = mount(LoginPage, {
      props: { login: { phase: 'waiting', url: '', qrDataUrl: 'data:image/png;base64,xx', scanned: false, expired: false, error: '', uid: 0 } },
    })
    await flushPromises()
    expect(wrapper.find('img.qr').exists()).toBe(true)
    expect(wrapper.text()).toContain('扫一扫')
  })

  it('已扫码时提示在手机上确认', async () => {
    const wrapper = mount(LoginPage, {
      props: { login: { phase: 'scanned', url: '', qrDataUrl: 'data:image/png;base64,xx', scanned: true, expired: false, error: '', uid: 0 } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('确认')
  })

  it('二维码图片必须可见（防止 CSS transform 等把 240px 图藏起来）', async () => {
    const wrapper = mount(LoginPage, {
      props: { login: { phase: 'waiting', url: '', qrDataUrl: 'data:image/png;base64,xx', scanned: false, expired: false, error: '', uid: 0 } },
    })
    await flushPromises()
    const img = wrapper.find('img.qr')
    expect(img.attributes('src')).toBe('data:image/png;base64,xx')
    expect(img.attributes('class')).not.toContain('placeholder')
  })

  it('过期时提供重新生成二维码按钮', async () => {
    const wrapper = mount(LoginPage, {
      props: { login: { phase: 'expired', url: '', qrDataUrl: '', scanned: false, expired: true, error: '', uid: 0 } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('重新生成二维码')
  })
})
