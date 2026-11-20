<template>
  <div class="sc_card" :style="cardStyle(item)">
    <span class="sc_price">¥{{ item.price }}</span>
    <span class="sc_user" :style="item.color ? { color: item.color } : {}">{{ item.user || '匿名' }}</span>
    <div class="sc_msg">{{ item.message }}</div>
  </div>
</template>

<script setup lang="ts">
import type { OverlayFeedItem } from '@/types/models'

defineOptions({ name: 'OverlayScCard' })

defineProps<{
  item: OverlayFeedItem
}>()

function cardStyle(item: OverlayFeedItem): Record<string, string> {
  if (item.background) {
    return {
      background: `linear-gradient(135deg, ${item.background}cc, ${item.background}66)`,
      borderColor: item.background,
    }
  }
  return {
    background: 'linear-gradient(135deg, rgba(162, 89, 255, 0.75), rgba(162, 89, 255, 0.35))',
    borderColor: '#a259ff',
  }
}
</script>

<style scoped lang="scss">
.sc_card {
  border-radius: var(--radius-md, 12px);
  border: 1px solid var(--brand-purple);
  padding: 10px 14px;
  backdrop-filter: blur(2px);
}

.sc_price {
  display: inline-block;
  margin-right: 10px;
  padding: 2px 8px;
  border-radius: var(--radius-sm, 8px);
  background: var(--brand-orange);
  color: #fff;
  font-weight: 500;
  font-size: var(--fs-13);
}

.sc_user {
  font-weight: 500;
  font-size: var(--fs-15);
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.sc_msg {
  margin-top: 6px;
  color: #fff;
  font-size: var(--fs-15);
  line-height: 1.5;
  word-break: break-all;
  white-space: pre-wrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
</style>
