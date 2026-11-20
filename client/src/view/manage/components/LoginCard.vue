<template>
  <div class="login_card">
    <img v-if="login.qrDataUrl" :src="login.qrDataUrl" class="qr" alt="登录二维码" />
    <div v-else class="qr placeholder">{{ phaseText[login.phase] || login.phase }}</div>
    <div class="info">
      <div class="title">{{ phaseText[login.phase] || login.phase }}</div>
      <div v-if="login.scanned" class="hint">请打开 B 站 App 点击「确认登录」</div>
      <div v-else-if="login.phase === 'waiting'" class="hint">打开 B 站 App → 扫一扫 → 扫码并确认</div>
      <div v-if="login.error" class="hint error">{{ login.error }}</div>
      <div v-if="login.phase === 'expired' || login.phase === 'error'" class="actions">
        <ElButton type="primary" plain size="small" @click="restart">重新生成二维码</ElButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { fetchLoginStatus, restartLogin } from '@/api'
import ElButton from '@/components/el/ElButton.vue'
import type { LoginState } from '@/types/models'

defineOptions({ name: 'LoginCard' })

const emit = defineEmits<{ done: [] }>()

const login = ref<LoginState>({
  phase: 'idle',
  url: '',
  qrDataUrl: '',
  scanned: false,
  expired: false,
  error: '',
  uid: 0,
})

let timer: ReturnType<typeof setInterval> | null = null

const phaseText: Record<string, string> = {
  idle: '未开始',
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
    login.value = data
    if (login.value.phase === 'logged_in') {
      emit('done')
      stopPolling()
    }
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

onMounted(() => {
  void refresh()
  timer = setInterval(() => void refresh(), 2000)
})

onBeforeUnmount(stopPolling)
</script>

<style scoped lang="scss">
.login_card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 20px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.qr {
  width: 168px;
  height: 168px;
  border-radius: var(--radius-sm, 8px);
  background: #fff;
  padding: 6px;

  &.placeholder {
    background: var(--bg-alt);
    border: 1.5px dashed var(--border);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--fs-13);
  }
}

.info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title {
  font-size: var(--fs-17);
  color: var(--text);
  font-weight: 500;
}

.hint {
  font-size: var(--fs-13);
  color: var(--brand-blue);

  &.error {
    color: var(--brand-red);
  }
}

.actions {
  display: flex;
}
</style>
