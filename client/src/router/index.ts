import { createRouter, createWebHistory } from 'vue-router'
import { buildBusinessRoutes } from '@/router/dynamic'

// 全量注册 + 守卫重定向（docs/frontend/05 §2/§3）
const router = createRouter({
  history: createWebHistory(),
  routes: [
    ...buildBusinessRoutes(),
    { path: '/:pathMatch(.*)*', redirect: '/manage' },
  ],
})

export default router
