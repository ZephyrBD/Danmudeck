<template>
  <div class="room_form">
    <label class="field">
      <span>直播间房间号（默认值：当前用户直播间）</span>
      <ElInput v-model.number="form.roomId" type="number" :min="1" placeholder="留空自动获取" />
    </label>

    <div class="conn_row">
      <span class="conn_label">连接状态</span>
      <span class="conn_value">{{ status.statusText }}</span>
    </div>

    <div class="btn_row">
      <ElButton type="primary" class="save_btn" :loading="saving" @click="save">
        {{ saving ? '保存中…' : '保存设置' }}
      </ElButton>
      <ElButton type="primary" plain @click="restartLogin">重新扫码</ElButton>
    </div>

    <div v-if="savedMsg" class="msg ok">{{ savedMsg }}</div>
    <div v-if="errMsg" class="msg err">{{ errMsg }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { saveSettings, restartLogin } from '@/api'
import ElButton from '@/components/el/ElButton.vue'
import ElInput from '@/components/el/ElInput.vue'
import type { ApiResult, SettingsData, StatusData } from '@/types/models'

defineOptions({ name: 'RoomSettingsForm' })

const props = defineProps<{
  settings: SettingsData
  status: StatusData
}>()

const form = ref<{ roomId: number | '' }>({ roomId: '' })

watch(
  () => props.settings,
  (s) => {
    form.value = { roomId: s.roomId ?? '' }
  },
  { immediate: true, deep: true }
)

const saving = ref(false)
const savedMsg = ref('')
const errMsg = ref('')

function validate(): string {
  if (form.value.roomId !== '' && (Number(form.value.roomId) < 1 || Number.isNaN(Number(form.value.roomId)))) {
    return '房间号得是大于 0 的整数哦'
  }
  return ''
}

async function save(): Promise<void> {
  const invalid = validate()
  if (invalid) {
    errMsg.value = invalid
    return
  }
  saving.value = true
  errMsg.value = ''
  savedMsg.value = ''
  try {
    const { data } = await saveSettings({
      roomId: form.value.roomId === '' || form.value.roomId === null ? null : Number(form.value.roomId),
      queueEnterKey: props.settings.queueEnterKey || '排队',
      queueLeaveKey: props.settings.queueLeaveKey || '取消排队',
    })
    const result = data as ApiResult
    if (!result.ok) {
      errMsg.value = result.error || '保存失败，再试一次吧'
    } else {
      savedMsg.value = '保存好啦，已经生效'
      setTimeout(() => (savedMsg.value = ''), 2000)
    }
  } catch (e) {
    errMsg.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.room_form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--fs-13);
  color: var(--text-muted);
}

.conn_row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--fs-13);

  .conn_label {
    color: var(--text-muted);
  }

  .conn_value {
    color: var(--brand-blue);
  }
}

.btn_row {
  display: flex;
  gap: 8px;
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
</style>
