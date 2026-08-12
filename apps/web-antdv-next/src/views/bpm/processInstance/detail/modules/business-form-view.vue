<script setup lang="ts">
import type { BpmModelApi } from '#/api/bpm/model';
import type { BpmProcessInstanceApi } from '#/api/bpm/processInstance';

import { computed, onErrorCaptured, ref } from 'vue';

import { Alert } from 'antdv-next';

import { registerComponent } from '#/utils';
import { resolveBusinessFormViewPath } from '#/utils/business-form';

import FormDataFallback from './form-data-fallback.vue';

const props = withDefaults(
  defineProps<{
    businessFormData?: Record<string, any>;
    printMode?: boolean;
    processDefinition?: BpmModelApi.ProcessDefinition;
    processInstance?: BpmProcessInstanceApi.ProcessInstance;
  }>(),
  {
    businessFormData: undefined,
    printMode: false,
    processDefinition: undefined,
    processInstance: undefined,
  },
);

const loadError = ref(false);
const configuredPath = computed(
  () => props.processDefinition?.formCustomViewPath ?? '',
);
const resolvedPath = computed(() =>
  resolveBusinessFormViewPath(configuredPath.value),
);
const businessFormComponent = computed(() =>
  resolvedPath.value ? registerComponent(resolvedPath.value) : undefined,
);

onErrorCaptured(() => {
  loadError.value = true;
  return false;
});
</script>

<template>
  <div class="space-y-4">
    <Alert
      v-if="!businessFormComponent || loadError"
      :message="loadError ? '业务表单加载失败' : '业务表单未正确配置'"
      :description="
        configuredPath
          ? `未找到查看组件：${configuredPath}`
          : '请在流程模型的表单设计中配置业务表单查看组件。'
      "
      show-icon
      type="warning"
    />
    <component
      v-if="businessFormComponent && !loadError"
      :is="businessFormComponent"
      :id="processInstance?.businessKey"
      :data="businessFormData"
      :business-key="processInstance?.businessKey"
      :process-instance="processInstance"
      :process-definition="processDefinition"
      :readonly="true"
      :print-mode="printMode"
    />
    <FormDataFallback
      v-else
      :form-variables="businessFormData ?? processInstance?.formVariables"
      :summary="processInstance?.summary"
    />
  </div>
</template>
