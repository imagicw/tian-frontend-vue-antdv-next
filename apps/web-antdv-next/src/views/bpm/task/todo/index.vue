<script lang="ts" setup>
import type { BpmCategoryApi } from '#/api/bpm/category';
import type { BpmTaskApi } from '#/api/bpm/task';
import type { SystemUserApi } from '#/api/system/user';

import { computed, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { DocAlert, Page, useVbenDrawer } from '@vben/common-ui';
import { useIsMobile } from '@vben/hooks';
import { IconifyIcon } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import {
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Spin,
  Tag,
} from 'antdv-next';

import { getCategorySimpleList } from '#/api/bpm/category';
import { getSimpleUserList } from '#/api/system/user';
import { $t } from '#/locales';

import ApprovalDrawerForm from './modules/approval-drawer.vue';
import FilterPanel from './modules/filter-panel.vue';
import { useTodoTaskList } from './useTodoTaskList';

defineOptions({ name: 'BpmTodoTask' });

const { hasAccessByCodes } = useAccess();
const { isMobile } = useIsMobile();

const { list, loading, hasMore, loadFirstPage, loadMore } = useTodoTaskList();

const userOptions = ref<SystemUserApi.User[]>([]);

const [ApprovalDrawer, approvalDrawerApi] = useVbenDrawer({
  connectedComponent: ApprovalDrawerForm,
  destroyOnClose: true,
});

const searchName = ref<string>();
const filterOpen = ref(false);
const filterCategory = ref<string>();
const filterCreateTime = ref<[string, string]>();
const categories = ref<BpmCategoryApi.Category[]>([]);

const categoryOptions = computed(() =>
  categories.value.map((item) => ({ label: item.name, value: item.code })),
);
const activeFilterCount = computed(
  () => [filterCategory.value, filterCreateTime.value].filter(Boolean).length,
);

function queryList() {
  loadFirstPage({
    name: searchName.value || undefined,
    category: filterCategory.value,
    createTime: filterCreateTime.value,
  });
}

function handleFilterApply() {
  filterOpen.value = false;
  queryList();
}

function handleFilterReset() {
  filterCategory.value = undefined;
  filterCreateTime.value = undefined;
  filterOpen.value = false;
  queryList();
}

async function loadCategories() {
  try {
    categories.value = await getCategorySimpleList();
  } catch {
    categories.value = [];
  }
}

async function loadUserOptions() {
  try {
    userOptions.value = await getSimpleUserList();
  } catch {
    userOptions.value = [];
  }
}

/** 拼接流程摘要（全量展示，不展示当前节点名称） */
function getSummaryText(task: BpmTaskApi.Task) {
  const summary = task.processInstance?.summary;
  return summary && summary.length > 0
    ? summary.map((item) => `${item.key}：${item.value}`).join('  ')
    : '-';
}

function getStartUserInitial(task: BpmTaskApi.Task) {
  const nickname = task.processInstance?.startUser?.nickname;
  return nickname?.trim().slice(0, 1).toUpperCase() || '?';
}

/** 办理任务：打开 Drawer 就地审批 */
function handleAudit(task: BpmTaskApi.Task) {
  if (!hasAccessByCodes(['bpm:task:query'])) return;
  approvalDrawerApi
    .setData({
      processInstanceId: task.processInstance!.id,
      taskId: task.id,
      userOptions: userOptions.value,
    })
    .open();
}

/** 审批提交成功：重新拉取当前页数据（乐观移除在 T4 落地） */
function handleApprovalSuccess() {
  queryList();
}

onMounted(() => {
  queryList();
  loadCategories();
  loadUserOptions();
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="审批通过、不通过、驳回"
        url="https://doc.iocoder.cn/bpm/task-todo-done/"
      />
      <DocAlert title="审批加签、减签" url="https://doc.iocoder.cn/bpm/sign/" />
      <DocAlert
        title="审批转办、委派、抄送"
        url="https://doc.iocoder.cn/bpm/task-delegation-and-cc/"
      />
      <DocAlert title="审批加签、减签" url="https://doc.iocoder.cn/bpm/sign/" />
    </template>

    <div class="flex h-full min-h-0 flex-col gap-3">
      <div class="flex shrink-0 items-center gap-2">
        <Input
          v-model:value="searchName"
          allow-clear
          class="max-w-xs"
          :placeholder="$t('bpm.todo.searchPlaceholder')"
          @change="!searchName && queryList()"
          @press-enter="queryList"
        />
        <Button @click="queryList">
          <IconifyIcon icon="lucide:search" />
        </Button>
        <Badge :count="activeFilterCount" size="small">
          <Button @click="filterOpen = !filterOpen">
            <IconifyIcon icon="lucide:filter" />
            {{ $t('bpm.todo.filter.title') }}
          </Button>
        </Badge>
      </div>

      <FilterPanel
        v-model:category="filterCategory"
        v-model:create-time="filterCreateTime"
        v-model:open="filterOpen"
        :category-options="categoryOptions"
        :is-mobile="isMobile"
        @apply="handleFilterApply"
        @reset="handleFilterReset"
      />

      <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1 pb-1">
        <Spin :spinning="loading && list.length === 0">
          <Card
            v-if="!loading && list.length === 0"
            class="shadow-sm"
            :body-style="{ padding: '40px 16px' }"
          >
            <Empty :description="$t('bpm.todo.empty')" />
          </Card>

          <Row v-else :gutter="[16, 16]">
            <Col
              v-for="task in list"
              :key="task.id"
              class="min-w-0"
              :xs="24"
              :md="12"
              :xxl="8"
            >
              <Card
                class="todo-task-card h-full overflow-hidden shadow-sm"
                hoverable
                :body-style="{ padding: '16px' }"
                @click="handleAudit(task)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div
                    class="text-foreground min-w-0 truncate font-semibold"
                    :title="task.processInstance?.name"
                  >
                    {{ task.processInstance?.name }}
                  </div>
                  <Tag
                    v-if="task.processInstance?.categoryName"
                    color="blue"
                    class="shrink-0"
                  >
                    {{ task.processInstance?.categoryName }}
                  </Tag>
                </div>

                <div class="mt-3 flex items-center gap-2 text-sm">
                  <Avatar :size="24">
                    {{ getStartUserInitial(task) }}
                  </Avatar>
                  <span class="text-muted-foreground truncate">
                    {{ task.processInstance?.startUser?.nickname || '-' }}
                  </span>
                  <span class="text-muted-foreground">·</span>
                  <span class="text-muted-foreground shrink-0">
                    {{ formatDateTime(task.processInstance?.createTime) }}
                  </span>
                </div>

                <div class="text-muted-foreground mt-3 line-clamp-3 text-sm">
                  {{ getSummaryText(task) }}
                </div>
              </Card>
            </Col>
          </Row>
        </Spin>
      </div>

      <div v-if="list.length > 0" class="flex justify-center py-2">
        <Button v-if="hasMore" :loading="loading" @click="loadMore">
          {{ $t('bpm.todo.loadMore') }}
        </Button>
        <span v-else class="text-muted-foreground text-sm">
          {{ $t('bpm.todo.noMore') }}
        </span>
      </div>
    </div>

    <ApprovalDrawer @success="handleApprovalSuccess" />
  </Page>
</template>

<style lang="scss" scoped>
.todo-task-card {
  cursor: pointer;
}
</style>
