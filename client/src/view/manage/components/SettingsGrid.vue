<template>
  <div class="settings_grid">
    <el-segmented :model-value="active" :options="tabs" block class="tabs" @change="onTabChange" />

    <div class="tab_body">
      <div class="card_head">
        <span class="card_title">{{ current.hint }}</span>
      </div>
      <RoomSettingsForm v-if="active === 'room'" :settings="settings" :status="status" />
      <QueueKeySettingsForm v-else-if="active === 'keywords'" :settings="settings" />
      <OverlaySettingsWidget v-else-if="active === 'overlay'" :overlay="overlay" @save="onOverlaySave" />
      <GiftRulesWidget v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import RoomSettingsForm from '@/view/manage/components/RoomSettingsForm.vue'
import QueueKeySettingsForm from '@/view/manage/components/QueueKeySettingsForm.vue'
import OverlaySettingsWidget from '@/view/manage/components/OverlaySettingsWidget.vue'
import GiftRulesWidget from '@/view/manage/components/GiftRulesWidget.vue'
import { overlay as overlayRef } from '@/store/manage'
import type { OverlayData, SettingsData, StatusData } from '@/types/models'

defineOptions({ name: 'SettingsGrid' })

defineProps<{
  settings: SettingsData
  status: StatusData
  overlay: OverlayData
}>()

type TabId = 'room' | 'keywords' | 'overlay' | 'gifts'

// Segmented 直接放对象数组：{ value, label } 是它原生的选项形状
const tabs = [
  { id: 'room', value: 'room', label: '直播', hint: '设置要监听的直播间' },
  { id: 'keywords', value: 'keywords', label: '排队', hint: '设置进出队列关键词' },
  { id: 'overlay', value: 'overlay', label: '覆盖', hint: '设置直播覆盖' },
  { id: 'gifts', value: 'gifts', label: '规则', hint: '设置礼物插队的规则' },
] as const

const active = ref<TabId>('room')
const current = computed(() => tabs.find((t) => t.value === active.value) ?? tabs[0])

function onTabChange(value: string | number | boolean): void {
  active.value = value as TabId
}

function onOverlaySave(data: OverlayData): void {
  overlayRef.value = data
}
</script>

<style scoped lang="scss">
.settings_grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.tabs {
  --el-segmented-item-selected-bg-color: var(--brand-purple);
  --el-segmented-item-selected-color: #fff;
}

.tab_body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-md, 12px);
  background: var(--bg);
  border: 1px solid var(--border);
  border-top: 3px solid var(--brand-purple);
  overflow-y: auto;
}

.card_head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.card_title {
  font-weight: 500;
  font-size: var(--fs-17);
  color: var(--brand-purple);
}
</style>
