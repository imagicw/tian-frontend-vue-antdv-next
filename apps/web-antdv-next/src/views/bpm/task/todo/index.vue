<script lang="ts" setup>
import type { BpmTaskApi } from '#/api/bpm/task';

import { onMounted } from 'vue';

import { useAccess } from '@vben/access';
import { DocAlert, Page } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { Avatar, Button, Card, Col, Empty, Row, Spin, Tag } from 'antdv-next';

import { $t } from '#/locales';
import { router } from '#/router';

import { useTodoTaskList } from './useTodoTaskList';

defineOptions({ name: 'BpmTodoTask' });

const { hasAccessByCodes } = useAccess();

const { list, loading, hasMore, loadFirstPage, loadMore } = useTodoTaskList();

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

/** 办理任务：跳转到流程实例详情页 */
function handleAudit(task: BpmTaskApi.Task) {
  if (!hasAccessByCodes(['bpm:task:query'])) return;
  router.push({
    name: 'BpmProcessInstanceDetail',
    query: {
      id: task.processInstance!.id,
      taskId: task.id,
    },
  });
}

onMounted(() => {
  loadFirstPage();
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
  </Page>
</template>

<style lang="scss" scoped>
.todo-task-card {
  cursor: pointer;
}
</style>
