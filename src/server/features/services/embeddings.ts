/**
 * Proxy module for test resolution.
 *
 * notes.service.ts / search.service.ts / vectorization.service.ts import
 * '../../services/embeddings.js' which resolves to this directory
 * (src/server/features/services/) rather than the actual location
 * (src/server/services/). This file re-exports from the actual location
 * so that vitest can resolve and mock these imports correctly.
 */
export * from '../../services/embeddings.js';
