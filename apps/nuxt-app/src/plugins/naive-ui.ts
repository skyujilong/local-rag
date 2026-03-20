/**
 * Naive UI 插件 - 全局注册组件
 */
import { defineNuxtPlugin } from 'nuxt/app'
import type { NuxtApp } from 'nuxt/app'
import { setup } from '@css-render/vue3-ssr'
import {
  NAlert,
  NButton,
  NCard,
  NConfigProvider,
  NDataTable,
  NEmpty,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NLayoutSider,
  NList,
  NListItem,
  NMenu,
  NMessageProvider,
  NModal,
  NPagination,
  NProgress,
  NSpace,
  NStatistic,
  NSwitch,
  NTag,
  NThing,
} from 'naive-ui'

export default defineNuxtPlugin((nuxtApp: NuxtApp) => {
  // SSR 配置
  if (import.meta.server) {
    const { collect } = setup(nuxtApp.vueApp)
    nuxtApp.ssrContext?.head.push({
      style: [
        {
          innerHTML: collect(),
        },
      ],
    })
  }

  // 注册 Naive UI 组件
  nuxtApp.vueApp.component('NAlert', NAlert)
  nuxtApp.vueApp.component('NButton', NButton)
  nuxtApp.vueApp.component('NCard', NCard)
  nuxtApp.vueApp.component('NConfigProvider', NConfigProvider)
  nuxtApp.vueApp.component('NDataTable', NDataTable)
  nuxtApp.vueApp.component('NEmpty', NEmpty)
  nuxtApp.vueApp.component('NForm', NForm)
  nuxtApp.vueApp.component('NFormItem', NFormItem)
  nuxtApp.vueApp.component('NGrid', NGrid)
  nuxtApp.vueApp.component('NGridItem', NGridItem)
  nuxtApp.vueApp.component('NIcon', NIcon)
  nuxtApp.vueApp.component('NInput', NInput)
  nuxtApp.vueApp.component('NLayout', NLayout)
  nuxtApp.vueApp.component('NLayoutContent', NLayoutContent)
  nuxtApp.vueApp.component('NLayoutHeader', NLayoutHeader)
  nuxtApp.vueApp.component('NLayoutSider', NLayoutSider)
  nuxtApp.vueApp.component('NList', NList)
  nuxtApp.vueApp.component('NListItem', NListItem)
  nuxtApp.vueApp.component('NMenu', NMenu)
  nuxtApp.vueApp.component('NMessageProvider', NMessageProvider)
  nuxtApp.vueApp.component('NModal', NModal)
  nuxtApp.vueApp.component('NPagination', NPagination)
  nuxtApp.vueApp.component('NProgress', NProgress)
  nuxtApp.vueApp.component('NSpace', NSpace)
  nuxtApp.vueApp.component('NStatistic', NStatistic)
  nuxtApp.vueApp.component('NSwitch', NSwitch)
  nuxtApp.vueApp.component('NTag', NTag)
  nuxtApp.vueApp.component('NThing', NThing)
})
