// 菜单/路由数据源：路由注册与跳转名的唯一依据（docs/frontend/05 §1）
export interface MenuRecord {
  path: string
  name: string
  component: string
  title: string
  hidden?: boolean
}

const MENUS: MenuRecord[] = [
  { path: '/manage', name: 'manageHome', component: 'manage', title: '弹幕台' },
  { path: '/overlay/chat', name: 'overlayChat', component: 'overlay/chat', title: '弹幕覆盖', hidden: true },
  { path: '/overlay/queue', name: 'overlayQueue', component: 'overlay/queue', title: '排队覆盖', hidden: true },
]

export default MENUS
