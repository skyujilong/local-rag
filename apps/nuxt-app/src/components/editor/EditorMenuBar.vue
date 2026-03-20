<template>
  <div class="editor-menu-bar">
    <div class="menu-group">
      <n-tooltip placement="bottom">
        <template #trigger>
          <n-button
            text
            :disabled="!canUndo"
            @click="actions.undo"
          >
            <template #icon>
              <n-icon :component="ArrowUndoOutline" />
            </template>
          </n-button>
        </template>
        撤销 (Ctrl+Z)
      </n-tooltip>
      <n-tooltip placement="bottom">
        <template #trigger>
          <n-button
            text
            :disabled="!canRedo"
            @click="actions.redo"
          >
            <template #icon>
              <n-icon :component="ArrowRedoOutline" />
            </template>
          </n-button>
        </template>
        重做 (Ctrl+Shift+Z)
      </n-tooltip>
    </div>

    <div class="menu-divider"></div>

    <div class="menu-group">
      <n-dropdown trigger="click" :options="headingOptions" @select="handleHeading">
        <n-button text>
          <template #icon>
            <n-icon :component="DocumentTextOutline" />
          </template>
          <template #icon-right>
            <n-icon :component="ChevronDownOutline" />
          </template>
        </n-button>
      </n-dropdown>

      <n-tooltip placement="bottom">
        <template #trigger>
          <n-button
            text
            :type="isActive.bold() ? 'primary' : undefined"
            @click="actions.bold"
          >
            B
          </n-button>
        </template>
        粗体 (Ctrl+B)
      </n-tooltip>

      <n-tooltip placement="bottom">
        <template #trigger>
          <n-button
            text
            :type="isActive.italic() ? 'primary' : undefined"
            @click="actions.italic"
          >
            I
          </n-button>
        </template>
        斜体 (Ctrl+I)
      </n-tooltip>

      <n-tooltip placement="bottom">
        <template #trigger>
          <n-button
            text
            :type="isActive.underline() ? 'primary' : undefined"
            @click="actions.underline"
          >
            U
          </n-button>
        </template>
        下划线 (Ctrl+U)
      </n-tooltip>

      <n-tooltip placement="bottom">
        <template #trigger>
          <n-button
            text
            :type="isActive.strike() ? 'primary' : undefined"
            @click="actions.strike"
          >
            <template #icon>
              <n-icon :component="TrashOutline" />
            </template>
          </n-button>
        </template>
        删除线
      </n-tooltip>

      <n-tooltip placement="bottom">
        <template #trigger>
          <n-button
            text
            :type="isActive.code() ? 'primary' : undefined"
            @click="actions.code"
          >
            <template #icon>
              <n-icon :component="CodeSlashOutline" />
            </template>
          </n-button>
        </template>
        代码 (Ctrl+`)
      </n-tooltip>
    </div>

    <div class="menu-divider"></div>

    <div class="menu-group">
      <n-tooltip placement="bottom">
        <template #trigger>
          <n-button
            text
            :type="isActive.bulletList() ? 'primary' : undefined"
            @click="actions.bulletList"
          >
            <template #icon>
              <n-icon :component="ListOutline" />
            </template>
          </n-button>
        </template>
        无序列表
      </n-tooltip>

      <n-tooltip placement="bottom">
        <template #trigger>
          <n-button
            text
            :type="isActive.orderedList() ? 'primary' : undefined"
            @click="actions.orderedList"
          >
            <template #icon>
              <n-icon :component="OptionsOutline" />
            </template>
          </n-button>
        </template>
        有序列表
      </n-tooltip>

      <n-tooltip placement="bottom">
        <template #trigger>
          <n-button
            text
            :type="isActive.blockquote() ? 'primary' : undefined"
            @click="actions.blockquote"
          >
            <template #icon>
              <n-icon :component="ChatbubbleEllipsesOutline" />
            </template>
          </n-button>
        </template>
        引用
      </n-tooltip>

      <n-tooltip placement="bottom">
        <template #trigger>
          <n-button
            text
            :type="isActive.codeBlock() ? 'primary' : undefined"
            @click="actions.codeBlock"
          >
            <template #icon>
              <n-icon :component="CodeOutline" />
            </template>
          </n-button>
        </template>
        代码块
      </n-tooltip>
    </div>

    <div class="menu-divider"></div>

    <div class="menu-group">
      <n-tooltip placement="bottom">
        <template #trigger>
          <n-button
            text
            :type="isActive.textAlign('left') ? 'primary' : undefined"
            @click="() => actions.textAlign('left')"
          >
            左
          </n-button>
        </template>
        左对齐
      </n-tooltip>

      <n-tooltip placement="bottom">
        <template #trigger>
          <n-button
            text
            :type="isActive.textAlign('center') ? 'primary' : undefined"
            @click="() => actions.textAlign('center')"
          >
            中
          </n-button>
        </template>
        居中
      </n-tooltip>

      <n-tooltip placement="bottom">
        <template #trigger>
          <n-button
            text
            :type="isActive.textAlign('right') ? 'primary' : undefined"
            @click="() => actions.textAlign('right')"
          >
            右
          </n-button>
        </template>
        右对齐
      </n-tooltip>
    </div>

    <div class="menu-divider"></div>

    <div class="menu-group">
      <n-tooltip placement="bottom">
        <template #trigger>
          <n-button text @click="showLinkModal = true">
            <template #icon>
              <n-icon :component="LinkOutline" />
            </template>
          </n-button>
        </template>
        插入链接 (Ctrl+K)
      </n-tooltip>

      <n-tooltip placement="bottom">
        <template #trigger>
          <n-button text @click="showImageModal = true">
            <template #icon>
              <n-icon :component="ImageOutline" />
            </template>
          </n-button>
        </template>
        插入图片
      </n-tooltip>
    </div>

    <!-- 链接对话框 -->
    <n-modal
      v-model:show="showLinkModal"
      preset="card"
      title="插入链接"
      :style="{ width: '500px' }"
      :bordered="false"
    >
      <n-form label-placement="left" label-width="80px">
        <n-form-item label="URL">
          <n-input
            v-model:value="linkUrl"
            placeholder="https://example.com"
            @keyup.enter="insertLink"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showLinkModal = false">取消</n-button>
          <n-button type="primary" @click="insertLink">确定</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 图片对话框 -->
    <n-modal
      v-model:show="showImageModal"
      preset="card"
      title="插入图片"
      :style="{ width: '500px' }"
      :bordered="false"
    >
      <n-form label-placement="left" label-width="80px">
        <n-form-item label="图片 URL">
          <n-input
            v-model:value="imageUrl"
            placeholder="https://example.com/image.jpg"
            @keyup.enter="insertImage"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showImageModal = false">取消</n-button>
          <n-button type="primary" @click="insertImage">确定</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { NIcon } from 'naive-ui';
import {
  ArrowUndoOutline,
  ArrowRedoOutline,
  DocumentTextOutline,
  ChevronDownOutline,
  TrashOutline,
  CodeSlashOutline,
  ListOutline,
  OptionsOutline,
  ChatbubbleEllipsesOutline,
  CodeOutline,
  LinkOutline,
  ImageOutline,
} from '@vicons/ionicons5';
import type { DropdownOption } from 'naive-ui';
import type { Editor, EditorActions } from '@/types/editor';

interface Props {
  editor: Editor | null | undefined;
  actions: EditorActions;
}

const props = defineProps<Props>();

const showLinkModal = ref(false);
const showImageModal = ref(false);
const linkUrl = ref('');
const imageUrl = ref('');

const canUndo = computed(() => props.editor?.can().undo() ?? false);
const canRedo = computed(() => props.editor?.can().redo() ?? false);

const isActive = computed(() => ({
  bold: () => props.editor?.isActive('bold') ?? false,
  italic: () => props.editor?.isActive('italic') ?? false,
  underline: () => props.editor?.isActive('underline') ?? false,
  strike: () => props.editor?.isActive('strike') ?? false,
  code: () => props.editor?.isActive('code') ?? false,
  bulletList: () => props.editor?.isActive('bulletList') ?? false,
  orderedList: () => props.editor?.isActive('orderedList') ?? false,
  blockquote: () => props.editor?.isActive('blockquote') ?? false,
  codeBlock: () => props.editor?.isActive('codeBlock') ?? false,
  textAlign: (align: string) => props.editor?.isActive({ textAlign: align }) ?? false,
}));

// 标题下拉菜单选项
const headingOptions: DropdownOption[] = [
  {
    label: '标题 1',
    key: 1,
  },
  {
    label: '标题 2',
    key: 2,
  },
  {
    label: '标题 3',
    key: 3,
  },
  {
    label: '正文',
    key: 0,
  },
];

function handleHeading(level: number) {
  if (level === 0) {
    props.editor?.chain().focus().setParagraph().run();
  } else if (level === 1 || level === 2 || level === 3) {
    props.actions.heading(level);
  }
}

function insertLink() {
  if (linkUrl.value) {
    props.actions.setLink(linkUrl.value);
  }
  showLinkModal.value = false;
  linkUrl.value = '';
}

function insertImage() {
  if (imageUrl.value) {
    props.actions.setImage(imageUrl.value);
  }
  showImageModal.value = false;
  imageUrl.value = '';
}
</script>

<style scoped>
.editor-menu-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  flex-wrap: wrap;
}

.menu-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.menu-divider {
  width: 1px;
  height: 24px;
  background-color: #dcdfe6;
  margin: 0 4px;
}
</style>
