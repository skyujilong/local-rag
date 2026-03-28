/**
 * Chunking Service - 文档分块服务
 *
 * 实现混合分块策略：按结构分割 + 控制块大小 + 保持重叠
 */

import type { Note, Chunk, ChunkMetadata } from '../../../../shared/types/documents.js';
import { createLogger } from '../../../../shared/utils/logger.js';

const log = createLogger('features:documents:chunking');

/**
 * 分块配置
 */
const CHUNK_CONFIG = {
  chunkSize: 500,           // 目标大小（字符）
  overlap: 50,              // 重叠大小（字符）
  minChunkSize: 100,        // 最小块大小
  maxChunkSize: 1000,       // 最大块大小
  delimiters: [
    /^#{1,6}\s+/m,         // 标题 (H1-H6)
    /\n\n/,                // 空行（段落分隔）
    /^\s*[-*+]\s+/m,       // 无序列表
    /^\s*\d+\.\s+/m,       // 有序列表
  ],
  preserveCodeBlocks: true, // 代码块不分割
} as const;

/**
 * Chunking Service 类
 */
export class ChunkingService {
  /**
   * 对笔记进行分块
   */
  async chunkNote(note: Note): Promise<Chunk[]> {
    log.debug(`开始分块: ${note.title} (${note.content.length} 字符)`);

    const chunks: Chunk[] = [];

    // 第一步：按结构分割（标题、代码块、段落）
    const sections = this.splitByStructure(note.content);

    // 第二步：控制块大小，添加重叠
    let currentChunk = {
      content: '',
      startPosition: 0,
      sectionTitle: undefined as string | undefined,
      sectionLevel: undefined as number | undefined,
      isCodeBlock: false,
    };

    let chunkIndex = 0;
    let position = 0;

    for (const section of sections) {
      const sectionContent = section.content;
      const sectionEnd = position + sectionContent.length;

      // 如果是代码块，保持完整
      if (section.type === 'code') {
        // 如果当前块不为空，先保存
        if (currentChunk.content.length > 0) {
          chunks.push(this.createChunk(
            note.id,
            note.filePath,
            chunkIndex++,
            currentChunk.content,
            currentChunk.startPosition,
            position,
            currentChunk.sectionTitle,
            currentChunk.sectionLevel,
            true,
            note.tags
          ));
        }

        // 创建代码块 chunk
        chunks.push(this.createChunk(
          note.id,
          note.filePath,
          chunkIndex++,
          sectionContent,
          position,
          sectionEnd,
          section.title,
          section.level,
          true,
          note.tags
        ));

        // 重置当前块
        currentChunk = {
          content: '',
          startPosition: sectionEnd,
          sectionTitle: section.title,
          sectionLevel: section.level,
          isCodeBlock: false,
        };

        position = sectionEnd;
        continue;
      }

      // 如果是标题，记录标题信息
      if (section.type === 'heading') {
        currentChunk.sectionTitle = section.title;
        currentChunk.sectionLevel = section.level;
      }

      // 添加内容到当前块
      currentChunk.content += sectionContent;
      position = sectionEnd;

      // 检查是否需要分块
      if (currentChunk.content.length >= CHUNK_CONFIG.chunkSize) {
        // 如果超过最大块大小，强制分割
        if (currentChunk.content.length >= CHUNK_CONFIG.maxChunkSize) {
          chunks.push(this.createChunk(
            note.id,
            note.filePath,
            chunkIndex++,
            currentChunk.content,
            currentChunk.startPosition,
            position,
            currentChunk.sectionTitle,
            currentChunk.sectionLevel,
            false,
            note.tags
          ));

          // 创建新块，添加重叠
          const overlap = currentChunk.content.slice(-CHUNK_CONFIG.overlap);
          currentChunk = {
            content: overlap,
            startPosition: position - overlap.length,
            sectionTitle: currentChunk.sectionTitle,
            sectionLevel: currentChunk.sectionLevel,
            isCodeBlock: false,
          };
        }
      }
    }

    // 保存最后一个块（非空内容都保留，避免内容丢失）
    if (currentChunk.content.trim().length > 0) {
      chunks.push(this.createChunk(
        note.id,
        note.filePath,
        chunkIndex++,
        currentChunk.content,
        currentChunk.startPosition,
        position,
        currentChunk.sectionTitle,
        currentChunk.sectionLevel,
        false,
        note.tags
      ));
    }

    log.debug(`分块完成: ${note.title}, ${chunks.length} chunks`);

    return chunks;
  }

  /**
   * 按结构分割文档
   */
  private splitByStructure(content: string): Array<{
    type: 'heading' | 'paragraph' | 'code' | 'list';
    content: string;
    title?: string;
    level?: number;
  }> {
    const sections: Array<{
      type: 'heading' | 'paragraph' | 'code' | 'list';
      content: string;
      title?: string;
      level?: number;
    }> = [];

    // 先提取代码块
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // 添加代码块之前的内容
      if (match.index > lastIndex) {
        const beforeContent = content.slice(lastIndex, match.index);
        this.splitTextIntoSections(beforeContent, sections);
      }

      // 添加代码块
      sections.push({
        type: 'code',
        content: match[0],
      });

      lastIndex = match.index + match[0].length;
    }

    // 添加剩余内容
    if (lastIndex < content.length) {
      const remainingContent = content.slice(lastIndex);
      this.splitTextIntoSections(remainingContent, sections);
    }

    return sections;
  }

  /**
   * 将文本分割为标题、段落、列表
   */
  private splitTextIntoSections(
    text: string,
    sections: Array<{
      type: 'heading' | 'paragraph' | 'code' | 'list';
      content: string;
      title?: string;
      level?: number;
    }>
  ): void {
    // 按标题分割
    const headingRegex = /^#{1,6}\s+(.+)$/gm;
    let lastIndex = 0;
    let match;

    while ((match = headingRegex.exec(text)) !== null) {
      const level = match[0].trim().split(/\s+/)[0].length;
      const title = match[1].trim();
      const index = match.index;

      // 添加标题之前的内容（如果有）
      if (index > lastIndex) {
        const content = text.slice(lastIndex, index).trim();
        if (content) {
          this.classifyAndAddSection(content, sections);
        }
      }

      // 添加标题
      sections.push({
        type: 'heading',
        content: match[0],
        title,
        level,
      });

      lastIndex = index + match[0].length;
    }

    // 添加剩余内容
    if (lastIndex < text.length) {
      const content = text.slice(lastIndex).trim();
      if (content) {
        this.classifyAndAddSection(content, sections);
      }
    }
  }

  /**
   * 分类并添加段落/列表
   */
  private classifyAndAddSection(
    content: string,
    sections: Array<{
      type: 'heading' | 'paragraph' | 'code' | 'list';
      content: string;
      title?: string;
      level?: number;
    }>
  ): void {
    // 检查是否是列表
    const isList = /^\s*[-*+]\s+/m.test(content) || /^\s*\d+\.\s+/m.test(content);

    sections.push({
      type: isList ? 'list' : 'paragraph',
      content,
    });
  }

  /**
   * 创建 Chunk 对象
   */
  private createChunk(
    documentId: string,
    filePath: string,
    chunkIndex: number,
    content: string,
    startPosition: number,
    endPosition: number,
    sectionTitle?: string,
    sectionLevel?: number,
    isCodeBlock?: boolean,
    tags?: string[]
  ): Chunk {
    const metadata: ChunkMetadata = {
      chunkId: crypto.randomUUID(),
      documentId,
      filePath,
      chunkIndex,
      startPosition,
      endPosition,
      contentLength: content.length,
      sectionTitle,
      sectionLevel,
      isCodeBlock,
      tags: tags || [],
    };

    return {
      id: metadata.chunkId,
      documentId,
      content,
      index: chunkIndex,
      metadata,
    };
  }
}

// 导出单例
export const chunkingService = new ChunkingService();
