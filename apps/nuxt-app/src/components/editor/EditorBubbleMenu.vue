<template>
  <div
    v-if="editor"
    class="editor-bubble-menu"
    :class="{ 'is-active': isActive }"
    :style="{ top: top + 'px', left: left + 'px' }"
  >
    <div class="bubble-menu-content">
      <n-button
        text
        size="small"
        :type="editor.isActive('bold') ? 'primary' : undefined"
        @click="editor.chain().focus().toggleBold().run()"
      >
        B
      </n-button>

      <n-button
        text
        size="small"
        :type="editor.isActive('italic') ? 'primary' : undefined"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        I
      </n-button>

      <n-button
        text
        size="small"
        :type="editor.isActive('underline') ? 'primary' : undefined"
        @click="editor.chain().focus().toggleUnderline().run()"
      >
        U
      </n-button>

      <n-button
        text
        size="small"
        :type="editor.isActive('strike') ? 'primary' : undefined"
        @click="editor.chain().focus().toggleStrike().run()"
      >
        <template #icon>
          <n-icon :component="TrashOutline" />
        </template>
      </n-button>

      <n-divider vertical style="margin: 0 8px;" />

      <n-button
        text
        size="small"
        @click="showLinkInput = !showLinkInput"
      >
        <template #icon>
          <n-icon :component="LinkOutline" />
        </template>
      </n-button>

      <n-input
        v-if="showLinkInput"
        v-model:value="linkUrl"
        size="small"
        placeholder="输入 URL"
        style="width: 200px;"
        @keyup.enter="setLink"
        @blur="setLink"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { NIcon } from 'naive-ui';
import { TrashOutline, LinkOutline } from '@vicons/ionicons5';
import type { Editor } from '@/types/editor';

interface Props {
  editor: Editor | null | undefined;
}

const props = defineProps<Props>();

const showLinkInput = ref(false);
const linkUrl = ref('');
const isActive = ref(false);
const top = ref(0);
const left = ref(0);

function setLink() {
  if (linkUrl.value && props.editor) {
    props.editor.chain().focus().setLink({ href: linkUrl.value }).run();
  }
  showLinkInput.value = false;
  linkUrl.value = '';
}
</script>

<style scoped>
.editor-bubble-menu {
  position: fixed;
  z-index: 1000;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.editor-bubble-menu.is-active {
  opacity: 1;
  pointer-events: auto;
}

.bubble-menu-content {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background-color: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.bubble-menu-content :deep(.n-button) {
  padding: 4px 8px;
}
</style>
