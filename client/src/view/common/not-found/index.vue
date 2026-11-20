<template>
  <div class="not_found">
    <el-result icon="warning" title="404" sub-title="页面不存在或已下线">
      <template #extra>
        <ElButton type="primary" @click="goHome">回管理台</ElButton>
      </template>
    </el-result>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import ElButton from '@/components/el/ElButton.vue'

defineOptions({ name: 'NotFound' })

const router = useRouter()

function goHome(): void {
  void router.push({ name: 'manageHome' })
}
</script>

<style scoped lang="scss">
.not_found {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
