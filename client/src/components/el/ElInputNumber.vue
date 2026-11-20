<template>
  <EpInputNumber class="el_input_number" v-bind="$attrs" />
</template>

<script setup lang="ts">
// Element Plus wrapper（docs/frontend/03 §5）
import { ElInputNumber as EpInputNumber } from 'element-plus'

defineOptions({ name: 'EpInputNumber', inheritAttrs: false })
</script>

<style scoped lang="scss">
.el_input_number {
  :deep(.el-input__wrapper) {
    border-radius: var(--radius-sm, 8px);
  }
}
</style>
