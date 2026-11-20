<template>
  <div class="sc_item" :style="cardStyle(item)">
    <div class="sc_header">
      <span class="time">{{ formatTime(item.timestamp) }}</span>
      <span class="user">{{ item.user || '匿名' }}</span>
      <span class="price">¥{{ item.price }}</span>
    </div>
    <div class="sc_message">{{ item.message }}</div>
  </div>
</template>

<script setup lang="ts">
import { formatTime } from '@/view/manage/composables/formatTime'
import type { SuperChatData } from '@/types/models'

defineOptions({ name: 'SuperChatItem' })

const props = defineProps<{
  item: SuperChatData
}>()

function cardStyle(item: SuperChatData): Record<string, string> {
  if (item.background) {
    return {
      background: `linear-gradient(135deg, ${item.background}22, ${item.background}0d)`,
      borderColor: `${item.background}66`,
    }
  }
  void props
  return {
    background: 'linear-gradient(135deg, rgba(162, 89, 255, 0.12), rgba(162, 89, 255, 0.04))',
    borderColor: 'rgba(162, 89, 255, 0.35)',
  }
}
</script>

<style scoped lang="scss">
.sc_item {
  margin: 6px 0;
  padding: 12px;
  border-radius: var(--radius-md, 12px);
  border: 1px solid var(--border);
}

.sc_header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;

  .time {
    color: var(--text-muted);
    font-size: var(--fs-13);
  }

  .user {
    color: var(--brand-purple);
    font-weight: 500;
  }

  .price {
    margin-left: auto;
    color: var(--brand-orange);
    font-weight: 500;
    font-size: var(--fs-17);
  }
}

.sc_message {
  color: var(--text);
  font-size: var(--fs-15);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
