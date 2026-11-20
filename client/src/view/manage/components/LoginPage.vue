<template>
  <div class="login_page">
    <header class="brand_bar">
      <span class="brand">弹幕台 <b>DanmuDeck</b></span>
      <button class="theme_btn" :title="theme === 'dark' ? '切换到亮色' : '切换到暗色'" @click="toggleTheme">
        <el-icon :size="18">
          <Sunny v-if="theme === 'dark'" />
          <Moon v-else />
        </el-icon>
      </button>
    </header>

    <main class="login_main">
      <div class="qr_box">
        <img v-if="state.qrDataUrl" :src="state.qrDataUrl" class="qr" alt="登录二维码" />
        <div v-else class="qr placeholder">{{ phaseText[state.phase] || state.phase }}</div>
      </div>

      <div class="info">
        <div class="title">{{ phaseText[state.phase] || state.phase }}</div>
        <p v-if="state.scanned" class="hint">已扫码，请在手机上点击「确认登录」</p>
        <p v-else-if="state.phase === 'waiting'" class="hint">
          打开 B 站 App → 扫一扫 → 扫码并确认
        </p>
        <p v-else-if="state.phase === 'generating'" class="hint">正在为你准备二维码…</p>
        <p v-if="state.error" class="hint error">{{ state.error }}</p>
        <ElButton
          v-if="state.phase === 'expired' || state.phase === 'error'"
          type="primary"
          plain
          @click="restart"
        >
          重新生成二维码
        </ElButton>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref as vueRef, watch } from 'vue'
import { Moon, Sunny } from '@element-plus/icons-vue'
import { fetchLoginStatus, restartLogin } from '@/api'
import { theme, toggleTheme } from '@/theme'
import ElButton from '@/components/el/ElButton.vue'
import type { LoginState } from '@/types/models'

defineOptions({ name: 'LoginPage' })

const props = withDefaults(
  defineProps<{
    login: LoginState | null
    poll?: boolean
  }>(),
  { poll: true }
)

const EMPTY_LOGIN: LoginState = {
  phase: 'idle',
  url: '',
  qrDataUrl: '',
  scanned: false,
  expired: false,
  error: '',
  uid: 0,
}

const fallback = vueRef<LoginState>({ ...EMPTY_LOGIN })
let timer: ReturnType<typeof setInterval> | null = null

// 父级没塞 login 时自行轮询，出现登录成功（logged_in 或父级切走）由父级二态切换接管
const state = computed<LoginState>(() => props.login ?? fallback.value)

const phaseText: Record<string, string> = {
  idle: '等待扫码登录',
  generating: '生成二维码中…',
  waiting: '请用 B 站 App「扫一扫」登录',
  scanned: '已扫码，请在手机上确认',
  logged_in: '登录成功',
  expired: '二维码已过期',
  error: '登录出错',
}

async function refresh(): Promise<void> {
  try {
    const { data } = await fetchLoginStatus()
    fallback.value = data
    if (data.phase === 'logged_in') stopPolling()
  } catch {
    /* backend not ready */
  }
}

function stopPolling(): void {
  if (timer) clearInterval(timer)
  timer = null
}

async function restart(): Promise<void> {
  try {
    await restartLogin()
  } catch {
    /* ignore */
  }
  void refresh()
}

watch(
  () => props.poll,
  (poll) => {
    if (!poll || props.login) {
      stopPolling()
      return
    }
    void refresh()
    if (!timer) timer = setInterval(() => void refresh(), 2000)
  },
  { immediate: true }
)

onBeforeUnmount(stopPolling)
</script>

<style scoped lang="scss">
.login_page {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--bg);
}

.brand_bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  flex-shrink: 0;
}

.brand {
  font-size: var(--fs-17);
  font-weight: 500;
  color: var(--text);

  b {
    color: var(--brand-purple);
    font-weight: 700;
  }
}

.theme_btn {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  box-shadow: var(--card-shadow);
}

.login_main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40px;
  padding: 24px;
  min-height: 0;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 24px;
  }
}

.qr_box {
  flex-shrink: 0;
}

.qr {
  width: 240px;
  height: 240px;
  display: block;
  border-radius: var(--radius-md, 12px);
  background: #fff;
  padding: 10px;
  box-shadow: var(--card-shadow);

  &.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    text-align: center;
    background: var(--bg-alt);
    border: 1.5px dashed var(--border);
    color: var(--text-muted);
    font-size: var(--fs-13);
  }
}

.info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 320px;

  .title {
    font-size: var(--fs-20);
    font-weight: 500;
    color: var(--text);
  }

  .hint {
    font-size: var(--fs-15);
    line-height: 1.6;
    color: var(--brand-blue);

    &.error {
      color: var(--brand-red);
    }
  }
}
</style>
