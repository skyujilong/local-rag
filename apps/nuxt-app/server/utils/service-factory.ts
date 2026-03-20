/**
 * 服务工厂
 * 管理服务层单例
 */

import { NoteManager } from '../services/notes'
import * as KnowledgeService from '../services/knowledge-base/document-manager'
import * as RAGService from '../rag/index'
import * as StorageService from '../storage/index'

// 服务实例缓存
const serviceCache = new Map<string, any>()

/**
 * 获取笔记管理器单例
 */
export function getNoteManager(): NoteManager {
  if (!serviceCache.has('noteManager')) {
    serviceCache.set('noteManager', new NoteManager())
  }
  return serviceCache.get('noteManager') as NoteManager
}

/**
 * 获取知识库服务（已经是静态方法，直接返回）
 */
export function getKnowledgeService() {
  return KnowledgeService
}

/**
 * 获取 RAG 服务（已经是静态方法，直接返回）
 */
export function getRAGService() {
  return RAGService
}

/**
 * 获取存储服务（已经是静态方法，直接返回）
 */
export function getStorageService() {
  return StorageService
}

/**
 * 清除所有服务缓存（用于测试）
 */
export function clearServiceCache() {
  serviceCache.clear()
}
