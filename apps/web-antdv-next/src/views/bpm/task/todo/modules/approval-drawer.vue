<script lang="ts" setup>
import type { SystemUserApi } from '#/api/system/user';

import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useVbenDrawer } from '@vben/common-ui';

import { $t } from '#/locales';

import ApprovalPanel from './approval-panel.vue';

defineOptions({ name: 'BpmTodoTaskApprovalDrawer' });

const emit = defineEmits<{
  /** 审批提交成功：taskId 为提交前 Drawer 打开时对应的任务编号 */
  success: [taskId: string];
}>();

const route = useRoute();

const processInstanceId = ref<string>();
const taskId = ref<string>();
const userOptions = ref<SystemUserApi.User[]>([]);
const panelRef = ref<InstanceType<typeof ApprovalPanel>>();
const title = computed(() => panelRef.value?.title);

const [Drawer, drawerApi] = useVbenDrawer({
  class: '!w-full sm:!w-[760px]',
  footer: false,
  destroyOnClose: true,
  onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = drawerApi.getData<{
      processInstanceId: string;
      taskId: string;
      userOptions: SystemUserApi.User[];
    }>();
    processInstanceId.value = data?.processInstanceId;
    taskId.value = data?.taskId;
    userOptions.value = data?.userOptions ?? [];
  },
});

function handleSuccess(id: string) {
  drawerApi.close();
  emit('success', id);
}

/** "重新发起"等操作会整页跳转，跳转前先关闭 Drawer，避免残留浮层 */
watch(
  () => route.fullPath,
  () => {
    drawerApi.close();
  },
);
</script>

<template>
  <Drawer :title="title || $t('bpm.todo.drawer.title')">
    <ApprovalPanel
      ref="panelRef"
      :process-instance-id="processInstanceId"
      :task-id="taskId"
      :user-options="userOptions"
      @success="handleSuccess"
    />
  </Drawer>
</template>
