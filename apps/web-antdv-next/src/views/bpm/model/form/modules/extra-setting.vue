<script setup lang="ts">
import type { BpmModelApi } from '#/api/bpm/model';

import { computed, ref, watch } from 'vue';

import { BpmModelFormType } from '@vben/constants';

import {
  Checkbox,
  Col,
  Form,
  FormItem,
  Radio,
  RadioGroup,
  Row,
  Select,
  TypographyText,
} from 'antdv-next';

import { getForm } from '#/api/bpm/form';
import { parseFormFields } from '#/components/form-create';
import {
  getBusinessFormSummaryFields,
  resolveBusinessFormViewPath,
} from '#/utils/business-form';

interface ExtraSettingModel {
  formType?: number;
  formCustomViewPath?: string;
  summarySetting?: BpmModelApi.SummarySetting;
  [key: string]: any;
}

const modelData = defineModel<ExtraSettingModel>({ required: true });

/** 表单字段 */
const formFields = ref<Array<{ field: string; title: string }>>([]);
const formFieldOptions4Summary = computed(() => {
  if (modelData.value.formType === BpmModelFormType.CUSTOM) {
    return getBusinessFormSummaryFields(
      resolveBusinessFormViewPath(modelData.value.formCustomViewPath),
    ).map((item) => ({ label: item.label, value: item.key }));
  }
  return formFields.value.map((item) => {
    return {
      label: item.title,
      value: item.field,
    };
  });
});

/** 兼容以前未配置更多设置的流程 */
function initData() {
  if (!modelData.value.summarySetting) {
    modelData.value.summarySetting = {
      enable: false,
      summary: [],
    };
  }
  if (modelData.value.allowCancelRunningProcess === undefined) {
    modelData.value.allowCancelRunningProcess = true;
  }
  if (modelData.value.allowWithdrawTask === undefined) {
    modelData.value.allowWithdrawTask = false;
  }
}

/** 监听表单 ID 变化，加载表单数据 */
watch(
  () => modelData.value.formId,
  async (newFormId) => {
    if (newFormId && modelData.value.formType === BpmModelFormType.NORMAL) {
      const data = await getForm(newFormId);
      const result: Array<{ field: string; title: string }> = [];
      if (data.fields) {
        data.fields.forEach((fieldStr: string) => {
          parseFormFields(JSON.parse(fieldStr), result);
        });
      }
      formFields.value = result;
    } else {
      formFields.value = [];
    }
  },
  { immediate: true },
);
const formRef = ref(); // 表单引用

/** 表单校验 */
async function validate() {
  await formRef.value?.validate();
}

defineExpose({ initData, validate });
</script>
<template>
  <Form
    ref="formRef"
    :model="modelData"
    :label-col="{ span: 4 }"
    :wrapper-col="{ span: 20 }"
    class="mt-5 px-5"
  >
    <FormItem class="mb-5" label="提交人权限">
      <div class="mt-1 flex flex-col">
        <Checkbox v-model:checked="modelData.allowCancelRunningProcess">
          允许撤销审批中的申请
        </Checkbox>
      </div>
    </FormItem>
    <FormItem class="mb-5" label="审批人权限">
      <div class="mt-1 flex flex-col">
        <Checkbox v-model:checked="modelData.allowWithdrawTask">
          允许审批人撤回任务
        </Checkbox>
        <div class="ml-6">
          <TypographyText type="secondary">
            审批人可撤回正在审批节点的前一节点
          </TypographyText>
        </div>
      </div>
    </FormItem>
    <FormItem v-if="modelData.summarySetting" class="mb-5" label="摘要设置">
      <div class="mt-1">
        <RadioGroup v-model:value="modelData.summarySetting.enable">
          <Row :gutter="[0, 8]">
            <Col :span="24">
              <Radio :value="false">
                系统默认
                <TypographyText type="secondary">
                  {{
                    modelData.formType === BpmModelFormType.CUSTOM
                      ? '不展示摘要'
                      : '展示表单前 3 个字段'
                  }}
                </TypographyText>
              </Radio>
            </Col>
            <Col :span="24">
              <Radio :value="true"> 自定义摘要 </Radio>
            </Col>
          </Row>
        </RadioGroup>
        <div class="mt-2">
          <Select
            v-if="modelData.summarySetting.enable"
            v-model:value="modelData.summarySetting.summary"
            mode="multiple"
            placeholder="请选择要展示的表单字段"
            :options="formFieldOptions4Summary"
          />
        </div>
      </div>
    </FormItem>
  </Form>
</template>
