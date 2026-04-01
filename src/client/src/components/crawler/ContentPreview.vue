<template>
  <n-card title="内容预览" :bordered="false">
    <n-spin :show="loading" description="正在爬取...">
      <n-space vertical size="large">
        <!-- 元数据 -->
        <n-descriptions bordered :column="2">
          <n-descriptions-item label="标题">
            {{ preview.title || '无标题' }}
          </n-descriptions-item>
          <n-descriptions-item label="字数">
            {{ preview.wordCount || 0 }}
          </n-descriptions-item>
          <n-descriptions-item label="来源 URL">
            <n-a :href="preview.url" target="_blank">
              {{ preview.url }}
            </n-a>
          </n-descriptions-item>
          <n-descriptions-item label="质量评分">
            <n-tag :type="getQualityType(preview.qualityScore)">
              {{ ((preview.qualityScore || 0) * 100).toFixed(0) }}%
            </n-tag>
          </n-descriptions-item>
        </n-descriptions>

        <!-- 标题编辑 -->
        <n-form-item label="编辑标题">
          <n-input
            v-model:value="editableTitle"
            placeholder="文档标题"
          />
        </n-form-item>

        <!-- 标签 -->
        <n-form-item label="标签">
          <n-dynamic-tags v-model:value="tags" />
        </n-form-item>

        <!-- 内容预览 -->
        <n-collapse>
          <n-collapse-item title="预览内容" name="content">
            <n-scrollbar style="max-height: 400px">
              <n-text>
                {{ preview.content || '无内容' }}
              </n-text>
            </n-scrollbar>
          </n-collapse-item>
        </n-collapse>

        <!-- 操作按钮 -->
        <n-space justify="end">
          <n-button @click="$emit('cancel')">
            取消
          </n-button>
          <n-button type="primary" @click="handleImport">
            导入为笔记
          </n-button>
        </n-space>
      </n-space>
    </n-spin>
  </n-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  NCard,
  NSpace,
  NSpin,
  NDescriptions,
  NDescriptionsItem,
  NTag,
  NA,
  NFormItem,
  NInput,
  NDynamicTags,
  NCollapse,
  NCollapseItem,
  NScrollbar,
  NText,
  NButton,
} from 'naive-ui';

const props = defineProps<{
  preview: any;
  loading?: boolean;
}>();

const emit = defineEmits<{
  import: [data: any];
  cancel: [];
}>();

const editableTitle = ref(props.preview.title || '');
const tags = ref<string[]>(['webpage']);

const getQualityType = (score: number) => {
  if (score >= 0.8) return 'success';
  if (score >= 0.5) return 'warning';
  return 'error';
};

const handleImport = () => {
  emit('import', {
    title: editableTitle.value,
    content: props.preview.content,
    url: props.preview.url,
    tags: tags.value,
  });
};
</script>
