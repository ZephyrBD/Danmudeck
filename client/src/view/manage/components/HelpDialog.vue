<template>
  <el-dialog
    :model-value="modelValue"
    title="使用帮助"
    width="720px"
    top="6vh"
    class="help_dialog"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <div class="help_body">
      <div class="links">
        <code class="link">{{ chatUrl }}</code>
        <ElButton size="small" plain @click="copy(chatUrl)">复制</ElButton>
        <code class="link">{{ queueUrl }}</code>
        <ElButton size="small" plain @click="copy(queueUrl)">复制</ElButton>
      </div>
      <div class="markdown" v-html="html" />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import ElButton from '@/components/el/ElButton.vue'
import { renderHelp } from '@/view/manage/composables/helpDoc'

defineOptions({ name: 'HelpDialog' })

defineProps<{ modelValue: boolean }>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const origin = typeof window === 'undefined' ? '' : window.location.origin
const chatUrl = `${origin}/overlay/chat`
const queueUrl = `${origin}/overlay/queue`

const html = computed(() => renderHelp({ chatUrl, queueUrl }))

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('地址已复制')
  } catch {
    ElMessage.warning('复制失败，请手动选中地址复制')
  }
}
</script>

<style scoped lang="scss">
.help_body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 70vh;
  overflow-y: auto;
}

.links {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border-radius: var(--radius-sm, 8px);
  background: var(--bg-alt);
  font-size: var(--fs-13);
}

.link_label {
  color: var(--text-muted);
}

.link {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  color: var(--brand-blue);
}

.markdown {
  font-size: var(--fs-15);
  line-height: 1.7;
  color: var(--text);

  :deep(h1) {
    font-size: var(--fs-20);
    margin: 4px 0 12px;
  }

  :deep(h2) {
    font-size: var(--fs-17);
    margin: 20px 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border);
  }

  :deep(h3) {
    font-size: var(--fs-15);
    margin: 16px 0 8px;
  }

  :deep(p) {
    margin: 8px 0;
  }

  :deep(ol),
  :deep(ul) {
    padding-left: 22px;
    margin: 8px 0;
  }

  :deep(code) {
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--bg-alt);
    color: var(--brand-purple);
    font-size: var(--fs-13);
  }

  :deep(pre) {
    padding: 10px 12px;
    border-radius: var(--radius-sm, 8px);
    background: var(--bg-alt);
    overflow-x: auto;

    code {
      background: none;
      color: var(--text);
      padding: 0;
    }
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--fs-13);
    margin: 10px 0;
  }

  :deep(th),
  :deep(td) {
    border: 1px solid var(--border);
    padding: 6px 10px;
    text-align: left;
  }

  :deep(th) {
    background: var(--bg-alt);
  }

  :deep(img) {
    max-width: 100%;
    border-radius: var(--radius-sm, 8px);
    border: 1px solid var(--border);
  }

  :deep(blockquote) {
    margin: 10px 0;
    padding: 6px 12px;
    border-left: 3px solid var(--brand-purple);
    background: rgba(162, 89, 255, 0.08);
    color: var(--text-muted);
  }
}
</style>
