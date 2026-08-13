<script lang="ts" setup>
import type { BpmTaskApi } from '#/api/bpm/task';

import { Avatar, Tag } from 'antdv-next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

defineOptions({ name: 'BpmTodoTaskListItem' });

const props = withDefaults(
  defineProps<{
    /** 摘要字段最多展示的条数 */
    maxSummary?: number;
    task: BpmTaskApi.Task;
  }>(),
  {
    maxSummary: 3,
  },
);

dayjs.extend(relativeTime);

function getStartUserInitial() {
  const nickname = props.task.processInstance?.startUser?.nickname;
  return nickname?.trim().slice(0, 1).toUpperCase() || '?';
}

function getAvatarSrc() {
  return props.task.processInstance?.startUser?.avatar || undefined;
}

function getRelativeTime() {
  const time = props.task.processInstance?.createTime;
  return time ? dayjs(time).fromNow() : '-';
}

function getSummaryItems() {
  const summary = props.task.processInstance?.summary;
  return summary && summary.length > 0
    ? summary.slice(0, props.maxSummary)
    : [];
}
</script>

<template>
  <div class="min-w-0">
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

    <div class="mt-2 flex items-center gap-2 text-sm">
      <Avatar :size="24" :src="getAvatarSrc()">
        {{ getStartUserInitial() }}
      </Avatar>
      <span class="text-muted-foreground truncate">
        {{ task.processInstance?.startUser?.nickname || '-' }}
      </span>
      <span class="text-muted-foreground">·</span>
      <span class="text-muted-foreground shrink-0">
        {{ getRelativeTime() }}
      </span>
    </div>

    <div
      v-if="getSummaryItems().length > 0"
      class="text-muted-foreground mt-2 space-y-1 text-sm"
    >
      <div v-for="item in getSummaryItems()" :key="item.key" class="truncate">
        <span class="text-muted-foreground/80">{{ item.key }}：</span>
        <span>{{ item.value }}</span>
      </div>
    </div>
  </div>
</template>
