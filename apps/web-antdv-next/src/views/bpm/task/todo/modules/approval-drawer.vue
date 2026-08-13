<script lang="ts" setup>
import type { SystemUserApi } from '#/api/system/user';

import { nextTick, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useVbenDrawer } from '@vben/common-ui';
import {
  BpmFieldPermissionType,
  BpmModelFormType,
  BpmModelType,
} from '@vben/constants';

import { Alert, Collapse, CollapsePanel, message } from 'antdv-next';

import {
  getApprovalDetail as getApprovalDetailApi,
  getProcessInstanceBpmnModelView,
} from '#/api/bpm/processInstance';
import { setConfAndFields2 } from '#/components/form-create';
import { $t } from '#/locales';
import ProcessInstanceBpmnViewer from '#/views/bpm/processInstance/detail/modules/bpm-viewer.vue';
import BusinessFormView from '#/views/bpm/processInstance/detail/modules/business-form-view.vue';
import FormDataFallback from '#/views/bpm/processInstance/detail/modules/form-data-fallback.vue';
import ProcessInstanceOperationButton from '#/views/bpm/processInstance/detail/modules/operation-button.vue';
import ProcessInstanceSimpleViewer from '#/views/bpm/processInstance/detail/modules/simple-bpm-viewer.vue';
import BpmProcessInstanceTaskList from '#/views/bpm/processInstance/detail/modules/task-list.vue';
import ProcessInstanceTimeline from '#/views/bpm/processInstance/detail/modules/time-line.vue';

defineOptions({ name: 'BpmTodoTaskApprovalDrawer' });

const emit = defineEmits<{
  /** 审批提交成功：taskId 为提交前 Drawer 打开时对应的任务编号 */
  success: [taskId: string];
}>();

const route = useRoute();

const processInstanceId = ref<string>();
const taskId = ref<string>();
const userOptions = ref<SystemUserApi.User[]>([]);
const processInstanceLoading = ref(false);
const processInstance = ref<any>();
const processDefinition = ref<any>({});
const businessFormData = ref<Record<string, any>>();
const processModelView = ref<any>({});
const activityNodes = ref<any[]>([]);
const operationButtonRef = ref();
const taskListRef = ref();
const activeCollapseKeys = ref<string[]>([]);
const formRenderError = ref('');
const diagramLoaded = ref(false);

const fApi = ref<any>();
const detailForm = ref({
  rule: [],
  option: {},
  value: {},
});
const writableFields: string[] = [];

/** 获得审批详情，并据此加载业务表单 / 时间线 / 操作按钮 */
async function getApprovalDetail() {
  if (!processInstanceId.value) return;
  processInstanceLoading.value = true;
  try {
    const data = await getApprovalDetailApi({
      processInstanceId: processInstanceId.value,
      taskId: taskId.value,
    });
    if (!data || !data.processDefinition || !data.processInstance) {
      message.error($t('bpm.todo.drawer.loadFailed'));
      return;
    }

    processInstance.value = data.processInstance;
    processDefinition.value = data.processDefinition;
    businessFormData.value = data.businessFormData;

    if (processDefinition.value.formType === BpmModelFormType.NORMAL) {
      formRenderError.value = '';
      const formFieldsPermission = data.formFieldsPermission;
      writableFields.splice(0);
      if (detailForm.value.rule?.length > 0) {
        detailForm.value.value = processInstance.value.formVariables;
      } else {
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
    console.error('[BpmTodoTaskApprovalDrawer] 获取审批详情失败', error);
    message.error($t('bpm.todo.drawer.loadFailed'));
  } finally {
    processInstanceLoading.value = false;
  }
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

/** 流程图仅在展开"流程图"折叠面板时才加载，保持 Drawer 打开时的响应速度 */
async function loadDiagramIfNeeded() {
  if (diagramLoaded.value || !processInstanceId.value) return;
  diagramLoaded.value = true;
  if (BpmModelType.BPMN === processDefinition.value?.modelType) {
    processModelView.value = { bpmnXml: '' };
  }
  const data = await getProcessInstanceBpmnModelView(processInstanceId.value);
  if (data) {
    processModelView.value = data;
  }
}

watch(activeCollapseKeys, (keys) => {
  if (keys.includes('tasks')) {
    nextTick(() => taskListRef.value?.refresh());
  }
  if (keys.includes('diagram')) {
    loadDiagramIfNeeded();
  }
});

/** 审批操作提交成功：本 ticket 先以关闭 Drawer + 通知列表刷新实现，乐观移除在 T4 落地 */
function handleOperationSuccess() {
  drawerApi.close();
  if (taskId.value) {
    emit('success', taskId.value);
  }
}

const [Drawer, drawerApi] = useVbenDrawer({
  class: '!w-full sm:!w-[760px]',
  footer: true,
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = drawerApi.getData<{
      processInstanceId: string;
      taskId: string;
      userOptions: SystemUserApi.User[];
    }>();
    processInstanceId.value = data?.processInstanceId;
    taskId.value = data?.taskId;
    userOptions.value = data?.userOptions ?? [];
    activeCollapseKeys.value = [];
    diagramLoaded.value = false;
    detailForm.value = { rule: [], option: {}, value: {} };
    await getApprovalDetail();
  },
});

/** "重新发起"等操作会整页跳转，跳转前先关闭 Drawer，避免残留浮层 */
watch(
  () => route.fullPath,
  () => {
    drawerApi.close();
  },
);
</script>

<template>
  <Drawer :title="processInstance?.name || $t('bpm.todo.drawer.title')">
    <template #footer>
      <div class="w-full overflow-x-auto">
        <ProcessInstanceOperationButton
          v-if="processInstance"
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
    </template>

    <div v-loading="processInstanceLoading">
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
        <CollapsePanel key="diagram" :header="$t('bpm.todo.drawer.diagram')">
          <ProcessInstanceSimpleViewer
            v-show="
              processDefinition?.modelType &&
              processDefinition.modelType === BpmModelType.SIMPLE
            "
            :loading="processInstanceLoading"
            :model-view="processModelView"
          />
          <ProcessInstanceBpmnViewer
            v-show="
              processDefinition?.modelType &&
              processDefinition.modelType === BpmModelType.BPMN
            "
            :loading="processInstanceLoading"
            :model-view="processModelView"
          />
        </CollapsePanel>
      </Collapse>
    </div>
  </Drawer>
</template>
