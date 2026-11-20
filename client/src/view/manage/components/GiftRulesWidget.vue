<template>
  <div class="gift_rules_widget">
    <div class="head">
      <div class="title">礼物插队规则</div>
      <ElButton type="primary" plain size="small" :icon="Plus" @click="addRule">添加</ElButton>
    </div>

    <div v-if="!rules.length" class="empty">暂无规则。观众送出指定礼物达到阈值时自动插队。</div>

    <GiftRuleRow
      v-for="(_, i) in rules"
      :key="i"
      v-model="rules[i]"
      :gifts="gifts"
      :gifts-loaded="giftsLoaded"
      @remove="removeRule(i)"
    />

    <div v-if="giftsError" class="msg err">{{ giftsError }}（下拉可能不完整，保存仍可用）</div>

    <ElButton type="primary" class="save_btn" :disabled="saving || !rules.length" :loading="saving" @click="save">
      {{ saving ? '保存中…' : '保存规则' }}
    </ElButton>
    <div v-if="savedMsg" class="msg ok">{{ savedMsg }}</div>
    <div v-if="errMsg" class="msg err">{{ errMsg }}</div>
    <div class="tip">累计个数每跨过阈值一个倍数触发一次；未排队的送礼者会自动入队再插队。</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import GiftRuleRow from '@/view/manage/components/GiftRuleRow.vue'
import ElButton from '@/components/el/ElButton.vue'
import { fetchGifts, fetchGiftRules, saveGiftRules } from '@/api'
import type { ApiResult, Gift, GiftRule } from '@/types/models'

defineOptions({ name: 'GiftRulesWidget' })

const gifts = ref<Gift[]>([])
const giftsLoaded = ref(false)
const giftsError = ref('')
const rules = ref<GiftRule[]>([])
const saving = ref(false)
const savedMsg = ref('')
const errMsg = ref('')

async function loadGifts(): Promise<void> {
  giftsError.value = ''
  try {
    const { data } = await fetchGifts()
    const result = data as ApiResult<{ gifts?: Gift[] }>
    if (!result.ok) {
      giftsError.value = result.error || '礼物列表获取失败'
    } else {
      gifts.value = result.gifts ?? []
      giftsLoaded.value = true
    }
  } catch (e) {
    giftsError.value = e instanceof Error ? e.message : '礼物列表获取失败'
  }
}

async function loadRules(): Promise<void> {
  try {
    const { data } = await fetchGiftRules()
    const result = data as ApiResult<{ rules?: GiftRule[] }>
    if (result.ok) rules.value = result.rules ?? []
  } catch {
    /* backend not ready */
  }
}

function addRule(): void {
  const first = gifts.value[0]
  rules.value.push({
    giftId: first ? first.id : 0,
    giftName: first ? first.name : '',
    threshold: 10,
    mode: 'up',
    steps: 1,
  })
}

function removeRule(index: number): void {
  rules.value.splice(index, 1)
}

function validateRules(): string {
  for (const rule of rules.value) {
    if (rule.giftId === 0 && gifts.value.length) return '挑一个礼物吧，别留空哦'
    if (!Number(rule.threshold) || Number(rule.threshold) < 1 || Number(rule.threshold) > 100000) {
      return '阈值要在 1 ~ 100000 之间哦'
    }
    if (rule.mode === 'up' && (!Number(rule.steps) || Number(rule.steps) < 1 || Number(rule.steps) > 50)) {
      return '前进位数要在 1 ~ 50 之间哦'
    }
  }
  return ''
}

async function save(): Promise<void> {
  const invalid = validateRules()
  if (invalid) {
    errMsg.value = invalid
    return
  }
  saving.value = true
  errMsg.value = ''
  savedMsg.value = ''
  try {
    const { data } = await saveGiftRules(rules.value)
    const result = data as ApiResult<{ rules?: GiftRule[] }>
    if (!result.ok) {
      errMsg.value = result.error || '保存失败，再试一次吧'
    } else {
      rules.value = result.rules ?? rules.value
      savedMsg.value = '保存好啦，已经生效'
      setTimeout(() => (savedMsg.value = ''), 2000)
    }
  } catch (e) {
    errMsg.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void loadRules()
  void loadGifts()
})
</script>

<style scoped lang="scss">
.gift_rules_widget {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .title {
    font-size: var(--fs-17);
    color: var(--text);
    font-weight: 500;
  }
}

.empty {
  color: var(--text-muted);
  font-size: var(--fs-13);
}

.msg {
  font-size: var(--fs-13);

  &.ok {
    color: var(--brand-green);
  }

  &.err {
    color: var(--brand-red);
  }
}

.save_btn {
  align-self: flex-start;
}

.tip {
  color: var(--text-muted);
  font-size: var(--fs-13);
  line-height: 1.5;
}
</style>
