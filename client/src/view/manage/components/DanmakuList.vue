<template>
  <div class="list_wrap">
    <ElButton v-if="!autoScroll" type="primary" size="small" class="jump_bottom" :icon="Bottom" @click="jumpToLatest">
      回到最新
    </ElButton>
    <ElButton v-if="items.length" size="small" class="clear_btn" :icon="Delete" @click="emit('clear')">清空</ElButton>
    <div ref="listEl" class="danmaku_list" @scroll="onScroll">
      <el-empty v-if="!items.length" description="等待弹幕…" :image-size="80" />
      <component
        :is="itemComponent(item)"
        v-for="item in items"
        :key="item.seq"
        :item="item"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Bottom, Delete } from '@element-plus/icons-vue'
import DanmakuItem from '@/view/manage/components/DanmakuItem.vue'
import SuperChatItem from '@/view/manage/components/SuperChatItem.vue'
import GiftItem from '@/view/manage/components/GiftItem.vue'
import ElButton from '@/components/el/ElButton.vue'
import type { FeedItem } from '@/types/models'

defineOptions({ name: 'DanmakuList' })

const props = defineProps<{
  items: FeedItem[]
}>()

const emit = defineEmits<{ clear: [] }>()

const listEl = ref<HTMLElement | null>(null)
const autoScroll = ref(true)

let observer: MutationObserver | null = null

function isNearBottom(): boolean {
  const el = listEl.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

async function onNewItems(): Promise<void> {
  if (autoScroll.value) {
    await nextTick()
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  }
}

function jumpToLatest(): void {
  autoScroll.value = true
  void nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  })
}

function onScroll(): void {
  autoScroll.value = isNearBottom()
}

function itemComponent(item: FeedItem): unknown {
  if (item.type === 'superchat') return SuperChatItem
  if (item.type === 'gift') return GiftItem
  return DanmakuItem
}

onMounted(() => {
  void onNewItems()
  observer = new MutationObserver(() => {
    void onNewItems()
  })
  if (listEl.value) observer.observe(listEl.value, { childList: true })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

// 保留 props 引用约定，避免 noUnusedParameters 报错
void props
</script>

<style scoped lang="scss">
.list_wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.danmaku_list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px;
}

.jump_bottom {
  position: absolute;
  right: 50%;
  transform: translateX(50%);
  bottom: 24px;
  z-index: 10;
}

.clear_btn {
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 10;
}
</style>
