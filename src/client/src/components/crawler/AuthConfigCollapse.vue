<template>
  <n-collapse class="auth-config-collapse">
    <n-collapse-item name="auth">
      <template #header>
        <n-space align="center">
          <n-icon><LockClosedOutline /></n-icon>
          <span>认证配置</span>
        </n-space>
      </template>

      <n-tabs type="segment" v-model:value="activeTab">
        <!-- Cookie 注入 -->
        <n-tab-pane name="cookie" tab="Cookie 注入">
          <n-space vertical size="medium">
            <n-alert type="info" :bordered="false">
              适用于需要 Cookie 认证的网站。手动粘贴 Cookie 字符串即可。
            </n-alert>

            <n-form ref="cookieFormRef" :model="cookieForm" label-placement="left" label-width="80">
              <n-form-item label="域名" path="domain">
                <n-input v-model:value="cookieForm.domain" placeholder="example.com" />
              </n-form-item>

              <n-form-item label="Cookie" path="cookie">
                <n-input
                  type="textarea"
                  v-model:value="cookieForm.cookie"
                  placeholder="key1=value1; key2=value2"
                  :rows="5"
                />
              </n-form-item>

              <n-form-item label="别名" path="name">
                <n-input v-model:value="cookieForm.name" placeholder="如：个人网站" />
              </n-form-item>

              <n-form-item>
                <n-space>
                  <n-button type="primary" :loading="isSaving" @click="handleSaveCookie">
                    保存
                  </n-button>
                  <n-button @click="cookieForm = { domain: '', cookie: '', name: '' }">
                    重置
                  </n-button>
                </n-space>
              </n-form-item>
            </n-form>
          </n-space>
        </n-tab-pane>

        <!-- Header 注入 -->
        <n-tab-pane name="header" tab="Header 注入">
          <n-space vertical size="medium">
            <n-alert type="info" :bordered="false">
              适用于使用 Bearer Token 或 Basic Auth 的 API 网站。
            </n-alert>

            <n-form ref="headerFormRef" :model="headerForm" label-placement="left" label-width="100">
              <n-form-item label="域名" path="domain">
                <n-input v-model:value="headerForm.domain" placeholder="api.example.com" />
              </n-form-item>

              <n-form-item label="Header Name" path="headerName">
                <n-input v-model:value="headerForm.headerName" placeholder="Authorization" />
              </n-form-item>

              <n-form-item label="Header Value" path="headerValue">
                <n-input v-model:value="headerForm.headerValue" placeholder="Bearer xxx" />
              </n-form-item>

              <n-form-item label="别名" path="name">
                <n-input v-model:value="headerForm.name" placeholder="如：API 认证" />
              </n-form-item>

              <n-form-item>
                <n-space>
                  <n-button type="primary" :loading="isSaving" @click="handleSaveHeader">
                    保存
                  </n-button>
                  <n-button @click="headerForm = { domain: '', headerName: '', headerValue: '', name: '' }">
                    重置
                  </n-button>
                </n-space>
              </n-form-item>
            </n-form>
          </n-space>
        </n-tab-pane>

        <!-- 浏览器登录 -->
        <n-tab-pane name="browser" tab="浏览器登录" :disabled="!hasGuiEnvironment">
          <n-space vertical size="medium">
            <n-alert v-if="!hasGuiEnvironment" type="warning" :bordered="false">
              当前环境不支持弹出浏览器，请使用 Cookie 注入方式
            </n-alert>

            <template v-else>
              <n-alert type="info" :bordered="false">
                适用于需要手动登录的网站（如验证码、2FA）。系统将打开浏览器窗口，您在浏览器中完成登录后点击"完成登录"按钮。
              </n-alert>

              <n-form ref="browserFormRef" :model="browserForm" label-placement="left" label-width="80">
                <n-form-item label="登录页 URL" path="url">
                  <n-input
                    v-model:value="browserForm.url"
                    placeholder="https://github.com/login"
                  />
                </n-form-item>

                <n-form-item label="别名" path="name">
                  <n-input v-model:value="browserForm.name" placeholder="如：个人 GitHub" />
                </n-form-item>

                <n-form-item>
                  <n-space>
                    <n-button
                      type="primary"
                      :loading="isLaunching || browserLoginStatus === 'launched'"
                      @click="handleLaunchBrowser"
                    >
                      启动浏览器
                    </n-button>
                  </n-space>
                </n-form-item>
              </n-form>

              <!-- 浏览器运行状态 -->
              <n-card v-if="browserLoginStatus === 'launched'" title="浏览器运行状态" :bordered="false">
                <n-space vertical>
                  <n-alert type="success" :bordered="false">
                    <template #header>
                      <n-space align="center">
                        <n-icon><CheckmarkCircleOutline /></n-icon>
                        <span>浏览器已启动</span>
                      </n-space>
                    </template>
                    请在打开的浏览器窗口中完成登录操作。完成后请点击下方按钮。
                  </n-alert>

                  <n-alert type="warning" :bordered="false">
                    <template #header>
                      <n-space align="center">
                        <n-icon><WarningOutline /></n-icon>
                        <span>请手动确认登录状态</span>
                      </n-space>
                    </template>
                    系统不会自动检测登录是否成功。请确认您已在浏览器中成功登录后，再点击下方按钮。
                  </n-alert>

                  <n-divider />

                  <n-space>
                    <n-button type="primary" size="large" :loading="isCompleting" @click="handleCompleteLogin">
                      我已完成登录，提取认证信息
                    </n-button>
                    <n-button @click="handleCancelBrowser">
                      取消
                    </n-button>
                  </n-space>
                </n-space>
              </n-card>
            </template>
          </n-space>
        </n-tab-pane>
      </n-tabs>

      <n-divider />

      <!-- 已保存的认证配置 -->
      <n-space vertical size="small">
        <n-text strong>已保存的认证配置</n-text>

        <n-list v-if="authProfiles.length > 0" bordered>
          <n-list-item v-for="profile in authProfiles" :key="profile.id">
            <n-space align="center" justify="space-between" style="width: 100%">
              <n-space align="center">
                <n-tag :type="getAuthTypeColor(profile.type)" size="small">
                  {{ getAuthTypeLabel(profile.type) }}
                </n-tag>
                <n-text>{{ profile.domain }}</n-text>
                <n-text depth="3">{{ profile.name }}</n-text>
              </n-space>

              <n-space align="center">
                <n-button
                  size="small"
                  :type="authProfileId === profile.id ? 'primary' : 'default'"
                  @click="handleSelectProfile(profile.id)"
                >
                  {{ authProfileId === profile.id ? '已选择' : '选择' }}
                </n-button>
                <n-button size="small" type="error" @click="handleDeleteProfile(profile.id)">
                  删除
                </n-button>
              </n-space>
            </n-space>
          </n-list-item>
        </n-list>

        <n-empty v-else description="暂无认证配置" size="small" />
      </n-space>
    </n-collapse-item>
  </n-collapse>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  NCollapse,
  NCollapseItem,
  NTabs,
  NTabPane,
  NSpace,
  NAlert,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NButton,
  NCard,
  NIcon,
  NDivider,
  NText,
  NList,
  NListItem,
  NTag,
  NEmpty,
  useMessage,
} from 'naive-ui';
import {
  LockClosedOutline,
  CheckmarkCircleOutline,
  WarningOutline,
} from '@vicons/ionicons5';
import { useCrawlApi } from '../composables/useCrawlApi';

const props = defineProps<{
  authProfileId?: string;
}>();

const emit = defineEmits<{
  'update:authProfileId': [value: string];
}>();

const message = useMessage();
const crawlApi = useCrawlApi();

// Tab 切换
const activeTab = ref('cookie');

// Cookie 表单
const cookieForm = ref({
  domain: '',
  cookie: '',
  name: '',
});

// Header 表单
const headerForm = ref({
  domain: '',
  headerName: '',
  headerValue: '',
  name: '',
});

// Browser 表单
const browserForm = ref({
  url: '',
  name: '',
});

// 状态
const isSaving = ref(false);
const isLaunching = ref(false);
const isCompleting = ref(false);
const browserLoginStatus = ref<'idle' | 'launched' | 'completed' | 'failed'>('idle');

// GUI 环境检测
const hasGuiEnvironment = ref(true);

// 认证配置列表
const authProfiles = ref<any[]>([]);

// 加载认证配置
const loadAuthProfiles = async () => {
  try {
    const response = await crawlApi.getAuthProfiles();
    authProfiles.value = response.profiles;
  } catch (err) {
    message.error('加载认证配置失败');
  }
};

// 保存认证配置
const handleSaveCookie = async () => {
  if (!cookieForm.value.domain || !cookieForm.value.cookie) {
    message.error('请填写域名和 Cookie');
    return;
  }

  isSaving.value = true;

  try {
    await crawlApi.saveCookieAuth(cookieForm.value);
    message.success('Cookie 认证已保存');
    cookieForm.value = { domain: '', cookie: '', name: '' };
    await loadAuthProfiles();
  } catch (err: any) {
    message.error(err.message || '保存失败');
  } finally {
    isSaving.value = false;
  }
};

const handleSaveHeader = async () => {
  if (!headerForm.value.domain || !headerForm.value.headerName || !headerForm.value.headerValue) {
    message.error('请填写所有字段');
    return;
  }

  isSaving.value = true;

  try {
    await crawlApi.saveHeaderAuth(headerForm.value);
    message.success('Header 认证已保存');
    headerForm.value = { domain: '', headerName: '', headerValue: '', name: '' };
    await loadAuthProfiles();
  } catch (err: any) {
    message.error(err.message || '保存失败');
  } finally {
    isSaving.value = false;
  }
};

const handleLaunchBrowser = async () => {
  if (!browserForm.value.url) {
    message.error('请输入登录页 URL');
    return;
  }

  isLaunching.value = true;

  try {
    await crawlApi.launchBrowser(browserForm.value);
    browserLoginStatus.value = 'launched';
    message.success('浏览器已启动，请在浏览器中完成登录');
  } catch (err: any) {
    if (err.error === 'no_display') {
      hasGuiEnvironment.value = false;
      message.error('当前环境不支持弹出浏览器');
    } else {
      message.error(err.message || '启动失败');
    }
    browserLoginStatus.value = 'failed';
  } finally {
    isLaunching.value = false;
  }
};

const handleCompleteLogin = async () => {
  isCompleting.value = true;

  try {
    await crawlApi.completeBrowserLogin(browserForm.value);
    message.success('认证信息已保存');
    browserLoginStatus.value = 'idle';
    browserForm.value = { url: '', name: '' };
    await loadAuthProfiles();
  } catch (err: any) {
    message.error(err.message || '保存失败');
  } finally {
    isCompleting.value = false;
  }
};

const handleCancelBrowser = () => {
  browserLoginStatus.value = 'idle';
  message.info('已取消浏览器登录');
};

const handleSelectProfile = (profileId: string) => {
  if (props.authProfileId === profileId) {
    emit('update:authProfileId', '');
  } else {
    emit('update:authProfileId', profileId);
  }
};

const handleDeleteProfile = async (profileId: string) => {
  try {
    await crawlApi.deleteAuthProfile(profileId);
    message.success('认证配置已删除');
    await loadAuthProfiles();

    if (props.authProfileId === profileId) {
      emit('update:authProfileId', '');
    }
  } catch (err: any) {
    message.error(err.message || '删除失败');
  }
};

const getAuthTypeColor = (type: string) => {
  const colors: Record<string, any> = {
    cookie: 'info',
    header: 'success',
    browser: 'warning',
  };
  return colors[type] || 'default';
};

const getAuthTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    cookie: 'Cookie',
    header: 'Header',
    browser: 'Browser',
  };
  return labels[type] || type;
};

// 组件挂载时加载数据
onMounted(() => {
  loadAuthProfiles();
});
</script>

<style scoped>
.auth-config-collapse {
  margin-top: 16px;
}
</style>
