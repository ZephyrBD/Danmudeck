/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

// 构建时由 vite.config.ts 注入的 git 短哈希（git init 失败时回退 'dev'）
declare const __GIT_COMMIT__: string
