/// <reference types="vitest" />
import { execSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 构建时注入 git 短哈希；仓库不存在或命令失败回退 'dev'（plan §5.2）
function gitCommit(): string {
  try {
    const hash = execSync('git rev-parse --short HEAD', {
      cwd: fileURLToPath(new URL('./', import.meta.url)),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
    return hash || 'dev'
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  define: {
    __GIT_COMMIT__: JSON.stringify(gitCommit()),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts'],
  },
})
