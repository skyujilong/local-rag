<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    title="未保存的更改"
    :style="{ width: '480px' }"
    :mask-closable="false"
    :closable="false"
    :bordered="false"
  >
    <div class="unsaved-warning-content">
      <n-icon class="warning-icon" :size="48" :component="WarningOutline" />

      <p class="warning-message">
        您有未保存的更改，如果离开页面这些更改将会丢失。
      </p>
      <div class="warning-actions">
        <n-button @click="handleCancel">
          留在页面
        </n-button>
        <n-button type="warning" @click="handleDiscard">
          放弃更改
        </n-button>
        <n-button type="primary" @click="handleSave">
          保存并离开
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { WarningOutline } from '@vicons/ionicons5';

interface Props {
  modelValue?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: true,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'save': [];
  'discard': [];
  'cancel': [];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

function handleSave() {
  emit('save');
}

function handleDiscard() {
  emit('discard');
}

function handleCancel() {
  emit('cancel');
}
</script>

<style scoped>
.unsaved-warning-content {
  text-align: center;
  padding: 20px 0;
}

.warning-icon {
  margin-bottom: 16px;
  color: #e6a23c;
}

.warning-message {
  font-size: 16px;
  color: #606266;
  margin: 0 0 24px;
  line-height: 1.6;
}

.warning-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
