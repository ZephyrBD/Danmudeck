<template>
  <EpSwitch class="el_switch" v-bind="$attrs" />
</template>

<script setup lang="ts">
// Element Plus wrapper（docs/frontend/03 §5）
import { ElSwitch as EpSwitch } from 'element-plus'

defineOptions({ name: 'EpSwitch', inheritAttrs: false })
</script>
