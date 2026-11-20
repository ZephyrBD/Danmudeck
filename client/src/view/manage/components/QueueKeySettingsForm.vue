<template>
  <div class="keyword_form">
    <label class="field">
      <span>入队触发词</span>
      <ElInput v-model="form.queueEnterKey" :maxlength="20" placeholder="排队" />
    </label>
    <label class="field">
      <span>取消排队触发词</span>
      <ElInput v-model="form.queueLeaveKey" :maxlength="20" placeholder="取消排队" />
    </label>

    <ElButton type="success" class="save_btn" :loading="saving" @click="save">
      {{ saving ? '保存中…' : '保存设置' }}
    </ElButton>

    <div v-if="savedMsg" class="msg ok">{{ savedMsg }}</div>
    <div v-if="errMsg" class="msg err">{{ errMsg }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { saveSettings } from '@/api'
import ElButton from '@/components/el/ElButton.vue'
import ElInput from '@/components/el/ElInput.vue'
import type { ApiResult, SettingsData } from '@/types/models'

defineOptions({ name: 'QueueKeySettingsForm' })

const props = defineProps<{
  settings: SettingsData
}>()

const form = ref<{ queueEnterKey: string; queueLeaveKey: string }>({ queueEnterKey: '', queueLeaveKey: '' })

watch(
  () => props.settings,
  (s) => {
    form.value = {
      queueEnterKey: s.queueEnterKey ?? '',
      queueLeaveKey: s.queueLeaveKey ?? '',
    }
  },
  { immediate: true, deep: true }
)

const saving = ref(false)
const savedMsg = ref('')
const errMsg = ref('')

function validate(): string {
  if (!form.value.queueEnterKey.trim()) return '入队触发词不能为空哦'
  if (!form.value.queueLeaveKey.trim()) return '取消排队触发词不能为空哦'
  if (form.value.queueEnterKey.trim() === form.value.queueLeaveKey.trim()) {
    return '两个触发词不能一样哦'
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
      roomId: props.settings.roomId ?? null,
      queueEnterKey: form.value.queueEnterKey,
      queueLeaveKey: form.value.queueLeaveKey,
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
.keyword_form {
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
</style>
