<script lang="ts" setup>
import type { SystemUserApi } from '#/api/system/user';

import { computed, nextTick, ref, watch } from 'vue';

import { BpmFieldPermissionType, BpmModelFormType } from '@vben/constants';

import { Alert, Collapse, CollapsePanel, message } from 'antdv-next';

import { getApprovalDetail as getApprovalDetailApi } from '#/api/bpm/processInstance';
import { setConfAndFields2 } from '#/components/form-create';
import { $t } from '#/locales';
import BusinessFormView from '#/views/bpm/processInstance/detail/modules/business-form-view.vue';
import FormDataFallback from '#/views/bpm/processInstance/detail/modules/form-data-fallback.vue';
import ProcessInstanceOperationButton from '#/views/bpm/processInstance/detail/modules/operation-button.vue';
import BpmProcessInstanceTaskList from '#/views/bpm/processInstance/detail/modules/task-list.vue';
import ProcessInstanceTimeline from '#/views/bpm/processInstance/detail/modules/time-line.vue';

defineOptions({ name: 'BpmTodoTaskApprovalPanel' });

/**
 * 审批详情内容：不依赖 Drawer 容器，桌面端主从布局的右栏面板和移动端
 * approval-drawer.vue 共用同一份逻辑与模板，避免两端行为漂移。
 */
const props = defineProps<{
  processInstanceId?: string;
  taskId?: string;
  userOptions: SystemUserApi.User[];
}>();

const emit = defineEmits<{
  /** 审批提交成功：taskId 为提交前对应的任务编号 */
  success: [taskId: string];
}>();

const processInstanceLoading = ref(false);
const processInstance = ref<any>();
const processDefinition = ref<any>({});
const businessFormData = ref<Record<string, any>>();
const activityNodes = ref<any[]>([]);
const operationButtonRef = ref();
const taskListRef = ref();
/** 审批时间线默认展开；流转记录默认收起 */
const activeCollapseKeys = ref<string[]>(['timeline']);
const formRenderError = ref('');

const fApi = ref<any>();
const detailForm = ref({
  rule: [],
  option: {},
  value: {},
});
const writableFields: string[] = [];

/** 重置所有随任务切换而失效的状态，必须在每次加载新任务前调用 */
function resetTaskState() {
  activeCollapseKeys.value = ['timeline'];
  detailForm.value = { rule: [], option: {}, value: {} };
  writableFields.splice(0);
  formRenderError.value = '';
  processInstance.value = undefined;
  processDefinition.value = {};
  businessFormData.value = undefined;
  activityNodes.value = [];
}

function setFieldPermission(field: string, permission: string) {
  if (permission === BpmFieldPermissionType.READ) {
    fApi.value?.disabled(true, field);
  }
  if (permission === BpmFieldPermissionType.WRITE) {
    fApi.value?.disabled(false, field);
    writableFields.push(field);
  }
  if (permission === BpmFieldPermissionType.NONE) {
    fApi.value?.hidden(true, field);
  }
}

/** 获得审批详情，并据此加载业务表单 / 时间线 / 操作按钮 */
async function getApprovalDetail() {
  if (!props.processInstanceId) return;
  processInstanceLoading.value = true;
  try {
    const data = await getApprovalDetailApi({
      processInstanceId: props.processInstanceId,
      taskId: props.taskId,
    });
    if (!data || !data.processDefinition || !data.processInstance) {
      message.error($t('bpm.todo.drawer.loadFailed'));
      return;
    }

    processInstance.value = data.processInstance;
    processDefinition.value = data.processDefinition;
    businessFormData.value = data.businessFormData;

    if (processDefinition.value.formType === BpmModelFormType.NORMAL) {
      const formFieldsPermission = data.formFieldsPermission;
      try {
        setConfAndFields2(
          detailForm,
          processDefinition.value.formConf,
          processDefinition.value.formFields ?? [],
          processInstance.value.formVariables,
        );
      } catch {
        detailForm.value.rule = [];
        detailForm.value.value = processInstance.value.formVariables ?? {};
        formRenderError.value = $t('bpm.todo.drawer.formParseFailed');
      }
      await nextTick();
      fApi.value?.btn.show(false);
      fApi.value?.resetBtn.show(false);
      fApi.value?.disabled(true);
      if (formFieldsPermission) {
        Object.keys(formFieldsPermission).forEach((field) => {
          setFieldPermission(field, formFieldsPermission[field]);
        });
      }
    }

    activityNodes.value = data.activityNodes;

    await nextTick();
    operationButtonRef.value?.loadTodoTask(data.todoTask);
  } catch (error) {
    console.error('[BpmTodoTaskApprovalPanel] 获取审批详情失败', error);
    message.error($t('bpm.todo.drawer.loadFailed'));
  } finally {
    processInstanceLoading.value = false;
  }
}

watch(activeCollapseKeys, (keys) => {
  if (keys.includes('tasks')) {
    nextTick(() => taskListRef.value?.refresh());
  }
});

/** 任务切换（不同任务、甚至不同流程定义）时，必须先清空上一个任务的状态再加载 */
watch(
  () => [props.processInstanceId, props.taskId],
  () => {
    resetTaskState();
    getApprovalDetail();
  },
  { immediate: true },
);

function handleOperationSuccess() {
  if (props.taskId) {
    emit('success', props.taskId);
  }
}

defineExpose({
  getApprovalDetail,
  title: computed(() => processInstance.value?.name),
});
</script>

<template>
  <div v-loading="processInstanceLoading" class="flex h-full min-h-0 flex-col">
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div v-if="processDefinition?.formType === BpmModelFormType.NORMAL">
        <Alert
          v-if="formRenderError"
          :message="formRenderError"
          class="mb-4"
          show-icon
          type="warning"
        />
        <form-create
          v-if="detailForm.rule.length > 0"
          v-model="detailForm.value"
          v-model:api="fApi"
          :option="detailForm.option"
          :rule="detailForm.rule"
        />
        <FormDataFallback
          v-else
          :form-variables="processInstance?.formVariables"
          :summary="processInstance?.summary"
        />
      </div>
      <BusinessFormView
        v-else-if="processDefinition?.formType === BpmModelFormType.CUSTOM"
        :process-definition="processDefinition"
        :process-instance="processInstance"
        :business-form-data="businessFormData"
      />
      <Alert
        v-else-if="processDefinition?.formType"
        :message="$t('bpm.todo.drawer.formTypeUnsupported')"
        show-icon
        type="warning"
      />

      <Collapse v-model:active-key="activeCollapseKeys" class="mt-4" ghost>
        <CollapsePanel key="timeline" :header="$t('bpm.todo.drawer.timeline')">
          <ProcessInstanceTimeline :activity-nodes="activityNodes" />
        </CollapsePanel>
        <CollapsePanel key="tasks" :header="$t('bpm.todo.drawer.taskList')">
          <BpmProcessInstanceTaskList
            v-if="processInstanceId"
            ref="taskListRef"
            :id="processInstanceId"
            :loading="processInstanceLoading"
          />
        </CollapsePanel>
      </Collapse>
    </div>

    <div
      v-if="processInstance"
      class="mt-4 w-full shrink-0 overflow-x-auto border-t pt-4"
    >
      <ProcessInstanceOperationButton
        ref="operationButtonRef"
        :process-instance="processInstance"
        :process-definition="processDefinition"
        :user-options="userOptions"
        :normal-form="detailForm"
        :normal-form-api="fApi"
        :writable-fields="writableFields"
        @success="handleOperationSuccess"
      />
    </div>
  </div>
</template>
