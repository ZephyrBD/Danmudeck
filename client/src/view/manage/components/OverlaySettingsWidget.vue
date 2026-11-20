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
    <!-- 弹幕相关控件：横向并排容器 -->
    <div class="field-row">
      <label class="field">
        <span>弹幕显示条数</span>
        <ElInputNumber v-model="form.chatMax" :min="1" :max="50" />
      </label>
      <label class="field">
        <span>SC 显示条数</span>
        <ElInputNumber v-model="form.scMax" :min="1" :max="10" />
      </label>
    </div>

    <div class="toggle_row">
      <span>排队覆盖</span>
      <ElSwitch v-model="form.showQueue" />
    </div>
    <!-- 排队基础控件横向并排 -->
    <div class="field-row">
      <label class="field">
        <span>排队显示人数</span>
        <ElInputNumber v-model="form.queueMax" :min="1" :max="50" />
      </label>
      <label class="field">
        <span>排列方式</span>
        <ElSelect v-model="form.queueMode" @change="onModeChange">
          <el-option label="竖排" value="list" />
          <el-option label="横排" value="horizontal" />
        </ElSelect>
      </label>
    </div>

    <div class="toggle_row">
      <span>自动翻页</span>
      <ElSwitch v-model="form.queueFlow" />
    </div>
    <!-- 流动参数横向并排 -->
    <div class="field-row">
      <label class="field" :class="{ inactive: !form.queueFlow }">
        <span>流动速度（秒 / 屏）</span>
        <ElInputNumber v-model="form.queueFlowSpeed" :min="1" :max="15" :disabled="!form.queueFlow" />
      </label>
      <label class="field" :class="{ inactive: !form.queueFlow }">
        <span>底部停留（秒）</span>
        <ElInputNumber v-model="form.queueFlowPause" :min="0" :max="15" :disabled="!form.queueFlow" />
      </label>
    </div>
    <div v-if="form.queueFlow" class="flow_hint">
      {{ flowHint }}
    </div>

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
  /** 流动开关独立于排列方式 */
  queueFlow: boolean
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
  queueFlow: false,
  queueFlowSpeed: 3,
  queueFlowPause: 2,
})

function toMode(mode?: QueueMode): QueueMode {
  return mode === 'horizontal' ? 'horizontal' : 'list'
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
      queueFlow: !!o.queueFlow,
      queueFlowSpeed: o.queueFlowSpeed ?? 3,
      queueFlowPause: o.queueFlowPause ?? 2,
    }
  },
  { immediate: true, deep: true }
)

const origin = computed(() => (typeof window === 'undefined' ? '' : window.location.origin))
const chatUrl = computed(() => `${origin.value}/overlay/chat`)
const queueUrl = computed(() => `${origin.value}/overlay/queue`)

// 流动要点：显示条数决定一屏容量，超出部分才需要翻页
const flowHint = computed(() => {
  const perScreen = Math.max(1, Number(form.value.queueMax) || 1)
  return `一屏显示 ${perScreen} 条，超出的部分会逐屏下翻。`
})

function onModeChange(): void {
  // 改了设置还没保存时清掉上一条「已生效」提示，免得误解
  savedMsg.value = ''
}

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
      queueFlow: form.value.queueFlow ? 1 : 0,
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

// 新增：一行放多个 field，自动换行
.field-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--fs-13);
  color: var(--text-muted);

  &.inactive {
    opacity: 0.55;
  }
  // 给控件固定宽度，统一好看
  :deep(.el-input-number), :deep(.el-select) {
    width: 140px;
  }
}

.flow_hint {
  padding: 6px 10px;
  border-radius: var(--radius-sm, 8px);
  background: rgba(0, 0, 0, 0.03);
  font-size: var(--fs-13);
  color: var(--text-muted);
  line-height: 1.6;
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
