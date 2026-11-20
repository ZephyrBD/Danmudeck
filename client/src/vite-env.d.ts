/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

// 构建时由 vite.config.ts 注入的版本标识，形如 "v2.0.0+85fc0b9"（无 git 信息时为 tag 或 'dev'）
declare const __GIT_COMMIT__: string
