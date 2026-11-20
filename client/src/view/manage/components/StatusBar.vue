<template>
  <header class="status_bar">
    <div class="left">
      <span class="brand">弹幕台 <b>DanmuDeck</b></span>
      <span class="dot" :class="statusClass[status.status] || 'off'" :title="status.statusText" />
      <span class="label">{{ status.statusText }}</span>
      <span v-if="status.status === 'connecting'" class="dots">{{ '.'.repeat(dots + 1) }}</span>
      <span class="nick" :title="status.uname || '未登录'">{{ status.uname || '未登录' }}</span>
      <span class="room">房间：{{ status.roomId ?? '自动' }}</span>
      <el-tag
        v-if="status.liveStatus !== undefined"
        :type="status.liveStatus === 1 ? 'success' : 'warning'"
        effect="light"
        round
      >
        {{ liveStatusMap[status.liveStatus] }}
      </el-tag>
      <span class="counts">弹幕 {{ status.counters?.danmu ?? 0 }} ｜ SC {{ status.counters?.superchat ?? 0 }}</span>
    </div>

    <div class="right">
      <button class="icon_btn" :title="theme === 'dark' ? '切换到亮色' : '切换到暗色'" @click="toggleTheme">
        <el-icon :size="18">
          <Sunny v-if="theme === 'dark'" />
          <Moon v-else />
        </el-icon>
      </button>
      <button class="icon_btn" title="使用帮助" @click="emit('help')">
        <el-icon :size="18"><QuestionFilled /></el-icon>
      </button>
      <button class="icon_btn danger" title="退出登录" @click="emit('logout')">
        <el-icon :size="18"><SwitchButton /></el-icon>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Moon, QuestionFilled, Sunny, SwitchButton } from '@element-plus/icons-vue'
import { theme, toggleTheme } from '@/theme'
import type { StatusData } from '@/types/models'

defineOptions({ name: 'StatusBar' })

const props = defineProps<{
  status: StatusData
}>()

const emit = defineEmits<{
  help: []
  logout: []
}>()

const dots = ref(0)
const timer = setInterval(() => {
  if (props.status.status === 'connecting') dots.value = (dots.value + 1) % 4
}, 400)
onBeforeUnmount(() => clearInterval(timer))

const statusClass: Record<string, string> = {
  connected: 'ok',
  connecting: 'busy',
  disconnected: 'warn',
  room_not_found: 'warn',
  risk_control: 'warn',
  error: 'warn',
  idle: 'off',
}

const liveStatusMap: Record<number, string> = {
  0: '未开播',
  1: '直播中',
  2: '轮播/回放',
}
</script>

<style scoped lang="scss">
.status_bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  font-size: var(--fs-15);
  color: var(--text);
  flex-shrink: 0;
}

.left,
.right {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.left {
  flex-wrap: wrap;
}

.right {
  flex-shrink: 0;
}

.brand {
  padding-right: 14px;
  border-right: 1px solid var(--border);
  flex-shrink: 0;
  font-weight: 500;

  b {
    color: var(--brand-purple);
    font-weight: 700;
  }
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;

  &.ok {
    background: var(--brand-green);
    box-shadow: 0 0 6px var(--brand-green);
  }

  &.busy {
    background: var(--brand-orange);
    box-shadow: 0 0 6px var(--brand-orange);
  }

  &.warn {
    background: var(--brand-red);
    box-shadow: 0 0 6px var(--brand-red);
  }

  &.off {
    background: var(--text-muted);
  }
}

.dots {
  color: var(--brand-orange);
  font-weight: 700;
}

.nick {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-weight: 500;
}

.room {
  color: var(--brand-blue);
}

.counts {
  color: var(--text-muted);
  font-size: var(--fs-13);
}

.icon_btn {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  transition: box-shadow 0.15s ease;

  &:hover {
    box-shadow: var(--card-shadow);
  }

  &.danger:hover {
    border-color: var(--brand-red);
    color: var(--brand-red);
  }
}
</style>
