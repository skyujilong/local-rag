/**
 * 笔记索引器 - 将笔记索引到 RAG 系统
 */

import * as RAGService from '../../rag/index.js';
import type { Note } from '@local-rag/shared/types';
import type { Document } from '@local-rag/shared/types';

/**
 * 索引笔记到 RAG
 */
export async function indexNote(note: Note): Promise<void> {
  const document: Document = {
    id: note.id,
    title: note.title,
    content: note.content,
    source: 'note',
    metadata: {
      type: 'note',
      tags: note.tags,
    },
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };

  await RAGService.indexDocument(document);
}

/**
 * 从 RAG 索引中删除笔记
 */
export async function removeNoteFromIndex(noteId: string): Promise<void> {
  await RAGService.removeFromIndex(noteId);
}
