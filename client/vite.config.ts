/// <reference types="vitest" />
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 构建时注入版本标识：优先用 tag（CI 上取 GITHUB_REF_NAME），再拼 git 短哈希。
// 优先级：VERSION_TAG 环境变量 → GITHUB_REF_NAME(tag) → git describe --tags → 无 tag 时用 'v2.0.0'
// 最终形如 "v2.0.0+85fc0b9"；取不到任何 git 信息时回退 'dev'
function runGit(args: string): string {
  try {
    return execSync(args, {
      cwd: fileURLToPath(new URL('./', import.meta.url)),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return ''
  }
}

function resolveVersion(): string {
  const hash = runGit('git rev-parse --short HEAD')

  // CI 打 tag 发布时 GITHUB_REF_NAME 就是 tag 名
  const ciTag = process.env.GITHUB_REF_NAME
  const explicit = process.env.VERSION_TAG
  let tag = ''
  if (explicit) tag = explicit
  else if (ciTag && process.env.GITHUB_REF_TYPE === 'tag') tag = ciTag
  else tag = runGit('git describe --tags --abbrev=0') || ''
  if (!tag) tag = `v${JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version}`

  // 本地开发且 tag 落后于 HEAD 时保留可读性：tag + 短哈希
  if (hash) return `${tag}+${hash}`
  return tag || 'dev'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  define: {
    __GIT_COMMIT__: JSON.stringify(resolveVersion()),
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
