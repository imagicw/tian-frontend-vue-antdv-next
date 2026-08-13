<script lang="ts" setup>
import type { BpmCategoryApi } from '#/api/bpm/category';
import type { BpmTaskApi } from '#/api/bpm/task';
import type { SystemUserApi } from '#/api/system/user';

import { computed, onMounted, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { ColPage, DocAlert, Page, useVbenDrawer } from '@vben/common-ui';
import { useIsMobile } from '@vben/hooks';
import { IconifyIcon } from '@vben/icons';

import {
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Result,
  Row,
  Spin,
} from 'antdv-next';

import { getCategorySimpleList } from '#/api/bpm/category';
import { getSimpleUserList } from '#/api/system/user';
import { $t } from '#/locales';

import ApprovalDrawerForm from './modules/approval-drawer.vue';
import ApprovalPanel from './modules/approval-panel.vue';
import FilterPanel from './modules/filter-panel.vue';
import TaskListItem from './modules/task-list-item.vue';
import { useTodoTaskList } from './useTodoTaskList';

defineOptions({ name: 'BpmTodoTask' });

const { hasAccessByCodes } = useAccess();
const { isMobile } = useIsMobile();
/** md 以上宽度：桌面主从布局；窄屏保持卡片列表 + Drawer */
const isSplitView = computed(() => !isMobile.value);
const canQueryTask = computed(() => hasAccessByCodes(['bpm:task:query']));

const {
  list,
  loading,
  hasMore,
  total,
  loadFirstPage,
  loadMore,
  removeTaskOptimistic,
} = useTodoTaskList();

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
const selectedTaskId = ref<string>();

const categoryOptions = computed(() =>
  categories.value.map((item) => ({ label: item.name, value: item.code })),
);
const activeFilterCount = computed(
  () => [filterCategory.value, filterCreateTime.value].filter(Boolean).length,
);
const hasActiveFilter = computed(
  () => Boolean(searchName.value) || activeFilterCount.value > 0,
);
/** 无筛选条件下待办已清零：与“筛选无结果”的普通空状态区分开的专属庆祝态 */
const isAllDone = computed(
  () => !loading.value && total.value === 0 && !hasActiveFilter.value,
);

const selectedTask = computed<BpmTaskApi.Task | undefined>(() =>
  list.value.find((task) => task.id === selectedTaskId.value),
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

/** 桌面主从布局：点击任务只切换右栏选中项 */
function handleSelect(task: BpmTaskApi.Task) {
  if (!canQueryTask.value) return;
  selectedTaskId.value = task.id;
}

/** 窄屏：点击任务打开 Drawer 就地审批 */
function handleAudit(task: BpmTaskApi.Task) {
  if (!canQueryTask.value) return;
  approvalDrawerApi
    .setData({
      processInstanceId: task.processInstance!.id,
      taskId: task.id,
      userOptions: userOptions.value,
    })
    .open();
}

/** 审批提交成功：乐观地从列表中移除对应卡片，桌面端自动切换到新的下一条 */
function handleApprovalSuccess(taskId: string) {
  const { nextTaskId } = removeTaskOptimistic(taskId);
  if (isSplitView.value) {
    selectedTaskId.value = nextTaskId;
  }
}

/** 列表变化后（首次加载、筛选、乐观移除）保证桌面右栏始终有一个有效的选中项 */
watch(list, (newList) => {
  if (!isSplitView.value || !canQueryTask.value) return;
  if (newList.length === 0) {
    selectedTaskId.value = undefined;
    return;
  }
  const stillExists = newList.some((task) => task.id === selectedTaskId.value);
  if (!stillExists) {
    selectedTaskId.value = newList[0]?.id;
  }
});

onMounted(() => {
  queryList();
  loadCategories();
  loadUserOptions();
});
</script>

<template>
  <Page v-if="isAllDone" auto-content-height>
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
    </template>
    <Result
      status="success"
      :title="$t('bpm.todo.celebration.title')"
      :sub-title="$t('bpm.todo.celebration.subtitle')"
    />
  </Page>

  <ColPage
    v-else-if="isSplitView"
    auto-content-height
    :height-offset="32"
    content-class="bg-card m-4 overflow-hidden rounded-lg border p-4 shadow-sm"
    :left-width="32"
    :left-min-width="22"
    :left-max-width="45"
    :right-width="68"
    resizable
    split-line
    split-handle
  >
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
    </template>

    <template #left>
      <div class="bg-muted/30 flex h-full min-h-0 flex-col gap-3 p-4">
        <div class="flex shrink-0 items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="text-foreground font-medium">
              {{ $t('bpm.todo.total') }}
            </span>
            <Badge :count="total" :overflow-count="99" color="blue" />
          </div>
          <Button type="text" size="small" @click="queryList">
            <IconifyIcon icon="lucide:refresh-cw" />
            {{ $t('bpm.todo.refresh') }}
          </Button>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <Input
            v-model:value="searchName"
            allow-clear
            :placeholder="$t('bpm.todo.searchPlaceholder')"
            @change="!searchName && queryList()"
            @press-enter="queryList"
          />
          <Badge :count="activeFilterCount" size="small">
            <Button @click="filterOpen = !filterOpen">
              <IconifyIcon icon="lucide:filter" />
            </Button>
          </Badge>
        </div>

        <FilterPanel
          v-model:category="filterCategory"
          v-model:create-time="filterCreateTime"
          v-model:open="filterOpen"
          :category-options="categoryOptions"
          :is-mobile="false"
          @apply="handleFilterApply"
          @reset="handleFilterReset"
        />

        <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <Spin :spinning="loading && list.length === 0">
            <Empty
              v-if="!loading && list.length === 0"
              :description="$t('bpm.todo.emptyFiltered')"
            />

            <div v-else class="flex flex-col gap-2 pb-1">
              <div
                v-for="task in list"
                :key="task.id"
                class="bg-card cursor-pointer rounded-lg border p-3 shadow-sm transition-all"
                :class="
                  task.id === selectedTaskId
                    ? 'border-primary ring-primary/15 shadow-md ring-2'
                    : 'border-border/60 hover:border-primary/40 hover:shadow-md'
                "
                @click="handleSelect(task)"
              >
                <TaskListItem :task="task" :max-summary="2" />
              </div>
            </div>
          </Spin>
        </div>

        <div v-if="list.length > 0" class="flex shrink-0 justify-center py-2">
          <Button
            v-if="hasMore"
            :loading="loading"
            size="small"
            @click="loadMore"
          >
            {{ $t('bpm.todo.loadMore') }}
          </Button>
          <span v-else class="text-muted-foreground text-sm">
            {{ $t('bpm.todo.noMore') }}
          </span>
        </div>
      </div>
    </template>

    <div class="h-full min-h-0 p-5">
      <ApprovalPanel
        v-if="selectedTask"
        :key="selectedTask.id"
        :process-instance-id="String(selectedTask.processInstance!.id)"
        :task-id="selectedTask.id"
        :user-options="userOptions"
        @success="handleApprovalSuccess"
      />
      <div
        v-else
        class="text-muted-foreground flex h-full items-center justify-center"
      >
        {{ $t('bpm.todo.noSelection') }}
      </div>
    </div>
  </ColPage>

  <Page v-else auto-content-height>
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
            <Empty :description="$t('bpm.todo.emptyFiltered')" />
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
                <TaskListItem :task="task" />
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
