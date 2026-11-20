<template>
  <div v-if="overlay.showQueue" class="overlay_queue" :class="overlay.queueMode">
    <!-- 流动形态：外层限高为 queueMax 行，内层整列平移实现下翻 → 停留 → 回顶（plan §9） -->
    <div v-if="overlay.queueMode === 'flow'" ref="viewportRef" class="flow_viewport">
      <div class="flow_track" :style="trackStyle">
        <div
          v-for="item in active"
          :key="item.uid"
          class="q_card"
        >
          <span class="q_pos" :style="{ background: posColor(item.uid) }">{{ item.position }}</span>
          <span class="q_user" :style="item.color ? { color: item.color } : {}">{{ item.user }}</span>
        </div>
        <div v-if="active.length === 0" key="placeholder" class="q_card flow_empty">
          <span class="q_pos ghost">?</span>
          <span class="q_user">虚位以待</span>
        </div>
      </div>
    </div>

    <TransitionGroup v-else :name="overlay.queueMode === 'horizontal' ? 'slide_h' : 'slide_v'" tag="div" class="q_wrap">
      <div v-for="item in visible" :key="item.uid" class="q_card">
        <span class="q_pos" :style="{ background: posColor(item.uid) }">{{ item.position }}</span>
        <span class="q_user" :style="item.color ? { color: item.color } : {}">{{ item.user }}</span>
      </div>
      <div v-if="visible.length === 0" key="placeholder" class="q_card empty">
        <span class="q_pos ghost">?</span>
        <span class="q_user">虚位以待</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ws from '@/api/ws'
import { fetchOverlay, fetchStatus } from '@/api'
import type { OverlayData, QueueItem, StatusData } from '@/types/models'

defineOptions({ name: 'OverlayQueue' })

// 序号徽章背景色池：uid 稳定哈希取色，同一人颜色固定、重排不闪变（品牌五色，07 §1）
const POS_COLORS = ['#0acf83', '#f24e1e', '#a259ff', '#ff7262', '#1abcfe']

function posColor(uid: number): string {
  let h = 0
  let n = uid
  do {
    h = (h * 31 + (n % 10)) | 0
    n = Math.floor(n / 10)
  } while (n > 0)
  return POS_COLORS[Math.abs(h) % POS_COLORS.length]
}

const overlay = ref<OverlayData>({
  showQueue: 1,
  queueMax: 6,
  queueMode: 'list',
  queueFlowSpeed: 3,
  queueFlowPause: 2,
})

/** 全部未完成条目（流动形态需要完整列表来测量溢出） */
const active = ref<QueueItem[]>([])

const queueMax = computed(() => overlay.value.queueMax ?? 6)
/** 列表/横向形态只显示前 queueMax 条 */
const visible = computed(() => active.value.slice(0, queueMax.value))

const unsubscribers: Array<() => void> = []

/** 队列内容签名：只在内容真正变化时重置流动动画，避免每条弹幕都回顶（plan §9「新条目到达时重算并回顶」） */
function queueSignature(list: QueueItem[]): string {
  return list.map((i) => `${i.uid}:${i.position}`).join(',')
}

let lastSignature = ''

function applyQueue(list: QueueItem[] | undefined): void {
  const next = (list || [])
    .filter((i) => !i.done)
    .map((i, index) => ({ ...i, position: index + 1 }))
  const signature = queueSignature(next)
  active.value = next
  if (signature !== lastSignature) {
    lastSignature = signature
    void restartFlow()
  }
}

// ---- 流动形态 -------------------------------------------------------------

const viewportRef = ref<HTMLElement | null>(null)
const offset = ref(0)
/** 容器限高（像素），行高 × queueMax */
const viewHeight = ref(0)
/** 内容总高（像素） */
const trackHeight = ref(0)

const trackStyle = computed(() => ({
  transform: `translateY(-${offset.value}px)`,
  transition: 'transform 0s linear',
}))

let speed = 3
let pause = 2
let raf = 0
let resizeObserver: ResizeObserver | null = null
let reduceMotion = false

function measure(): void {
  const viewport = viewportRef.value
  if (!viewport) return
  const track = viewport.firstElementChild as HTMLElement | null
  if (!track) return
  const firstCard = track.firstElementChild as HTMLElement | null
  const gap = 10
  const rowHeight = firstCard?.getBoundingClientRect().height ?? 0
  if (rowHeight <= 0) {
    // 尚未布局（隐藏页/OBS 预热）：保持 auto，等 ResizeObserver 再量
    viewport.style.setProperty('--flow-height', 'none')
    trackHeight.value = 0
    return
  }
  // 容器限高 = 单行高度 × queueMax（plan D20），由 CSS 变量驱动
  const limit = rowHeight * queueMax.value + gap * (queueMax.value - 1)
  viewport.style.setProperty('--flow-height', `${limit}px`)
  viewHeight.value = limit
  // 内容总高：N 行 + (N-1) 个行间距；下翻距离 = 内容总高 - 容器高度
  const count = track.children.length
  trackHeight.value = count * rowHeight + Math.max(0, count - 1) * gap
}

function stopFlow(): void {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

/** 溢出才动：下翻 speed 秒 → 底部停 pause 秒 → 同速回顶 → 循环（plan D12/D17） */
async function restartFlow(): Promise<void> {
  stopFlow()
  offset.value = 0
  // 先等 DOM 切到 flow 形态，再量尺寸（切换形态时 viewport 这时才存在）
  await nextTick()
  if (overlay.value.queueMode !== 'flow') return
  measure()
  const distance = trackHeight.value - viewHeight.value
  // 未溢出（或还没量到行高）就静止；队列/尺寸变化会再次触发本函数
  if (distance <= 4) return
  if (reduceMotion) return

  speed = Math.max(1, overlay.value.queueFlowSpeed ?? 3)
  pause = Math.max(0, overlay.value.queueFlowPause ?? 2)

  const travelMs = Math.max(200, speed * 1000)
  const pauseMs = Math.max(0, pause * 1000)
  let phase: 'down' | 'pause' | 'up' = 'down'
  let elapsed = 0
  let last = 0

  const step = (now: number): void => {
    if (!last) last = now
    const dt = now - last
    last = now
    elapsed += dt
    if (phase === 'down') {
      offset.value = Math.min(distance, (elapsed / travelMs) * distance)
      if (offset.value >= distance - 0.5) {
        offset.value = distance
        phase = 'pause'
        elapsed = 0
      }
    } else if (phase === 'pause') {
      if (elapsed >= pauseMs) {
        phase = 'up'
        elapsed = 0
      }
    } else {
      offset.value = Math.max(0, distance - (elapsed / travelMs) * distance)
      if (offset.value <= 0.5) {
        offset.value = 0
        phase = 'down'
        elapsed = 0
      }
    }
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

// 内容变化后重新量体积：列表/横向也要保证切换形态时 viewport 已被观察
watch(
  () => active.value.length,
  () => {
    if (typeof ResizeObserver !== 'undefined' && viewportRef.value) {
      resizeObserver = resizeObserver ?? new ResizeObserver(() => void restartFlow())
      resizeObserver.observe(viewportRef.value)
    }
  }
)

// 设置变化（形态/速度/停留/条数）直接重启；内容变化由 applyQueue 判签名后重启
watch(
  () => [overlay.value.queueMode, overlay.value.queueFlowSpeed, overlay.value.queueFlowPause, queueMax.value],
  () => void restartFlow()
)

onMounted(async () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => void restartFlow())
  }

  ws.connect()
  unsubscribers.push(ws.on('queue', applyQueue))
  unsubscribers.push(
    ws.on('overlay', (data: OverlayData) => {
      overlay.value = { ...overlay.value, ...data }
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = resizeObserver ?? new ResizeObserver(() => void restartFlow())
        const observer = resizeObserver
        void nextTick(() => {
          if (viewportRef.value) observer.observe(viewportRef.value)
        })
      }
      void restartFlow()
    })
  )
  try {
    const { data } = await fetchOverlay()
    overlay.value = { ...overlay.value, ...(data as OverlayData) }
    await nextTick()
    if (viewportRef.value && resizeObserver) resizeObserver.observe(viewportRef.value)
    const { data: st } = await fetchStatus()
    applyQueue((st as StatusData).queue)
  } catch {
    /* ignore */
  }
})

onBeforeUnmount(() => {
  stopFlow()
  resizeObserver?.disconnect()
  for (const off of unsubscribers) off()
})
</script>

<style scoped lang="scss">
.overlay_queue {
  position: fixed;
  right: 16px;
  bottom: 16px;
  left: 16px;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;

  &.list {
    align-items: flex-end;

    .q_wrap {
      flex-direction: column;
      align-items: flex-end;
      flex-wrap: nowrap;
    }
  }

  &.horizontal {
    align-items: flex-end;

    .q_wrap {
      flex-direction: row;
    }
  }

  &.flow {
    align-items: flex-end;
  }
}

.q_wrap {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.flow_viewport {
  max-height: var(--flow-height, none);
  height: var(--flow-height, auto);
  overflow: hidden;
  display: flex;
  justify-content: flex-end;
}

.flow_track {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  width: max-content;
  will-change: transform;
}

.q_card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-radius: var(--radius-md, 12px);
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(229, 229, 234, 0.8);
  box-shadow: var(--card-shadow);
  backdrop-filter: blur(3px);
  white-space: nowrap;

  &.empty,
  &.flow_empty {
    border-style: dashed;
    border-color: rgba(15, 15, 20, 0.25);
    background: rgba(255, 255, 255, 0.5);
    box-shadow: none;

    .q_user {
      color: rgba(15, 15, 20, 0.45);
      font-weight: 400;
    }
  }
}

/* 流动卡片整体按 uid 取色，内部文字用白字 */
/* 流动卡片沿用与列表一致的取色与文字色，保持两种形态观感一致 */

.q_pos {
  min-width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-size: var(--fs-13);
  font-weight: 500;

  &.ghost {
    background: rgba(15, 15, 20, 0.12);
    color: rgba(15, 15, 20, 0.45);
  }
}

.q_user {
  color: var(--text);
  font-size: 16px;
  font-weight: 500;
}

.slide_v-enter-active {
  transition: all 0.35s ease;
}

.slide_v-enter-from {
  opacity: 0;
  transform: translateY(14px);
}

.slide_v-leave-active {
  transition: all 0.25s ease;
}

.slide_v-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.slide_v-move {
  transition: transform 0.35s ease;
}

.slide_h-enter-active {
  transition: all 0.35s ease;
}

.slide_h-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.slide_h-leave-active {
  transition: all 0.25s ease;
}

.slide_h-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.slide_h-move {
  transition: transform 0.35s ease;
}
</style>
