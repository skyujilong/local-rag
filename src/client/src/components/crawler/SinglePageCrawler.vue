<template>
  <n-space vertical size="large">
    <!-- URL 输入区域 -->
    <n-card title="URL 输入" :bordered="false">
      <n-form ref="formRef" :model="formValue" :rules="rules" label-placement="left" label-width="80">
        <n-form-item label="URL" path="url">
          <n-input-group>
            <n-input
              v-model:value="formValue.url"
              placeholder="https://example.com/article"
              :status="urlError ? 'error' : undefined"
              @blur="validateUrl"
            >
              <template #prefix>
                <n-icon><LinkIcon /></n-icon>
              </template>
            </n-input>
            <n-button
              type="primary"
              :disabled="!isValidUrl"
              :loading="isCrawling"
              @click="handleCrawl"
            >
              爬取
            </n-button>
          </n-input-group>
          <template #feedback>
            <n-text v-if="urlError" type="error">{{ urlError }}</n-text>
            <n-text v-else-if="formValue.url" depth="3">输入有效的 HTTP/HTTPS URL</n-text>
          </template>
        </n-form-item>
      </n-form>
    </n-card>

    <!-- 认证配置 -->
    <AuthConfigCollapse v-model:auth-profile-id="formValue.authProfileId" />

    <!-- 高级配置 -->
    <n-collapse>
      <n-collapse-item title="高级配置" name="advanced">
        <n-space vertical>
          <n-form-item label="超时时间">
            <n-input-number
              v-model:value="formValue.timeout"
              :min="1000"
              :max="120000"
              :step="1000"
              placeholder="默认 30000ms"
            >
              <template #suffix>
                <span>ms</span>
              </template>
            </n-input-number>
          </n-form-item>

          <n-form-item label="等待选择器">
            <n-input
              v-model:value="formValue.waitForSelector"
              placeholder=".main-content"
              depth="3"
            />
          </n-form-item>

          <n-form-item label="CSS 选择器">
            <n-input
              v-model:value="formValue.cssSelector"
              placeholder="article.main-content"
              depth="3"
            />
          </n-form-item>
        </n-space>
      </n-collapse-item>
    </n-collapse>

    <!-- 内容预览 -->
    <ContentPreview
      v-if="preview"
      :preview="preview"
      :loading="isCrawling"
      @import="handleImport"
      @cancel="handleCancel"
    />

    <!-- 错误提示 -->
    <n-alert v-if="error" type="error" :bordered="false">
      {{ error }}
    </n-alert>
  </n-space>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  NSpace,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NButton,
  NIcon,
  NCollapse,
  NCollapseItem,
  NInputNumber,
  NText,
  NAlert,
  useMessage,
} from 'naive-ui';
import { LinkOutline as LinkIcon } from '@vicons/ionicons5';
import AuthConfigCollapse from './AuthConfigCollapse.vue';
import ContentPreview from './ContentPreview.vue';
import { useCrawlApi } from '../composables/useCrawlApi';

const message = useMessage();
const crawlApi = useCrawlApi();

// 表单数据
const formValue = ref({
  url: '',
  authProfileId: '',
  timeout: 30000,
  waitForSelector: '',
  cssSelector: '',
});

// URL 验证
const urlError = ref('');
const isValidUrl = computed(() => {
  try {
    const url = new URL(formValue.value.url);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
});

const validateUrl = () => {
  if (!formValue.value.url) {
    urlError.value = '请输入 URL';
    return false;
  }

  if (!isValidUrl.value) {
    urlError.value = 'URL 格式无效，仅支持 HTTP/HTTPS';
    return false;
  }

  urlError.value = '';
  return true;
};

// 爬取状态
const isCrawling = ref(false);
const preview = ref<any>(null);
const error = ref('');

// 爬取处理
const handleCrawl = async () => {
  if (!validateUrl()) {
    return;
  }

  isCrawling.value = true;
  preview.value = null;
  error.value = '';

  try {
    const result = await crawlApi.crawlSinglePage({
      url: formValue.value.url,
      authProfileId: formValue.value.authProfileId || undefined,
      timeout: formValue.value.timeout,
      waitForSelector: formValue.value.waitForSelector || undefined,
      cssSelector: formValue.value.cssSelector || undefined,
    });

    if (result.status === 'success') {
      preview.value = result;
      message.success('爬取成功');
    } else if (result.status === 'auth_expired') {
      error.value = '检测到登录页，请配置认证信息后重试';
    } else {
      error.value = result.errorMessage || '爬取失败';
    }
  } catch (err: any) {
    error.value = err.message || '爬取失败';
  } finally {
    isCrawling.value = false;
  }
};

// 导入处理
const handleImport = async (data: any) => {
  try {
    await crawlApi.createNote({
      title: data.title,
      content: data.content,
      tags: ['webpage', ...data.tags],
    });

    message.success('导入成功');
    preview.value = null;
    formValue.value.url = '';
  } catch (err: any) {
    message.error(err.message || '导入失败');
  }
};

// 取消处理
const handleCancel = () => {
  preview.value = null;
};

// 表单验证规则
const rules = {
  url: {
    required: true,
    validator: (_rule: any, value: string) => {
      if (!value) {
        return new Error('请输入 URL');
      }
      try {
        const url = new URL(value);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return new Error('仅支持 HTTP/HTTPS 协议');
        }
        return true;
      } catch {
        return new Error('URL 格式无效');
      }
    },
    trigger: ['input', 'blur'],
  },
};
</script>
