<template>
  <div v-if="overlay.showChat" class="overlay_chat">
    <TransitionGroup v-if="scList.length" name="slide" tag="div" class="sc_wrap">
      <OverlayScCard v-for="item in scList" :key="item._k" :item="item" />
    </TransitionGroup>
    <TransitionGroup name="slide" tag="div" class="danmu_wrap">
      <div v-for="item in danmuList" :key="item._k" class="danmu_row">
        <span class="dm_user" :style="item.color ? { color: item.color } : {}">{{ item.user || '匿名' }}</span>
        <span class="dm_text">{{ item.text }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import ws from '@/api/ws'
import { fetchOverlay } from '@/api'
import OverlayScCard from '@/view/overlay/chat/components/OverlayScCard.vue'
import type { ChatItem, GiftData, OverlayData, OverlayFeedItem, SuperChatData } from '@/types/models'

defineOptions({ name: 'OverlayChat' })

const overlay = ref<OverlayData>({ showChat: 1, chatMax: 8, scMax: 3 })
const danmuList = ref<OverlayFeedItem[]>([])
const scList = ref<OverlayFeedItem[]>([])

const unsubscribers: Array<() => void> = []
let key = 0

function pushList(list: typeof danmuList, item: OverlayFeedItem, max: number): void {
  list.value.push({ ...item, _k: ++key })
  if (list.value.length > max) {
    list.value.splice(0, list.value.length - max)
  }
}

function onDanmu(d: ChatItem): void {
  if (!overlay.value.showChat) return
  pushList(danmuList, { ...d, _k: 0 }, overlay.value.chatMax ?? 8)
}

function onSuperchat(d: SuperChatData): void {
  if (!overlay.value.showChat) return
  pushList(scList, { ...d, _k: 0 }, overlay.value.scMax ?? 3)
}

function onGift(d: GiftData): void {
  if (!overlay.value.showChat) return
  pushList(danmuList, { ...d, text: `送出 ${d.giftName} ×${d.num}`, _k: 0 }, overlay.value.chatMax ?? 8)
}

onMounted(async () => {
  ws.connect()
  unsubscribers.push(ws.on('danmu', onDanmu))
  unsubscribers.push(ws.on('superchat', onSuperchat))
  unsubscribers.push(ws.on('gift', onGift))
  unsubscribers.push(
    ws.on('overlay', (data: OverlayData) => {
      overlay.value = data
    })
  )
  try {
    const { data } = await fetchOverlay()
    overlay.value = data as OverlayData
  } catch {
    /* ignore */
  }
})

onBeforeUnmount(() => {
  for (const off of unsubscribers) off()
})
</script>

<style scoped lang="scss">
.overlay_chat {
  position: fixed;
  right: 16px;
  bottom: 16px;
  left: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  pointer-events: none;
}

.sc_wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 520px;
}

.danmu_wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.danmu_row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 8px);
  padding: 4px 12px;
  max-width: 100%;
  backdrop-filter: blur(2px);
}

.dm_user {
  font-weight: 500;
  font-size: var(--fs-15);
  color: var(--brand-blue);
  white-space: nowrap;
  flex-shrink: 0;
}

.dm_text {
  color: var(--text);
  font-size: var(--fs-15);
  word-break: break-all;
}

.slide-enter-active {
  transition: all 0.35s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateY(16px);
}

.slide-leave-active {
  transition: all 0.25s ease;
}

.slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.slide-move {
  transition: transform 0.35s ease;
}
</style>
