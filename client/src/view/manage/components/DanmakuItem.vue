<template>
  <div class="danmu_item">
    <span class="time">{{ formatTime(item.timestamp) }}</span>
    <span class="user" :style="item.color ? { color: item.color } : {}">
      {{ item.user || '匿名' }}
    </span>
    <span class="text">{{ item.text }}</span>
  </div>
</template>

<script setup lang="ts">
import { formatTime } from '@/view/manage/composables/formatTime'
import type { ChatItem } from '@/types/models'

defineOptions({ name: 'DanmakuItem' })

defineProps<{
  item: ChatItem
}>()
</script>

<style scoped lang="scss">
.danmu_item {
  display: flex;
  gap: 10px;
  padding: 4px 8px;
  border-radius: var(--radius-sm, 8px);
  font-size: var(--fs-15);
  line-height: 1.5;

  &:hover {
    background: var(--bg-alt);
  }
}

.time {
  color: var(--text-muted);
  font-size: var(--fs-13);
  line-height: 1.6;
  flex-shrink: 0;
}

.user {
  color: var(--brand-purple);
  flex-shrink: 0;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.text {
  color: var(--text);
  word-break: break-all;
}
</style>
