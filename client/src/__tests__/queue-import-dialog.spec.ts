import { describe, it, expect } from 'vitest'
import { mount } from './helpers/mount'
import QueueImportDialog from '@/view/manage/components/QueueImportDialog.vue'
import { mergePreview } from '@/view/manage/composables/queueFile'
import type { QueueItem } from '@/types/models'

const local: QueueItem[] = [
  { uid: 1, user: 'alice', position: 1, done: false, joinedAt: 100 },
  { uid: 2, user: 'bob', position: 2, done: false, joinedAt: 200 },
]

const fromFile = [
  { uid: 1, user: 'alice-old', color: '', joinedAt: 50, done: false, completedAt: 0 },
  { uid: 2, user: 'bob-file', color: '', joinedAt: 900, done: false, completedAt: 0 },
  { uid: 3, user: 'newbie', color: '', joinedAt: 300, done: false, completedAt: 0 },
]

describe('QueueImportDialog', () => {
  it('展示 新增/替换/保留/忽略 统计与预览行', async () => {
    const preview = mergePreview(local, fromFile)
    const wrapper = mount(QueueImportDialog, {
      props: { modelValue: true, rows: preview.rows, stats: preview.stats, ignored: 2 },
    })
    await wrapper.vm.$nextTick()
    const text = wrapper.text()
    expect(text).toContain('新增 1')
    expect(text).toContain('替换 1')
    expect(text).toContain('保留 1')
    expect(text).toContain('忽略 2')
    expect(wrapper.findAll('.row')).toHaveLength(3)
    // 替换行展示文件里的旧昵称，保留行展示本机昵称
    expect(text).toContain('alice-old')
    expect(text).toContain('newbie')
  })

  it('取消勾选后导入按钮计数减少', async () => {
    const preview = mergePreview(local, fromFile)
    const wrapper = mount(QueueImportDialog, {
      props: { modelValue: true, rows: preview.rows, stats: preview.stats, ignored: 0 },
    })
    await wrapper.vm.$nextTick()
    const buttons = wrapper.findAll('button')
    expect(buttons[buttons.length - 1].text()).toContain('导入 3 条')
    const checks = wrapper.findAll<HTMLInputElement>('input.check')
    await checks[0].setValue(false)
    const after = wrapper.findAll('button')
    expect(after[after.length - 1].text()).toContain('导入 2 条')
  })
})
