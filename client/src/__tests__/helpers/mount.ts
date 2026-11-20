import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import type { Component } from 'vue'

// 测试挂载助手：与 main.ts 一致地全量注册 Element Plus（docs/frontend/01 §5）
function mountView(component: Component, options?: Parameters<typeof mount>[1]): ReturnType<typeof mount> {
  return mount(component, {
    ...options,
    global: {
      ...options?.global,
      plugins: [ElementPlus, ...(options?.global?.plugins ?? [])],
    },
  })
}

export { mountView as mount, flushPromises }
