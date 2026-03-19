<template>
  <div class="settings-view">
    <el-card header="Ollama 配置">
      <el-form label-width="150px">
        <el-form-item label="服务地址">
          <el-input v-model="settings.ollamaBaseUrl" placeholder="http://localhost:11434" />
        </el-form-item>
        <el-form-item label="嵌入模型">
          <el-input v-model="settings.ollamaModel" placeholder="nomic-embed-text" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveSettings">保存设置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card header="忽略规则" style="margin-top: 20px;">
      <el-form label-width="150px">
        <el-form-item label="自定义忽略">
          <el-select
            v-model="ignoreCustom"
            multiple
            filterable
            allow-create
            placeholder="添加忽略模式"
            style="width: 100%;"
          >
            <el-option
              v-for="pattern in ignoreCustom"
              :key="pattern"
              :label="pattern"
              :value="pattern"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-alert
            title="提示"
            type="info"
            description="支持通配符，例如: **/*.log, node_modules/**"
            :closable="false"
            show-icon
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveIgnoreRules">保存规则</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { storageApi } from '@/api/storage';
import { ElMessage } from 'element-plus';

const settings = ref({
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'nomic-embed-text',
});

const ignoreCustom = ref<string[]>([]);

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
  ElMessage.success('设置已保存');
}

async function saveIgnoreRules() {
  try {
    const response = await storageApi.updateIgnoreRules({
      custom: ignoreCustom.value,
    });
    if (response.success) {
      ElMessage.success('忽略规则已保存');
    }
  } catch (error) {
    ElMessage.error('保存失败');
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
