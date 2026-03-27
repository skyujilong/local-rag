/**
 * Semantic search service with hybrid retrieval
 */

import type { SearchQuery, SearchResult, HybridSearchResult } from '../../shared/types/index.js';
import { embeddingService } from './embeddings.js';
import { vectorStore } from './vectorstore.js';
import { documentService } from './documents.js';
import { createLogger } from '../../shared/utils/logger.js';

const log = createLogger('services:search');

export class SearchService {
  /**
   * Perform semantic search
   */
  async semanticSearch(query: SearchQuery): Promise<SearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await embeddingService.embed(query.query);

    // Search vector store
    const results = await vectorStore.search(query, queryEmbedding);

    log.debug(`Semantic search returned ${results.length} results for: ${query.query}`);

    return results;
  }

  /**
   * Perform keyword search (simple text matching)
   */
  async keywordSearch(query: SearchQuery): Promise<SearchResult[]> {
    const documents = documentService.getAllDocuments();
    const results: SearchResult[] = [];

    const queryLower = query.query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

    for (const doc of documents) {
      if (doc.vectorizationStatus !== 'completed') {
        continue;
      }

      // Filter by tags if specified
      if (query.filters?.tags && query.filters.tags.length > 0) {
        if (!query.filters.tags.some((tag) => doc.metadata.tags?.includes(tag))) {
          continue;
        }
      }

      // Filter by source if specified
      if (query.filters?.sources && query.filters.sources.length > 0) {
        if (!query.filters.sources.includes(doc.metadata.source)) {
          continue;
        }
      }

      // Search in chunks
      for (const chunk of doc.chunks) {
        const contentLower = chunk.content.toLowerCase();

        // Calculate keyword score
        let matchCount = 0;
        for (const word of queryWords) {
          if (contentLower.includes(word)) {
            matchCount++;
          }
        }

        if (matchCount > 0) {
          const score = matchCount / queryWords.length;

          results.push({
            documentId: doc.metadata.id,
            chunkId: chunk.id,
            content: chunk.content,
            score,
            metadata: doc.metadata,
          });
        }
      }
    }

    // Sort by score and limit to topK
    results.sort((a, b) => b.score - a.score);
    const topK = query.topK || 3;
    return results.slice(0, topK);
  }

  /**
   * Perform hybrid search combining semantic and keyword results
   */
  async hybridSearch(query: SearchQuery): Promise<HybridSearchResult[]> {
    // Run both searches in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticSearch(query),
      this.keywordSearch(query),
    ]);

    // Combine results using Reciprocal Rank Fusion (RRF)
    const combinedResults = this.reciprocalRankFusion(semanticResults, keywordResults, query);

    log.debug(
      `Hybrid search returned ${combinedResults.length} results for: ${query.query}`
    );

    return combinedResults;
  }

  /**
   * Reciprocal Rank Fusion algorithm
   */
  private reciprocalRankFusion(
    semanticResults: SearchResult[],
    keywordResults: SearchResult[],
    searchQuery: SearchQuery,
    k: number = 60
  ): HybridSearchResult[] {
    const scoreMap = new Map<string, HybridSearchResult>();

    // Process semantic results
    semanticResults.forEach((result, index) => {
      const key = `${result.documentId}-${result.chunkId}`;
      scoreMap.set(key, {
        ...result,
        semanticScore: result.score,
        keywordScore: 0,
        combinedScore: 1 / (k + index + 1),
        method: 'semantic',
      });
    });

    // Process keyword results and combine
    keywordResults.forEach((result, index) => {
      const key = `${result.documentId}-${result.chunkId}`;
      const keywordScore = 1 / (k + index + 1);

      if (scoreMap.has(key)) {
        const existing = scoreMap.get(key)!;
        existing.keywordScore = keywordScore;
        existing.combinedScore += keywordScore;
        existing.method = 'hybrid';
      } else {
        scoreMap.set(key, {
          ...result,
          semanticScore: 0,
          keywordScore: result.score,
          combinedScore: keywordScore,
          method: 'keyword',
        });
      }
    });

    // Convert to array and sort
    const results = Array.from(scoreMap.values()).sort(
      (a, b) => b.combinedScore - a.combinedScore
    );

    // Apply threshold from query if specified; default to 0 (no filtering) since RRF scores are inherently small
    const threshold = searchQuery.threshold ?? 0;
    return results.filter((r) => r.combinedScore >= threshold);
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSearchSuggestions(partialQuery: string, limit: number = 5): Promise<string[]> {
    const documents = documentService.getAllDocuments();
    const suggestions = new Set<string>();

    const queryLower = partialQuery.toLowerCase();

    for (const doc of documents) {
      // Extract phrases from content
      const words = doc.content.split(/\s+/);
      for (let i = 0; i < words.length - 2; i++) {
        const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`.toLowerCase();
        if (phrase.startsWith(queryLower) && phrase.length > partialQuery.length) {
          suggestions.add(phrase.trim());
        }
      }

      if (suggestions.size >= limit) {
        break;
      }
    }

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Get similar documents based on a document ID
   */
  async getSimilarDocuments(documentId: string, topK: number = 3): Promise<SearchResult[]> {
    const doc = documentService.getDocument(documentId);
    if (!doc) {
      return [];
    }

    // Use document summary for better search results
    // Combine title, first paragraph, and second paragraph
    const paragraphs = doc.content.split('\n\n').filter(p => p.trim().length > 0);
    const summary = [
      doc.metadata.title,
      paragraphs[0] || '',
      paragraphs[1] || '',
    ].join('\n\n').trim();

    const query: SearchQuery = {
      query: summary.slice(0, 1000), // Use up to 1000 chars
      topK,
    };

    return this.semanticSearch(query);
  }
}

export const searchService = new SearchService();
