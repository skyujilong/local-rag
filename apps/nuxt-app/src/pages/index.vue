<template>
  <div class="home-view">
    <n-grid :cols="4" :x-gap="20" :y-gap="20">
      <n-grid-item>
        <n-card class="stat-card">
          <n-statistic label="笔记数量" :value="stats.notes" />
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card class="stat-card">
          <n-statistic label="文档数量" :value="stats.documents" />
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card class="stat-card">
          <n-statistic label="已索引文件" :value="stats.files" />
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card class="stat-card">
          <n-statistic label="活跃任务" :value="stats.tasks" />
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-grid :cols="2" :x-gap="20" :y-gap="20" style="margin-top: 20px;">
      <n-grid-item>
        <n-card title="快速操作">
          <div class="quick-actions">
            <n-button type="primary" block @click="navigateTo('/notes')">
              <template #icon>
                <n-icon :component="PencilOutline" />
              </template>
              笔记管理
            </n-button>
            <n-button type="success" block @click="navigateTo('/crawler')">
              <template #icon>
                <n-icon :component="CloudDownloadOutline" />
              </template>
              启动爬虫
            </n-button>
            <n-button type="warning" block @click="navigateTo('/storage')">
              <template #icon>
                <n-icon :component="FolderOpenOutline" />
              </template>
              索引文件
            </n-button>
            <n-button type="info" block @click="navigateTo('/knowledge')">
              <template #icon>
                <n-icon :component="LibraryOutline" />
              </template>
              知识库
            </n-button>
          </div>
        </n-card>
      </n-grid-item>

      <n-grid-item>
        <n-card title="最近笔记">
          <n-list v-if="recentNotes.length > 0" hoverable clickable>
            <n-list-item v-for="note in recentNotes" :key="note.id" @click="navigateTo(`/notes/${note.id}`)">
              <n-thing>
                <template #header>
                  <span class="note-title">{{ note.title }}</span>
                </template>
                <template #description>
                  <n-tag size="small" type="info">{{ formatDate(note.updatedAt) }}</n-tag>
                  <template v-if="note.tags.length > 0">
                    <n-tag v-for="tag in note.tags.slice(0, 3)" :key="tag" size="small" style="margin-left: 4px;">
                      {{ tag }}
                    </n-tag>
                  </template>
                </template>
              </n-thing>
            </n-list-item>
          </n-list>
          <n-empty v-else description="暂无笔记" />
        </n-card>
      </n-grid-item>
    </n-grid>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { PencilOutline, CloudDownloadOutline, FolderOpenOutline, LibraryOutline } from '@vicons/ionicons5'

const stats = ref({
  notes: 0,
  documents: 0,
  files: 0,
  tasks: 0,
})

const recentNotes = ref<Array<any>>([])

function formatDate(date: string | Date): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60))
      return minutes === 0 ? '刚刚' : `${minutes}分钟前`
    }
    return `${hours}小时前`
  }
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return d.toLocaleDateString('zh-CN')
}

function navigateTo(path: string) {
  window.location.href = path
}

async function loadStats() {
  try {
    const result = await $fetch('/api/notes', {
      query: { page: 1, pageSize: 5 }
    })

    if (result.success && result.data) {
      stats.value.notes = result.data.total || 0
      recentNotes.value = result.data.items || []
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.home-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.stat-card {
  text-align: center;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.note-title {
  font-weight: 500;
  cursor: pointer;
}

.note-title:hover {
  color: #18a058;
}
</style>
