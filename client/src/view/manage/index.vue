<template>
  <div class="app">
    <template v-if="!booted">
      <div class="booting" />
    </template>

    <LoginPage v-else-if="status.loginRequired" :login="null" />
    <template v-else>
      <StatusBar
        :status="status"
        :queue-count="queue.length"
        @help="helpOpen = true"
        @logout="onLogout"
      />
      <div class="widgets">
        <aside class="col settings_col">
          <SettingsGrid :settings="settings" :status="status" :overlay="overlay" />
        </aside>
        <aside class="col queue_col">
          <QueueWidget
            :queue="queue"
            :enter-key="settings.queueEnterKey || '排队'"
            @complete="complete"
            @clear-done="clearDone"
            @reset="reset"
            @move="moveQueue"
            @save="saveQueueFile"
            @load="pickQueueFile"
          />
        </aside>
        <main class="col danmaku_col">
          <DanmakuList :items="feed" @clear="clearFeed" />
        </main>
      </div>
      <footer class="footbar">
        <span>DanmuDeck {{ commit }} · Licensed under MIT, 2018~{{ NOW_YEAR }} Modding Craft ZBD Studio</span>
      </footer>
    </template>

    <HelpDialog v-model="helpOpen" />
    <QueueImportDialog
      v-model="importOpen"
      :rows="importPreview.rows"
      :stats="importPreview.stats"
      :ignored="importIgnored"
      @imported="onImported"
    />
    <input
      ref="fileInput"
      class="file_input"
      type="file"
      accept="application/json,.json"
      @change="onFilePicked"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import StatusBar from '@/view/manage/components/StatusBar.vue'
import LoginPage from '@/view/manage/components/LoginPage.vue'
import SettingsGrid from '@/view/manage/components/SettingsGrid.vue'
import QueueWidget from '@/view/manage/components/QueueWidget.vue'
import QueueImportDialog from '@/view/manage/components/QueueImportDialog.vue'
import HelpDialog from '@/view/manage/components/HelpDialog.vue'
import DanmakuList from '@/view/manage/components/DanmakuList.vue'
import { clearDoneQueue, completeQueue, logout, moveQueueApi, resetQueue } from '@/api'
import {
  status,
  booted,
  settings,
  overlay,
  queue,
  feed,
  clearFeed,
  initManageStore,
  unsubscribers,
} from '@/store/manage'
import {
  buildExportFile,
  mergePreview,
  parseQueueFile,
  queueFileName,
  type MergePreview,
} from '@/view/manage/composables/queueFile'
import type { QueueItem } from '@/types/models'

defineOptions({ name: 'ManageHome' })

const commit = __GIT_COMMIT__
const NOW_YEAR = new Date().getFullYear()

const helpOpen = ref(false)
const importOpen = ref(false)
const importIgnored = ref(0)
const importPreview = ref<MergePreview>({ rows: [], stats: { added: 0, replaced: 0, kept: 0, local: 0 } })
const fileInput = ref<HTMLInputElement | null>(null)

async function post(action: () => Promise<unknown>): Promise<void> {
  try {
    await action()
  } catch {
    /* ignore */
  }
}

function complete(uid: number): void {
  void post(() => completeQueue(uid))
}

function reset(): void {
  void post(() => resetQueue())
}

function clearDone(): void {
  void post(() => clearDoneQueue())
}

function moveQueue(payload: { uid: number; toIndex: number }): void {
  void post(() => moveQueueApi(payload.uid, payload.toIndex))
}

// 队列导出：全量下载 JSON（plan §7）
function saveQueueFile(): void {
  if (!queue.value.length) {
    ElMessage.info('队列是空的，没有可保存的内容')
    return
  }
  const text = JSON.stringify(buildExportFile(queue.value), null, 2)
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = queueFileName()
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  ElMessage.success(`已导出 ${queue.value.length} 条队列记录`)
}

function pickQueueFile(): void {
  fileInput.value?.click()
}

// 队列导入：解析 → 合并预览（plan §8）
async function onFilePicked(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  let text = ''
  try {
    text = await file.text()
  } catch {
    ElMessage.error('读取文件失败，再试一次吧')
    return
  }
  const parsed = parseQueueFile(text)
  if (!parsed.ok) {
    ElMessage.error(parsed.error || '这不是 DanmuDeck 的队列文件')
    return
  }
  if (!parsed.items.length) {
    ElMessage.warning('文件里没有可导入的条目')
    return
  }
  importIgnored.value = parsed.ignored
  importPreview.value = mergePreview(queue.value, parsed.items)
  importOpen.value = true
}

function onImported(list: QueueItem[]): void {
  if (list.length) queue.value = list
  ElMessage.success(`已导入 ${list.length} 条队列记录`)
}

// 退出登录：清认证 → 后端重新生成二维码 → 回到全屏扫码页（plan D24）
async function onLogout(): Promise<void> {
  try {
    await ElMessageBox.confirm('退出后需要重新扫码登录，确定退出吗？', '退出登录', {
      type: 'warning',
      confirmButtonText: '退出',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await logout()
    clearFeed()
    status.loginRequired = true
    ElMessage.success('已退出登录，请重新扫码')
  } catch {
    ElMessage.error('退出失败，再试一次吧')
  }
}

onMounted(() => {
  void initManageStore()
})

onBeforeUnmount(() => {
  for (const off of unsubscribers) off()
  unsubscribers.length = 0
})
</script>

<style scoped lang="scss">
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--bg);
}

.booting {
  flex: 1;
}

.file_input {
  display: none;
}

.footbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border-top: 1px solid var(--border);
  background: var(--bg-alt);
  font-size: var(--fs-13);
  color: var(--text-muted);
}

/* 三等分三列：每列独立滚动（plan §3.2） */
.widgets {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24px;
  min-height: 0;
  padding: 24px 32px;
  overflow: hidden;
}

.col {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

.settings_col,
.queue_col {
  padding: 24px;
  border-radius: var(--radius-md, 12px);
}

.settings_col {
  background: rgba(162, 89, 255, 0.1);
}

.queue_col {
  background: rgba(10, 207, 131, 0.1);
}

.danmaku_col {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-md, 12px);
  background: rgba(26, 188, 254, 0.1);
}

@media (max-width: 768px) {
  .widgets {
    display: flex;
    flex-direction: column;
    padding: 16px;
    gap: 16px;
    overflow-y: auto;
  }

  .col {
    overflow: visible;
  }

  .danmaku_col {
    min-height: 320px;
  }
}
</style>
