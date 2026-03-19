<template>
  <div class="settings-view">
    <n-card title="Ollama 配置">
      <n-form label-width="150px" label-placement="left">
        <n-form-item label="服务地址">
          <n-input
            v-model:value="settings.ollamaBaseUrl"
            placeholder="http://localhost:11434"
          />
        </n-form-item>
        <n-form-item label="嵌入模型">
          <n-input
            v-model:value="settings.ollamaModel"
            placeholder="nomic-embed-text"
          />
        </n-form-item>
        <n-form-item>
          <n-button type="primary" @click="saveSettings">保存设置</n-button>
        </n-form-item>
      </n-form>
    </n-card>

    <n-card title="忽略规则" style="margin-top: 20px;">
      <n-form label-width="150px" label-placement="left">
        <n-form-item label="自定义忽略">
          <n-select
            v-model:value="ignoreCustom"
            multiple
            filterable
            tag
            placeholder="添加忽略模式"
            :options="ignoreOptions"
          />
        </n-form-item>
        <n-form-item>
          <n-alert type="info" :bordered="false">
            支持通配符，例如: **/*.log, node_modules/**
          </n-alert>
        </n-form-item>
        <n-form-item>
          <n-button type="primary" @click="saveIgnoreRules">保存规则</n-button>
        </n-form-item>
      </n-form>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { storageApi } from '@/api/storage';
import { message } from '@/utils/message';

const settings = ref({
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'nomic-embed-text',
});

const ignoreCustom = ref<string[]>([]);

// 计算选择器选项
const ignoreOptions = computed(() => {
  return ignoreCustom.value.map(pattern => ({
    label: pattern,
    value: pattern,
  }));
});

async function loadIgnoreRules() {
  try {
    const response = await storageApi.getIgnoreRules();
    if (response.success && response.data) {
      ignoreCustom.value = response.data.custom || [];
    }
  } catch (error) {
    console.error('加载忽略规则失败:', error);
  }
}

function saveSettings() {
  localStorage.setItem('settings', JSON.stringify(settings.value));
  message.success('设置已保存');
}

async function saveIgnoreRules() {
  try {
    const response = await storageApi.updateIgnoreRules({
      custom: ignoreCustom.value,
    });
    if (response.success) {
      message.success('忽略规则已保存');
    }
  } catch (error) {
    message.error('保存失败');
  }
}

onMounted(() => {
  const saved = localStorage.getItem('settings');
  if (saved) {
    try {
      settings.value = JSON.parse(saved);
    } catch {
      // 使用默认值
    }
  }
  loadIgnoreRules();
});
</script>

<style scoped>
.settings-view {
  max-width: 800px;
  margin: 0 auto;
}
</style>
