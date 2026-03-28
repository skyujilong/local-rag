<template>
  <div class="tags-manager">
    <n-space vertical size="large">
      <!-- 操作栏 -->
      <n-space justify="space-between" align="center">
        <n-h1>标签管理</n-h1>
        <n-button type="primary" @click="showCreateModal = true">
          <template #icon>
            <n-icon><AddIcon /></n-icon>
          </template>
          新建标签
        </n-button>
      </n-space>

      <!-- 统计信息 -->
      <n-space>
        <n-statistic label="总标签数" :value="totalTags" />
        <n-statistic label="最常用标签" :value="mostUsedTag?.name || '-'" />
      </n-space>

      <!-- 标签列表 -->
      <n-data-table
        :columns="columns"
        :data="tags"
        :loading="loading"
        :pagination="pagination"
        striped
      />
    </n-space>

    <!-- 创建标签对话框 -->
    <n-modal v-model:show="showCreateModal" preset="card" title="新建标签" style="width: 400px">
      <n-form ref="createFormRef" :model="createForm" :rules="createRules">
        <n-form-item label="标签名称" path="name">
          <n-input v-model:value="createForm.name" placeholder="输入标签名称" />
        </n-form-item>
        <n-form-item label="标签颜色" path="color">
          <n-color-picker v-model:value="createForm.color" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showCreateModal = false">取消</n-button>
          <n-button type="primary" @click="handleCreate" :loading="creating">
            创建
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 编辑标签对话框 -->
    <n-modal v-model:show="showEditModal" preset="card" title="编辑标签" style="width: 400px">
      <n-form ref="editFormRef" :model="editForm" :rules="editRules">
        <n-form-item label="标签名称" path="name">
          <n-input v-model:value="editForm.name" placeholder="输入标签名称" />
        </n-form-item>
        <n-form-item label="标签颜色" path="color">
          <n-color-picker v-model:value="editForm.color" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showEditModal = false">取消</n-button>
          <n-button type="primary" @click="handleEdit" :loading="editing">
            保存
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, h } from 'vue';
import {
  NSpace,
  NH1,
  NButton,
  NIcon,
  NDataTable,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NColorPicker,
  NStatistic,
  useDialog,
  useMessage,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui';
import { Add } from '@vicons/ionicons5';

const dialog = useDialog();
const message = useMessage();

// 图标组件
const AddIcon = Add;

// 状态
const loading = ref(false);
const creating = ref(false);
const editing = ref(false);
const showCreateModal = ref(false);
const showEditModal = ref(false);

// 数据
const tags = ref<Array<{ id: string; name: string; count: number; color?: string }>>([]);

// 表单
const createFormRef = ref<FormInst | null>(null);
const createForm = ref({
  name: '',
  color: '#2080f0',
});

const editFormRef = ref<FormInst | null>(null);
const editForm = ref({
  name: '',
  color: '#2080f0',
});

const currentEditId = ref<string>('');

// 表单验证规则
const createRules: FormRules = {
  name: [
    { required: true, message: '请输入标签名称', trigger: 'blur' },
    { min: 1, max: 20, message: '标签名称长度应在 1-20 个字符之间', trigger: 'blur' },
  ],
};

const editRules: FormRules = {
  name: [
    { required: true, message: '请输入标签名称', trigger: 'blur' },
    { min: 1, max: 20, message: '标签名称长度应在 1-20 个字符之间', trigger: 'blur' },
  ],
};

// 分页
const pagination = {
  pageSize: 20,
};

// 统计
const totalTags = computed(() => tags.value.length);

const mostUsedTag = computed(() => {
  if (tags.value.length === 0) return null;
  return [...tags.value].sort((a, b) => b.count - a.count)[0];
});

// 表格列
const columns: DataTableColumns<{ id: string; name: string; count: number; color?: string }> = [
  {
    title: '标签名称',
    key: 'name',
    render: (row) => h('span', { style: { color: row.color || '#2080f0' } }, row.name),
  },
  {
    title: '笔记数量',
    key: 'count',
    render: (row) => h('span', row.count),
  },
  {
    title: '操作',
    key: 'actions',
    render: (row) =>
      h('div', { style: { display: 'flex', gap: '8px' } }, [
        h(
          NButton,
          {
            size: 'small',
            onClick: () => openEditModal(row),
          },
          { default: () => '编辑' }
        ),
        h(
          NButton,
          {
            size: 'small',
            type: 'error',
            onClick: () => handleDelete(row.id, row.name),
          },
          { default: () => '删除' }
        ),
      ]),
  },
];

/**
 * 初始化
 */
onMounted(() => {
  loadTags();
});

/**
 * 加载标签列表
 */
const loadTags = async () => {
  loading.value = true;

  try {
    const response = await fetch('/api/documents/tags');
    const data = await response.json();

    if (data.success && data.data) {
      tags.value = data.data.tags;
    } else {
      message.error('加载标签失败');
    }
  } catch (error) {
    console.error('加载标签失败:', error);
    message.error('加载标签失败');
  } finally {
    loading.value = false;
  }
};

/**
 * 创建标签
 */
const handleCreate = async () => {
  if (!createFormRef.value) return;

  try {
    await createFormRef.value.validate();

    creating.value = true;

    const response = await fetch('/api/documents/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: createForm.value.name,
        color: createForm.value.color,
      }),
    });

    const data = await response.json();

    if (data.success) {
      message.success('标签创建成功');
      showCreateModal.value = false;
      createForm.value = {
        name: '',
        color: '#2080f0',
      };
      loadTags();
    } else {
      message.error(data.error || '创建失败');
    }
  } catch (error) {
    console.error('创建标签失败:', error);
    message.error('创建标签失败');
  } finally {
    creating.value = false;
  }
};

/**
 * 打开编辑对话框
 */
const openEditModal = (tag: { id: string; name: string; count: number }) => {
  currentEditId.value = tag.id;
  editForm.value = {
    name: tag.name,
    color: '#2080f0', // TODO: 从后端获取颜色
  };
  showEditModal.value = true;
};

/**
 * 编辑标签
 */
const handleEdit = async () => {
  if (!editFormRef.value) return;

  try {
    await editFormRef.value.validate();

    editing.value = true;

    const response = await fetch(`/api/documents/tags/${currentEditId.value}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm.value),
    });

    const data = await response.json();

    if (data.success) {
      message.success('标签更新成功');
      showEditModal.value = false;
      loadTags();
    } else {
      message.error(data.error || '更新失败');
    }
  } catch (error) {
    console.error('更新标签失败:', error);
    message.error('更新标签失败');
  } finally {
    editing.value = false;
  }
};

/**
 * 删除标签
 */
const handleDelete = (id: string, name: string) => {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除标签 "${name}" 吗？该标签将从所有笔记中移除。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const response = await fetch(`/api/documents/tags/${id}`, {
          method: 'DELETE',
        });

        const data = await response.json();

        if (data.success) {
          message.success(`标签已删除，影响了 ${data.updatedDocuments} 个笔记`);
          loadTags();
        } else {
          message.error(data.error || '删除失败');
        }
      } catch (error) {
        console.error('删除标签失败:', error);
        message.error('删除标签失败');
      }
    },
  });
};
</script>

<style scoped>
.tags-manager {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
