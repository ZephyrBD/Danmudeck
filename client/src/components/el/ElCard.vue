<template>
  <EpCard class="el_card" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name] :key="name">
      <slot :name="name" />
    </template>
  </EpCard>
</template>

<script setup lang="ts">
// Element Plus wrapper：白底 + 1px 边 + hover 软阴影（docs/frontend/07 §4）
import { ElCard as EpCard } from 'element-plus'

defineOptions({ name: 'EpCard', inheritAttrs: false })
</script>

<style scoped lang="scss">
.el_card {
  border-radius: var(--radius-md, 12px);
  transition: box-shadow 0.15s ease;

  &:hover {
    box-shadow: var(--card-shadow);
  }
}
</style>
