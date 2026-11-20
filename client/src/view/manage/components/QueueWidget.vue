<template>
  <div class="queue_widget">
    <div class="head">
      <div class="title">队列</div>
      <span class="counter" :title="`已完成 ${doneCount} 人，共 ${queue.length} 人`">{{ doneCount }}/{{ queue.length }}</span>
      <div class="actions">
        <button class="icon_btn" title="保存队列（导出 JSON）" :disabled="!queue.length" @click="emit('save')">
          <el-icon :size="16"><Upload /></el-icon>
        </button>
        <button class="icon_btn" title="加载队列（导入 JSON）" @click="emit('load')">
          <el-icon :size="16"><Download /></el-icon>
        </button>
        <button
          class="icon_btn"
          :title="`清除已完成（${doneCount}）`"
          :disabled="!doneCount"
          @click="confirmThen(`确定清除 ${doneCount} 条已完成记录吗？`, 'clearDone')"
        >
          <el-icon :size="16"><Brush /></el-icon>
        </button>
        <button
          class="icon_btn danger"
          :title="`清空全部（${queue.length}）`"
          :disabled="!queue.length"
          @click="confirmThen(`确定清空整个队列（${queue.length} 人）吗？不可撤销。`, 'reset')"
        >
          <el-icon :size="16"><Delete /></el-icon>
        </button>
      </div>
    </div>
    <div class="queue_body">
      <div class="queue_section active_section">
        <div class="section_head">
          <span class="section_title">排队中</span>
          <span class="section_count">{{ activeQueue.length }}</span>
        </div>
        <div class="queue_list">
          <div v-if="!activeQueue.length" class="empty">
            暂无排队，观众发「{{ enterKey || '排队' }}」入队
          </div>
          <QueueRow
            v-for="(item, index) in activeQueue"
            :key="`a-${item.uid}-${item.joinedAt}`"
            :item="item"
            :index="index"
            :dragging="dragUid === item.uid"
            :dragover="dragOverIndex === index"
            @dragstart="onDragStart($event, item)"
            @dragover="onDragOver($event, index)"
            @drop="onDrop($event, index)"
            @dragend="onDragEnd"
            @dragleave="dragOverIndex === index && (dragOverIndex = -1)"
            @complete="$emit('complete', item.uid)"
            @pin="pin(item)"
          />
        </div>
      </div>
      <div class="queue_section done_section">
        <div class="section_head">
          <span class="section_title">已完成</span>
          <span class="section_count">{{ doneQueue.length }}</span>
        </div>
        <div class="queue_list">
          <div v-if="!doneQueue.length" class="empty">还没有完成的委托</div>
          <QueueRow
            v-for="item in doneQueue"
            :key="`d-${item.uid}-${item.completedAt ?? item.joinedAt}`"
            :item="item"
            :index="item.position - 1"
            :dragging="false"
            :dragover="false"
            @complete="$emit('complete', item.uid)"
            @pin="pin(item)"
          />
        </div>
      </div>
    </div>
    <div class="hint">拖拽行可以调整顺序哦</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Brush, Delete, Download, Upload } from '@element-plus/icons-vue'
import QueueRow from '@/view/manage/components/QueueRow.vue'
import type { QueueItem } from '@/types/models'

defineOptions({ name: 'QueueWidget' })

const props = defineProps<{
  queue: QueueItem[]
  enterKey?: string
}>()

const emit = defineEmits<{
  complete: [uid: number]
  clearDone: []
  reset: []
  move: [payload: { uid: number; toIndex: number }]
  save: []
  load: []
}>()

const doneCount = computed(() => props.queue.filter((i) => i.done).length)

/** 上区：排队中，保持队列顺序 */
const activeQueue = computed(() => props.queue.filter((i) => !i.done))

/** 下区：已完成，按完成时间倒序（最新完成的在最上面） */
const doneQueue = computed(() =>
  props.queue
    .filter((i) => i.done)
    .slice()
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
)

// 破坏性操作先确认（plan L6）
async function confirmThen(message: string, action: 'clearDone' | 'reset'): Promise<void> {
  try {
    await ElMessageBox.confirm(message, '请确认', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  if (action === 'reset') emit('reset')
  else emit('clearDone')
}

const dragUid = ref<number | null>(null)
const dragOverIndex = ref(-1)

function onDragStart(e: DragEvent, item: QueueItem): void {
  dragUid.value = item.uid
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', String(item.uid))
}

function onDragOver(e: DragEvent, index: number): void {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}

function onDrop(e: DragEvent, index: number): void {
  e.preventDefault()
  const uid = dragUid.value ?? Number(e.dataTransfer?.getData('text/plain'))
  dragOverIndex.value = -1
  dragUid.value = null
  if (!uid || index < 0 || index >= props.queue.length) return
  if (props.queue[index].uid === uid) return
  emit('move', { uid, toIndex: index })
}

function onDragEnd(): void {
  dragUid.value = null
  dragOverIndex.value = -1
}

function pin(item: QueueItem): void {
  if (item.position === 1) return
  emit('move', { uid: item.uid, toIndex: 0 })
}
</script>

<style scoped lang="scss">
.queue_widget {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;

  .title {
    font-size: var(--fs-17);
    color: var(--text);
    font-weight: 500;
  }

  .counter {
    padding: 1px 8px;
    border-radius: 999px;
    background: rgba(10, 207, 131, 0.15);
    color: var(--brand-green);
    font-size: var(--fs-13);
    font-weight: 500;
  }

  .actions {
    margin-left: auto;
    display: flex;
    gap: 4px;
  }
}

.icon_btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;

  &:hover:not(:disabled) {
    box-shadow: var(--card-shadow);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.danger:hover:not(:disabled) {
    border-color: var(--brand-red);
    color: var(--brand-red);
  }
}

.queue_body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 上区排队中占 3/4，下区已完成占 1/4；下区为空也保留占位 */
.queue_section {
  display: flex;
  flex-direction: column;
  min-height: 0;

  &.active_section {
    flex: 3 1 0;
  }

  &.done_section {
    flex: 1 1 0;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed var(--border);
  }
}

.section_head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  flex-shrink: 0;

  .section_title {
    font-size: var(--fs-13);
    color: var(--text-muted);
    font-weight: 500;
  }

  .section_count {
    padding: 0 6px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.04);
    color: var(--text-muted);
    font-size: var(--fs-13);
  }
}

.queue_list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.empty {
  color: var(--text-muted);
  font-size: var(--fs-13);
  padding: 12px 0;
  text-align: center;
}

.hint {
  margin-top: 8px;
  color: var(--text-muted);
  font-size: var(--fs-13);
  text-align: center;
}
</style>
