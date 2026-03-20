/**
 * TipTap 编辑器相关类型定义
 */
import type { Editor as TipTapEditor } from '@tiptap/vue-3'

export type Editor = TipTapEditor

export interface EditorActions {
  bold: () => void
  italic: () => void
  underline: () => void
  strike: () => void
  code: () => void
  heading: (level: 1 | 2 | 3) => void
  bulletList: () => void
  orderedList: () => void
  blockquote: () => void
  codeBlock: () => void
  textAlign: (align: 'left' | 'center' | 'right' | 'justify') => void
  undo: () => void
  redo: () => void
  setLink: (href: string) => void
  setImage: (src: string) => void
}

export interface DraftData {
  title: string
  content: string
  tags: string[]
  savedAt: string
}
