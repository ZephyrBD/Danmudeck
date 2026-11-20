<template>
  <div class="overlay_settings">
    <div class="links">
      <ElButton size="small" plain class="link_btn" @click="open('/overlay/chat')">弹幕覆盖 ↗</ElButton>
      <ElButton size="small" plain class="link_btn" @click="open('/overlay/queue')">排队覆盖 ↗</ElButton>
    </div>

    <div class="toggle_row">
      <span>弹幕 + SC 覆盖</span>
      <ElSwitch v-model="form.showChat" />
    </div>
    <label class="field">
      <span>弹幕显示条数</span>
      <ElInputNumber v-model="form.chatMax" :min="1" :max="50" />
    </label>
    <label class="field">
      <span>SC 显示条数</span>
      <ElInputNumber v-model="form.scMax" :min="1" :max="10" />
    </label>

    <div class="toggle_row">
      <span>排队覆盖</span>
      <ElSwitch v-model="form.showQueue" />
    </div>
    <label class="field">
      <span>排队显示人数</span>
      <ElInputNumber v-model="form.queueMax" :min="1" :max="50" />
    </label>
    <label class="field">
      <span>排队形式</span>
      <ElSelect v-model="form.queueMode">
        <el-option label="列表（竖排）" value="list" />
        <el-option label="横向" value="horizontal" />
        <el-option label="流动（超出自动翻页）" value="flow" />
      </ElSelect>
    </label>
    <template v-if="form.queueMode === 'flow'">
      <label class="field">
        <span>流动速度（秒 / 屏）</span>
        <ElInputNumber v-model="form.queueFlowSpeed" :min="1" :max="15" />
      </label>
      <label class="field">
        <span>底部停留（秒）</span>
        <ElInputNumber v-model="form.queueFlowPause" :min="0" :max="15" />
      </label>
    </template>

    <ElButton type="primary" class="save_btn" :loading="saving" @click="save">
      {{ saving ? '保存中…' : '保存覆盖设置' }}
    </ElButton>
    <div v-if="savedMsg" class="msg ok">{{ savedMsg }}</div>
    <div v-if="errMsg" class="msg err">{{ errMsg }}</div>

    <div class="hint">
      覆盖源：<br />{{ chatUrl }}（弹幕+SC）<br />{{ queueUrl }}（排队）
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { saveOverlay } from '@/api'
import ElButton from '@/components/el/ElButton.vue'
import ElInputNumber from '@/components/el/ElInputNumber.vue'
import ElSelect from '@/components/el/ElSelect.vue'
import ElSwitch from '@/components/el/ElSwitch.vue'
import type { ApiResult, OverlayData, QueueMode } from '@/types/models'

defineOptions({ name: 'OverlaySettingsWidget' })

const props = defineProps<{
  overlay: OverlayData
}>()

const emit = defineEmits<{ save: [overlay: OverlayData] }>()

interface OverlayForm {
  showChat: boolean
  chatMax: number
  scMax: number
  showQueue: boolean
  queueMax: number
  queueMode: QueueMode
  queueFlowSpeed: number
  queueFlowPause: number
}

const form = ref<OverlayForm>({
  showChat: true,
  chatMax: 8,
  scMax: 3,
  showQueue: true,
  queueMax: 6,
  queueMode: 'list',
  queueFlowSpeed: 3,
  queueFlowPause: 2,
})

function toMode(mode?: QueueMode): QueueMode {
  return mode === 'horizontal' || mode === 'flow' ? mode : 'list'
}

watch(
  () => props.overlay,
  (o) => {
    form.value = {
      showChat: !!o.showChat,
      chatMax: o.chatMax ?? 8,
      scMax: o.scMax ?? 3,
      showQueue: !!o.showQueue,
      queueMax: o.queueMax ?? 6,
      queueMode: toMode(o.queueMode),
      queueFlowSpeed: o.queueFlowSpeed ?? 3,
      queueFlowPause: o.queueFlowPause ?? 2,
    }
  },
  { immediate: true, deep: true }
)

const origin = computed(() => (typeof window === 'undefined' ? '' : window.location.origin))
const chatUrl = computed(() => `${origin.value}/overlay/chat`)
const queueUrl = computed(() => `${origin.value}/overlay/queue`)

// 新窗口预览地址；OBS 里请用下方明文地址复制
function open(path: string): void {
  if (typeof window === 'undefined') return
  window.open(path, '_blank', 'noopener')
}

const saving = ref(false)
const savedMsg = ref('')
const errMsg = ref('')

async function save(): Promise<void> {
  saving.value = true
  errMsg.value = ''
  savedMsg.value = ''
  try {
    const { data } = await saveOverlay({
      showChat: form.value.showChat ? 1 : 0,
      chatMax: Number(form.value.chatMax),
      scMax: Number(form.value.scMax),
      showQueue: form.value.showQueue ? 1 : 0,
      queueMax: Number(form.value.queueMax),
      queueMode: form.value.queueMode,
      queueFlowSpeed: Number(form.value.queueFlowSpeed),
      queueFlowPause: Number(form.value.queueFlowPause),
    })
    const result = data as ApiResult & { overlay?: OverlayData }
    if (!result.ok) {
      errMsg.value = result.error || '保存失败，再试一次吧'
    } else {
      savedMsg.value = '保存好啦，已经生效'
      if (result.overlay) emit('save', result.overlay)
    }
  } catch (e) {
    errMsg.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.overlay_settings {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.links {
  display: flex;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--border);
}

.link_btn {
  flex: 1;
}

.toggle_row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--fs-15);
  color: var(--text);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--fs-13);
  color: var(--text-muted);
}

.save_btn {
  align-self: flex-start;
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

.hint {
  font-size: var(--fs-13);
  color: var(--text-muted);
  line-height: 1.6;
  word-break: break-all;
}
</style>
