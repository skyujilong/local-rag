import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: [
      {
        // src/server/features/documents/services/ 中的 ../../services 路径
        // 实际解析到 src/server/features/services/（不存在）
        // 将其重定向到实际存在的 src/server/services/
        find: /^(.*\/src\/server\/features\/services)\/(.*)/,
        replacement: resolve(import.meta.dirname, 'src/server/services') + '/$2',
      },
    ],
    extensions: ['.ts', '.js', '.mts', '.mjs'],
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts'],
    },
  },
});
