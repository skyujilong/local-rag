<template>
  <div class="tiptap-editor" :class="{ 'editor-focused': isFocused }">
    <EditorMenuBar
      v-if="showMenuBar"
      :editor="editor"
      :actions="menuActions"
    />

    <EditorBubbleMenu :editor="editor" />

    <editor-content
      class="editor-content"
      :editor="editor"
      @focus="isFocused = true"
      @blur="isFocused = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import EditorMenuBar from './EditorMenuBar.vue';
import EditorBubbleMenu from './EditorBubbleMenu.vue';

const lowlight = createLowlight(common);

interface Props {
  modelValue: string;
  placeholder?: string;
  editable?: boolean;
  showMenuBar?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '开始输入...',
  editable: true,
  showMenuBar: true,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'ready': [editor: any];
}>();

const isFocused = ref(false);

const menuActions = ref({
  bold: () => editor.value?.chain().focus().toggleBold().run(),
  italic: () => editor.value?.chain().focus().toggleItalic().run(),
  underline: () => editor.value?.chain().focus().toggleUnderline().run(),
  strike: () => editor.value?.chain().focus().toggleStrike().run(),
  code: () => editor.value?.chain().focus().toggleCode().run(),
  heading: (level: 1 | 2 | 3) => editor.value?.chain().focus().toggleHeading({ level }).run(),
  bulletList: () => editor.value?.chain().focus().toggleBulletList().run(),
  orderedList: () => editor.value?.chain().focus().toggleOrderedList().run(),
  blockquote: () => editor.value?.chain().focus().toggleBlockquote().run(),
  codeBlock: () => editor.value?.chain().focus().toggleCodeBlock().run(),
  textAlign: (align: 'left' | 'center' | 'right' | 'justify') =>
    editor.value?.chain().focus().setTextAlign(align).run(),
  undo: () => editor.value?.chain().focus().undo().run(),
  redo: () => editor.value?.chain().focus().redo().run(),
  setLink: (href: string) => {
    if (href) {
      editor.value?.chain().focus().setLink({ href }).run();
    } else {
      editor.value?.chain().focus().unsetLink().run();
    }
  },
  setImage: (src: string) => {
    if (src) {
      editor.value?.chain().focus().setImage({ src }).run();
    }
  },
});

const editor = useEditor({
  content: props.modelValue,
  editable: props.editable,
  extensions: [
    StarterKit.configure({
      codeBlock: false,
    }),
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
    Image.configure({
      inline: true,
      allowBase64: true,
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-blue-500 underline',
      },
    }),
    Underline,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Typography,
    CodeBlockLowlight.configure({
      lowlight,
      HTMLAttributes: {
        class: 'code-block-wrapper',
      },
    }),
  ],
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML());
  },
  onCreate: ({ editor }) => {
    emit('ready', editor);
  },
});

watch(
  () => props.modelValue,
  (value) => {
    if (editor.value && value !== editor.value.getHTML()) {
      editor.value.commands.setContent(value, { emitUpdate: false });
    }
  }
);

watch(
  () => props.editable,
  (value) => {
    editor.value?.setOptions({ editable: value });
  }
);

onBeforeUnmount(() => {
  editor.value?.destroy();
});

defineExpose({
  editor,
});
</script>

<style scoped>
.tiptap-editor {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: hidden;
  transition: border-color 0.3s;
}

.tiptap-editor.editor-focused {
  border-color: #18a058;
}

.editor-content {
  min-height: 400px;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
  padding: 16px;
}

.editor-content :deep(.ProseMirror) {
  outline: none;
  font-size: 16px;
  line-height: 1.8;
  color: #303133;
}

.editor-content :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  color: #a8abb2;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.editor-content :deep(h1) {
  font-size: 28px;
  font-weight: 700;
  margin: 24px 0 16px;
  line-height: 1.3;
}

.editor-content :deep(h2) {
  font-size: 24px;
  font-weight: 600;
  margin: 20px 0 14px;
  line-height: 1.4;
}

.editor-content :deep(h3) {
  font-size: 20px;
  font-weight: 600;
  margin: 16px 0 12px;
  line-height: 1.5;
}

.editor-content :deep(p) {
  margin: 8px 0;
}

.editor-content :deep(code) {
  background-color: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
  color: #e83e8c;
}

.editor-content :deep(pre) {
  background-color: #282c34;
  color: #abb2bf;
  padding: 16px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 16px 0;
}

.editor-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
  color: inherit;
}

.editor-content :deep(.code-block-wrapper) {
  position: relative;
}

.editor-content :deep(ul),
.editor-content :deep(ol) {
  padding-left: 24px;
  margin: 12px 0;
}

.editor-content :deep(li) {
  margin: 4px 0;
}

.editor-content :deep(blockquote) {
  border-left: 4px solid #18a058;
  padding-left: 16px;
  margin: 16px 0;
  color: #606266;
  font-style: italic;
}

.editor-content :deep(a) {
  color: #18a058;
  text-decoration: underline;
  cursor: pointer;
}

.editor-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 16px 0;
  display: block;
}

.editor-content :deep(hr) {
  border: none;
  border-top: 2px solid #e4e7ed;
  margin: 24px 0;
}
</style>
