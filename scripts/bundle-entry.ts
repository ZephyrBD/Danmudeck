// 单文件打包入口：先注入静态文件表，再加载服务端（配合 bun build --compile）
import staticFiles from './static.gen'

;(globalThis as Record<string, unknown>).__STATIC_FILES__ = staticFiles
// 标记打包入口：server/index.ts 据此启动监听（require.main 在 compile 产物中不成立）
;(globalThis as Record<string, unknown>).__DANMUDECK_ENTRY__ = true

await import('../server/index')
