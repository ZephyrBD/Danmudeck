<template>
  <div
    class="q_item"
    :class="{ done: item.done, dragging: dragging, dragover: dragover }"
    draggable="true"
    @dragstart="onDragStart"
    @dragover="onDragOver"
    @drop="onDrop"
    @dragend="$emit('dragend')"
    @dragleave="$emit('dragleave')"
  >
    <span class="pos" :class="{ top: item.position <= 3 && !item.done, skipped: giftSkipped && !item.done }">{{ item.position }}</span>
    <div class="meta">
      <div class="name_line">
        <span class="user" :style="item.color ? { color: item.color } : {}">{{ item.user }}</span>
        <span v-if="giftSkipped && !item.done" class="skip_tag" :title="moveTitle">礼物插队</span>
        <span v-if="adminMoved && !item.done" class="admin_tag" :title="moveTitle">手动调整</span>
        <span v-if="item.done" class="done_tag">已完成</span>
      </div>
      <div class="uid">
        <span class="joined">入队 {{ formatTime(item.joinedAt) }}</span>
        <span v-if="item.done" class="waited"> · 已完成 {{ formatTime(item.completedAt || item.joinedAt) }}</span>
        <span v-else class="waited"> · 已排队 {{ waited }}</span>
      </div>
    </div>
    <div class="row_actions">
      <button
        v-if="!item.done"
        class="icon_btn"
        :disabled="item.position === 1"
        title="置顶（插队到第 1 位）"
        aria-label="置顶"
        @click="$emit('pin')"
      >
        <el-icon :size="15"><Top /></el-icon>
      </button>
      <button
        v-if="!item.done"
        class="icon_btn done_btn"
        title="完成委托，标记为已完成"
        aria-label="完成"
        @click="$emit('complete')"
      >
        <el-icon :size="15"><CircleCheck /></el-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { CircleCheck, Top } from '@element-plus/icons-vue'
import { formatDuration, formatTime } from '@/view/manage/composables/formatTime'
import type { QueueItem } from '@/types/models'

defineOptions({ name: 'QueueRow' })

const props = defineProps<{
  item: QueueItem
  index: number
  dragging: boolean
  dragover: boolean
}>()

/** 是否被礼物插队过（决定置灰与标签） */
const giftSkipped = computed(() => (props.item.moves ?? []).some((m) => m.by === 'gift'))
/** 是否被管理员手动调整过 */
const adminMoved = computed(() => (props.item.moves ?? []).some((m) => m.by === 'admin'))

/** 悬停提示：最近一条位置变动 */
const moveTitle = computed(() => {
  const moves = props.item.moves ?? []
  const last = moves[moves.length - 1]
  if (!last) return ''
  const who = last.by === 'gift' ? `礼物插队${last.gift ? `（${last.gift}）` : ''}` : '管理员手动调整'
  return `${who}：第 ${last.from} 位 → 第 ${last.to} 位（共 ${moves.length} 次变动）`
})

// 排队时长每分钟刷新一次（plan D25）
const waited = ref(formatDuration(Date.now() - props.item.joinedAt))
const timer = setInterval(() => {
  if (props.item.done) return
  waited.value = formatDuration(Date.now() - props.item.joinedAt)
}, 60000)
onBeforeUnmount(() => clearInterval(timer))
const emit = defineEmits<{
  complete: []
  pin: []
  dragstart: [event: DragEvent]
  dragover: [event: DragEvent, index: number]
  drop: [event: DragEvent, index: number]
  dragend: []
  dragleave: []
}>()

function onDragStart(e: DragEvent): void {
  emit('dragstart', e)
}

function onDragOver(e: DragEvent): void {
  emit('dragover', e, props.index)
}

function onDrop(e: DragEvent): void {
  emit('drop', e, props.index)
}
</script>

<style scoped lang="scss">
.q_item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 8px);
  cursor: grab;
  user-select: none;
  transition: box-shadow 0.15s ease;

  &:hover {
    box-shadow: var(--card-shadow);
  }

  &:active {
    cursor: grabbing;
  }

  &.dragging {
    opacity: 0.4;
  }

  &.dragover {
    border-color: var(--brand-green);
    box-shadow: 0 0 0 1px rgba(10, 207, 131, 0.6);
  }

  &.done {
    opacity: 0.55;
    cursor: default;
  }
}

.pos {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(10, 207, 131, 0.1);
  color: var(--text-muted);
  font-size: var(--fs-13);
  font-weight: 500;

  &.top {
    background: var(--brand-green);
    color: #fff;
  }

  &.skipped {
    background: var(--brand-purple);
    color: #fff;
  }
}

.meta {
  flex: 1;
  min-width: 0;

  .name_line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .user {
    min-width: 0;
    font-size: var(--fs-13);
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .uid {
    font-size: var(--fs-13);
    color: var(--text-muted);
  }
}

.row_actions {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}

.icon_btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-muted);
  cursor: pointer;
  transition: box-shadow 0.15s ease, color 0.15s ease, border-color 0.15s ease;

  &:hover:not(:disabled) {
    box-shadow: var(--card-shadow);
    border-color: var(--brand-purple);
    color: var(--brand-purple);
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  &.done_btn:hover:not(:disabled) {
    border-color: var(--brand-green);
    color: var(--brand-green);
  }
}

/* 标签钉在昵称右侧，不随昵称长度漂移 */
.skip_tag,
.admin_tag,
.done_tag {  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: var(--radius-sm, 8px);
  font-size: var(--fs-13);
  line-height: 1.5;
  white-space: nowrap;
}

.skip_tag {
  background: rgba(162, 89, 255, 0.1);
  color: var(--brand-purple);
}

.admin_tag {
  background: rgba(26, 188, 254, 0.1);
  color: var(--brand-blue);
}

.done_tag {
  background: rgba(242, 78, 30, 0.1);
  color: var(--brand-orange);
}
</style>
