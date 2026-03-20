/**
 * Naive UI 图标映射工具
 * 从 Element Plus 图标映射到 Ionicons5 图标
 */

import {
  HomeOutline,
  DocumentTextOutline,
  SettingsOutline,
  FolderOutline,
  FolderOpenOutline,
  SearchOutline,
  AddOutline,
  CheckmarkOutline,
  ChevronBackOutline,
  ChevronForwardOutline,
  TrashOutline,
  PencilOutline,
  CheckmarkCircleOutline,
  Settings as SettingsIcon,
  GridOutline,
  CloudDownloadOutline,
} from '@vicons/ionicons5';
import type { Component } from 'vue';

/**
 * 图标映射表
 * Element Plus 图标名称 -> Ionicons5 图标组件
 */
export const icons: Record<string, Component> = {
  // 基础图标
  Home: HomeOutline,
  Document: DocumentTextOutline,
  DocumentText: DocumentTextOutline,
  Settings: SettingsOutline,
  Setting: SettingsIcon,
  Folder: FolderOutline,
  FolderOpened: FolderOpenOutline,
  Search: SearchOutline,
  Add: AddOutline,
  Plus: AddOutline,
  Check: CheckmarkOutline,
  CircleCheck: CheckmarkCircleOutline,
  ArrowLeft: ChevronBackOutline,
  ArrowRight: ChevronForwardOutline,
  Delete: TrashOutline,
  Edit: PencilOutline,
  Collection: GridOutline,
  Connection: CloudDownloadOutline,
};

/**
 * 获取图标组件
 * @param name 图标名称
 * @returns 图标组件
 */
export function getIcon(name: string): Component {
  return icons[name] || DocumentTextOutline;
}

/**
 * 图标名称列表（用于类型检查）
 */
export type IconName = keyof typeof icons;
