<template>
  <div style="display: none;" />
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { setupMessage } from '@/utils/message'

const message = useMessage()
setupMessage(message)
</script>
