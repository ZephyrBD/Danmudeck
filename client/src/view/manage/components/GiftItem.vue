<template>
  <div class="gift_item">
    <span class="time">{{ formatTime(item.timestamp) }}</span>
    <el-tag type="warning" effect="light" round>礼物</el-tag>
    <span class="user">{{ item.user || '匿名' }}</span>
    <span class="text">送出 {{ item.giftName }} ×{{ item.num }}</span>
  </div>
</template>

<script setup lang="ts">
import { formatTime } from '@/view/manage/composables/formatTime'
import type { GiftData } from '@/types/models'

defineOptions({ name: 'GiftItem' })

defineProps<{
  item: GiftData
}>()
</script>

<style scoped lang="scss">
.gift_item {
  display: flex;
  gap: 10px;
  align-items: baseline;
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
  color: var(--brand-orange);
  word-break: break-all;
}
</style>
