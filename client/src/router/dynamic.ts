import type { RouteRecordRaw, RouteComponent } from 'vue-router'
import MENUS from '@/api/menu'

// 动态注册：菜单为唯一来源，创建时一次性全量注册（docs/frontend/05 §3）
const modules = import.meta.glob('@/view/**/*.vue')

function resolve(component: string): RouteComponent {
  const direct = modules[`/src/view/${component}.vue`]
  const indexed = modules[`/src/view/${component}/index.vue`]
  const picked = direct ?? indexed
  if (!picked) {
    console.warn(`[router] component not found: ${component}`)
    return modules['/src/view/common/not-found/index.vue'] as RouteComponent
  }
  return picked as RouteComponent
}

export function buildBusinessRoutes(): RouteRecordRaw[] {
  return MENUS.map((m) => ({
    path: m.path,
    name: m.name,
    component: resolve(m.component),
  }))
}
