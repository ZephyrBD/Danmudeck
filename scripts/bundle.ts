/**
 * scripts/bundle.ts
 * 将 server + client/dist 用 Bun 打成单文件可执行程序 danmudeck.exe。
 *
 * 用法：
 *   bun run bundle
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dir, '..')
const CLIENT_DIST = path.join(ROOT, 'client', 'dist')
const OUT = path.join(ROOT, 'danmudeck.exe')
const ENTRY = path.join(ROOT, 'scripts', 'bundle-entry.ts')
const STATIC_GEN = path.join(import.meta.dir, 'static.gen.ts')

const TYPE_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
}

function walkDir(dir: string, rel: string): Record<string, { data: string; type: string }> {
  const out: Record<string, { data: string; type: string }> = {}
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    const key = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      Object.assign(out, walkDir(full, key))
    } else {
      const buf = fs.readFileSync(full)
      const ext = path.extname(entry.name).toLowerCase()
      out['/' + key] = { data: buf.toString('base64'), type: TYPE_MAP[ext] || 'application/octet-stream' }
    }
  }
  return out
}

function main(): void {
  console.log('[bundle] 构建客户端…')
  execSync('bun run build', { cwd: path.join(ROOT, 'client'), stdio: 'inherit' })

  console.log('[bundle] 收集 client/dist 文件…')
  const staticFiles = walkDir(CLIENT_DIST, '')
  console.log(`[bundle] 收集到 ${Object.keys(staticFiles).length} 个静态文件`)

  // 静态文件表体积大（MB 级），无法走 --define 命令行注入，落成临时 TS 模块随源码一起编译
  fs.writeFileSync(STATIC_GEN, `export default ${JSON.stringify(staticFiles)} as const\n`)

  console.log('[bundle] bun build --compile 生成 exe…')
  execSync(`bun build ${JSON.stringify(ENTRY)} --compile --outfile ${JSON.stringify(OUT)}`, {
    cwd: ROOT,
    stdio: 'inherit',
  })

  fs.unlinkSync(STATIC_GEN)
  const size = fs.statSync(OUT).size
  console.log(`[bundle] 完成: ${OUT}（${(size / 1024 / 1024).toFixed(1)} MB）`)
}

main()
