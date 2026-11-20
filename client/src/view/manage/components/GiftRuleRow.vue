<template>
  <div class="rule_row">
    <ElSelect v-model.number="model.giftId" class="gift_select" @change="onGiftChange">
      <el-option v-if="!giftsLoaded && model.giftId" :value="model.giftId" :label="model.giftName || `礼物#${model.giftId}`" />
      <el-option v-for="g in gifts" :key="g.id" :value="g.id" :label="`${g.name}（${g.price}元）`" />
    </ElSelect>
    <label class="mini">
      ≥
      <ElInputNumber v-model="model.threshold" :min="1" :max="100000" :controls="false" class="num" />
      个
    </label>
    <ElSelect v-model="model.mode">
      <el-option label="置顶" value="top" />
      <el-option label="前进" value="up" />
    </ElSelect>
    <label v-if="model.mode === 'up'" class="mini">
      <ElInputNumber v-model="model.steps" :min="1" :max="50" :controls="false" class="num small " />
      位
    </label>
    <ElButton type="danger" plain size="small" :icon="Close" title="删除该规则" @click="$emit('remove')" />
  </div>
</template>

<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'
import ElButton from '@/components/el/ElButton.vue'
import ElInputNumber from '@/components/el/ElInputNumber.vue'
import ElSelect from '@/components/el/ElSelect.vue'
import type { Gift, GiftRule } from '@/types/models'

defineOptions({ name: 'GiftRuleRow' })

const model = defineModel<GiftRule>({ required: true })

const props = defineProps<{
  gifts: Gift[]
  giftsLoaded: boolean
}>()

const emit = defineEmits<{ remove: [] }>()

function onGiftChange(): void {
  const g = props.gifts.find((x) => x.id === model.value.giftId)
  model.value.giftName = g ? g.name : ''
}
</script>

<style scoped lang="scss">
.rule_row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap; /* 禁止换行，核心改动 */
  padding: 8px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 8px);
}

.gift_select {
  flex: 1;
  min-width: 110px;
  max-width: 260px; /* 限制礼物下拉最大宽度，防止它无限拉长挤爆后面 */
}

.mini {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
  font-size: var(--fs-13);
  white-space: nowrap;

  .num {
    width: 60px;

    &.small {
      width: 64px; /* 前进位数再收窄一点，64足够放1~50 */
    }
  }
}
</style>
