// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from 'nuxt/config'
import { resolve } from 'path'

const sharedSrcPath = resolve(__dirname, '../../packages/shared/src')

export default defineNuxtConfig({
  // 源代码目录
  srcDir: 'src',

  compatibilityDate: '2024-11-01',

  future: {
    compatibilityVersion: 4,
  },

  experimental: {
    appManifest: false,
  },

  // DevTools 配置 - 避免权限弹窗
  devtools: {
    enabled: true,
    // 自动信任本地开发环境
    trustAdditionalPorts: [3000, 3001, 3002],
  },

  // TypeScript 配置
  typescript: {
    strict: true,
    typeCheck: false, // 暂时禁用，等待 vite-plugin-checker 修复
  },

  // Nuxt 应用配置
  app: {
    head: {
      title: 'Local RAG - 本地知识库系统',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '基于 LlamaIndex 的本地 RAG 知识库系统' },
      ],
    },
    // 全局 CSS 导入 - 修复样式闪烁问题
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' },
  },

  // 全局 CSS 导入
  css: ['~/assets/css/main.css'],

  // 开发服务器配置
  devServer: {
    port: 3000,
  },

  // Vite 配置
  vite: {
    server: {
      watch: {
        ignored: ['**/data/**', '**/logs/**', '**/dist/**'],
      },
    },
    // 让 Vite 直接处理 @local-rag/shared 的源码，实现热重载
    ssr: {
      noExternal: ['@local-rag/shared'],
    },
    resolve: {
      alias: {
        '@local-rag/shared': sharedSrcPath,
      },
    },
    optimizeDeps: {
      exclude: ['@local-rag/shared'],
    },
  },

  // 构建配置
  build: {
    transpile: ['naive-ui', '@mozilla/readability', 'llamaindex', '@local-rag/shared'],
  },

  // 自动导入配置
  imports: {
    dirs: ['src/composables', 'src/stores', 'src/api', 'src/utils'],
  },

  // 扩展 Nuxt 目录
  alias: {
    '~/server': './server',
  },

  // Nuxt 模块
  modules: ['@pinia/nuxt'],

  // Pinia 配置
  pinia: {
    storesDirs: ['./src/stores/**'],
  },

  // Nitro 配置
  nitro: {
    experimental: {
      websocket: true,
    },
    // 使用 Node.js runtime（兼容 Playwright 和 LlamaIndex）
    routeRules: {
      '/api/**': { cache: { none: true } },
    },
  },

  // 运行时配置
  runtimeConfig: {
    // 私有配置（服务端）
    // ...

    // 公共配置（客户端可访问）
    public: {
      // WebSocket 服务器 URL
      // 留空则使用默认值: ws://localhost:3000/_ws/ws
      // Nitro WebSocket 路由格式: /_ws/{route} 其中 route 是 server/routes/ 下的文件名
      wsUrl: '',
    },
  },
})
