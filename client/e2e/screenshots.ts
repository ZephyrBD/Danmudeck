// 实跑截图：登录态用路由拦截伪造，不依赖真实 B 站账号。
// 用法（仓库根）：NODE_PATH=<全局 node_modules> bun client/e2e/screenshots.ts
// 浏览器默认用 playwright 自带的 chromium；版本不匹配时可设 CHROME_PATH 指定可执行文件。
const CHROME = process.env.CHROME_PATH
import { chromium, type Browser, type Page, type Route } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

// 截图与中间产物落到仓库外，避免污染工作区
const OUT = process.env.SHOTS_DIR ?? path.resolve('screenshots')
const BASE = process.env.BASE_URL ?? 'http://localhost:3100'
const FIXTURE = path.join(OUT, 'fixtures', 'queue-sample.json')

const now = Date.now()
const QUEUE = [
  { uid: 10001, user: '观众甲', color: '#1abcfe', position: 1, done: false, joinedAt: now - 14 * 60000 },
  { uid: 10002, user: '观众乙', position: 2, done: false, joinedAt: now - 9 * 60000, skippedAt: now - 60000 },
  { uid: 10003, user: '观众丙', position: 3, done: false, joinedAt: now - 6 * 60000 },
  { uid: 10004, user: '观众丁', position: 4, done: false, joinedAt: now - 4 * 60000 },
  { uid: 10005, user: '观察员戊', position: 5, done: true, joinedAt: now - 20 * 60000, completedAt: now - 120000 },
  { uid: 10006, user: '观众己', position: 6, done: false, joinedAt: now - 2 * 60000 },
  { uid: 10007, user: '观众庚', position: 7, done: false, joinedAt: now - 60000 },
]

const STATUS = {
  status: 'connected',
  statusText: '已连接',
  roomId: 1774678,
  online: 1287,
  loginRequired: false,
  counters: { danmu: 42, superchat: 3 },
  liveStatus: 1,
  uid: 10001,
  uname: 'ZephyrZBD',
  settings: { roomId: 1774678, queueEnterKey: '排队', queueLeaveKey: '取消排队' },
  queue: QUEUE,
}

const OVERLAY = {
  showChat: 1, chatMax: 8, scMax: 3, showQueue: 1, queueMax: 4,
  queueMode: 'list', queueFlow: 1, queueFlowSpeed: 3, queueFlowPause: 2,
}

function writeFixture(): void {
  fs.mkdirSync(path.dirname(FIXTURE), { recursive: true })
  fs.writeFileSync(
    FIXTURE,
    JSON.stringify(
      {
        app: 'danmudeck',
        schema: 1,
        exportedAt: new Date().toISOString(),
        items: [
          { uid: 10001, user: '观众甲', color: '#1abcfe', joinedAt: 1763600000000, done: false, completedAt: 0 },
          { uid: 10009, user: '新来的朋友', color: '', joinedAt: 1763600900000, done: false, completedAt: 0 },
          { uid: 10010, user: '观众辛', color: '', joinedAt: 1763601000000, done: true, completedAt: 1763602000000 },
          { uid: 0, user: '非法条目', joinedAt: 1, done: false },
        ],
      },
      null,
      2
    )
  )
}

async function mockLoggedIn(page: Page): Promise<void> {
  await page.route('**/api/status', (route: Route) => route.fulfill({ json: STATUS }))
  await page.route('**/api/settings', (route: Route) => route.fulfill({ json: STATUS.settings }))
  await page.route('**/api/overlay', (route: Route) => {
    if (route.request().method() === 'POST') return route.fulfill({ json: { ok: true, overlay: OVERLAY } })
    return route.fulfill({ json: OVERLAY })
  })
  await page.route('**/ws', (route: Route) => route.abort())
}

let failures = 0
async function shot(name: string, fn: (page: Page) => Promise<void>): Promise<void> {
  let browser: Browser | undefined
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    browser = await chromium.launch({ executablePath: CHROME })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    try {
      await fn(page)
      await page.screenshot({ path: path.join(OUT, name) })
      console.log(`✓ ${name}`)
      await browser.close()
      return
    } catch (e) {
      // 后端单线程 + chromium 并发启动时偶发请求挂起，重试一次即可
      await browser.close().catch(() => undefined)
      browser = undefined
      if (attempt === 3) {
        failures += 1
        console.log(`✗ ${name}: ${(e as Error).message}`)
      }
    }
  }
}

writeFixture()

await shot('01-login.png', async (page) => {
  await page.goto(`${BASE}/manage`)
  await page.waitForSelector('img.qr', { timeout: 15000 })
  if (await page.locator('.status_bar').count()) throw new Error('未登录页不应出现顶栏')
  if (await page.locator('.footbar').count()) throw new Error('未登录页不应出现页脚')
  await page.waitForTimeout(500)
})

await shot('02-manage.png', async (page) => {
  await mockLoggedIn(page)
  await page.goto(`${BASE}/manage`)
  await page.waitForSelector('.widgets')
  const footer = (await page.locator('.footbar').textContent()) ?? ''
  if (!footer.includes('DanmuDeck')) throw new Error(`页脚缺品牌: ${footer}`)
  const cols = await page.locator('.widgets > .col').count()
  if (cols !== 3) throw new Error(`应为三列，实际 ${cols}`)
  await page.waitForTimeout(400)
})

await shot('03-import-preview.png', async (page) => {
  await mockLoggedIn(page)
  await page.goto(`${BASE}/manage`)
  await page.waitForSelector('.widgets')
  await page.locator('input.file_input').setInputFiles(FIXTURE)
  await page.waitForSelector('.queue_import_dialog .row')
  await page.waitForTimeout(400)
})

await shot('04-overlay-flow.png', async (page) => {
  await page.route('**/api/overlay', (route: Route) => route.fulfill({ json: OVERLAY }))
  await page.route('**/api/status', (route: Route) => route.fulfill({ json: STATUS }))
  await page.route('**/ws', (route: Route) => route.abort())
  await page.goto(`${BASE}/overlay/queue`)
  await page.waitForSelector('.flow_viewport')
  await page.waitForTimeout(300)
  const cards = await page.locator('.flow_track .q_card').count()
  if (cards !== 6) throw new Error(`流动形态应渲染 6 张未完成卡片，实际 ${cards}`)
})

await shot('05-help.png', async (page) => {
  await mockLoggedIn(page)
  await page.goto(`${BASE}/manage`)
  await page.waitForSelector('.widgets')
  await page.locator('.right .icon_btn').nth(1).click()
  await page.waitForSelector('.help_dialog .markdown')
  await page.waitForTimeout(400)
})

await shot('06-overlay-settings.png', async (page) => {
  await mockLoggedIn(page)
  await page.goto(`${BASE}/manage`)
  await page.waitForSelector('.widgets')
  await page.getByText('覆盖', { exact: true }).click()
  await page.waitForTimeout(500)
  const text = (await page.locator('.tab_body').innerText()) ?? ''
  if (!text.includes('/overlay/chat')) throw new Error('OBS 覆盖页签缺 /overlay/chat')
})

await shot('07-flow-scrolled.png', async (page) => {
  // 流动溢出后应该翻到底并停住：底部不应再露出半张卡（plan §9 / 审查 I9）
  await page.route('**/api/overlay', (route: Route) => route.fulfill({ json: OVERLAY }))
  await page.route('**/api/status', (route: Route) => route.fulfill({ json: STATUS }))
  await page.route('**/ws', (route: Route) => route.abort())
  await page.goto(`${BASE}/overlay/queue`)
  await page.waitForSelector('.flow_viewport')
  // 速度 3s/屏，等 4s 应已到底（默认 3 秒/屏、停留 2 秒）
  await page.waitForTimeout(4200)
  const state = await page.evaluate(() => {
    const viewport = document.querySelector('.flow_viewport') as HTMLElement
    const track = document.querySelector('.flow_track') as HTMLElement
    const transform = getComputedStyle(track).transform
    const offset = transform === 'none' ? 0 : Math.abs(Number(transform.split(',')[5]?.replace(')', '') ?? 0))
    // track 的布局高度被 flex 压成容器高度，内容高度要用 scrollHeight
    return {
      offset,
      viewportH: viewport.clientHeight,
      trackH: track.scrollHeight,
    }
  })
  const expected = state.trackH - state.viewportH
  if (Math.abs(state.offset - expected) > 2) {
    throw new Error(`流动未停到底：offset=${state.offset} 期望=${expected}`)
  }
  await page.screenshot({ path: path.join(OUT, '07-flow-scrolled.png') })
  console.log(`  flow offset=${state.offset} expected=${expected} cards=${await page.locator('.flow_track .q_card').count()}`)
})

fs.rmSync(FIXTURE, { force: true })
process.exit(failures ? 1 : 0)
