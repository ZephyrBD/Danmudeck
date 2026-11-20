<template>
  <el-dialog
    :model-value="modelValue"
    title="导入队列预览"
    width="560px"
    class="queue_import_dialog"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <div v-if="rows.length" class="body">
      <div class="stats">
        <span class="stat added">新增 {{ stats.added }}</span>
        <span class="stat replaced">替换 {{ stats.replaced }}</span>
        <span class="stat kept">保留 {{ stats.kept }}</span>
        <span class="stat ignored">忽略 {{ ignored }}</span>
      </div>
      <p class="tip">取消勾选可排除条目；拖拽行可调整最终顺序。确认后会整体替换当前队列。</p>

      <div class="rows">
        <div
          v-for="(row, index) in rows"
          :key="row.uid"
          class="row"
          :class="{ unchecked: !row.checked, dragging: dragIndex === index, dragover: dragOver === index }"
          draggable="true"
          @dragstart="onDragStart($event, index)"
          @dragover="onDragOver($event, index)"
          @drop="onDrop($event, index)"
          @dragend="resetDrag"
        >
          <input v-model="row.checked" type="checkbox" class="check" :aria-label="row.item.user" />
          <span class="kind" :class="row.kind">{{ kindText[row.kind] }}</span>
          <span class="user" :style="row.item.color ? { color: row.item.color } : {}">{{ row.item.user }}</span>
          <span class="meta">
            入队 {{ formatTime(row.item.joinedAt) }}
            <template v-if="row.item.done"> · 已完成</template>
          </span>
          <span class="handle" title="拖拽排序">⠿</span>
        </div>
      </div>
    </div>
    <div v-else class="empty">文件里没有可导入的条目</div>

    <div v-if="error" class="msg err">{{ error }}</div>

    <template #footer>
      <ElButton @click="emit('update:modelValue', false)">取消</ElButton>
      <ElButton type="primary" :disabled="!rows.length || importing" :loading="importing" @click="confirm">
        导入 {{ checkedCount }} 条
      </ElButton>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { importQueue } from '@/api'
import ElButton from '@/components/el/ElButton.vue'
import { formatTime } from '@/view/manage/composables/formatTime'
import {
  buildImportItems,
  moveRow,
  type MergeRow,
  type MergeStats,
} from '@/view/manage/composables/queueFile'
import type { ApiResult, QueueItem } from '@/types/models'

defineOptions({ name: 'QueueImportDialog' })

const props = defineProps<{
  modelValue: boolean
  rows: MergeRow[]
  stats: MergeStats
  ignored: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  imported: [queue: QueueItem[]]
}>()

const kindText: Record<MergeRow['kind'], string> = {
  keep: '保留',
  new: '新增',
  replace: '替换',
  append: '追加',
}

// 本地副本：勾选与拖拽只改预览副本，关闭即丢弃
const rows = ref<MergeRow[]>([])
watch(
  () => [props.modelValue, props.rows] as const,
  ([open, source]) => {
    if (open) rows.value = source.map((r) => ({ ...r, checked: r.checked }))
  },
  { immediate: true }
)

const checkedCount = computed(() => rows.value.filter((r) => r.checked).length)

const dragIndex = ref(-1)
const dragOver = ref(-1)

function onDragStart(e: DragEvent, index: number): void {
  dragIndex.value = index
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', String(index))
}

function onDragOver(e: DragEvent, index: number): void {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOver.value = index
}

function onDrop(e: DragEvent, index: number): void {
  e.preventDefault()
  const from = dragIndex.value >= 0 ? dragIndex.value : Number(e.dataTransfer?.getData('text/plain'))
  resetDrag()
  rows.value = moveRow(rows.value, from, index)
}

function resetDrag(): void {
  dragIndex.value = -1
  dragOver.value = -1
}

const importing = ref(false)
const error = ref('')

async function confirm(): Promise<void> {
  error.value = ''
  if (!checkedCount.value) {
    error.value = '至少勾选一条才能导入'
    return
  }
  importing.value = true
  try {
    const { data } = await importQueue(buildImportItems(rows.value))
    const result = data as ApiResult<{ queue?: QueueItem[] }>
    if (!result.ok) {
      error.value = result.error || '导入失败，再试一次吧'
      return
    }
    emit('imported', result.queue ?? [])
    emit('update:modelValue', false)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '导入失败'
  } finally {
    importing.value = false
  }
}
</script>

<style scoped lang="scss">
.body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stat {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: var(--fs-13);
  background: var(--bg-alt);
  color: var(--text-muted);

  &.added {
    background: rgba(10, 207, 131, 0.15);
    color: var(--brand-green);
  }

  &.replaced {
    background: rgba(26, 188, 254, 0.15);
    color: var(--brand-blue);
  }

  &.ignored {
    background: rgba(255, 114, 98, 0.15);
    color: var(--brand-red);
  }
}

.tip {
  font-size: var(--fs-13);
  color: var(--text-muted);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 360px;
  overflow-y: auto;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 8px);
  background: var(--bg);

  &.dragging {
    opacity: 0.4;
  }

  &.dragover {
    border-color: var(--brand-green);
  }

  &.unchecked {
    opacity: 0.5;
  }
}

.kind {
  flex-shrink: 0;
  font-size: var(--fs-13);
  color: var(--text-muted);

  &.append {
    color: var(--brand-green);
  }
  &.replace {
    color: var(--brand-blue);
  }
}

.user {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-13);
}

.meta {
  flex-shrink: 0;
  font-size: var(--fs-13);
  color: var(--text-muted);
}

.handle {
  cursor: grab;
  color: var(--text-muted);
}

.empty {
  color: var(--text-muted);
  font-size: var(--fs-13);
}

.msg.err {
  margin-top: 8px;
  color: var(--brand-red);
  font-size: var(--fs-13);
}
</style>
