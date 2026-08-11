<script lang="ts" setup>
import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message, Upload } from 'antdv-next';
import dayjs from 'dayjs';

import { useVbenForm } from '#/adapter/form';
import { uploadOrderFile } from '#/api/finance/ec';

import { PLATFORM_OPTIONS } from '../data';

const emit = defineEmits(['success']);

const fileRef = ref<File>();

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    formItemClass: 'col-span-2',
    labelWidth: 90,
  },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'platform',
      label: '平台',
      component: 'Select',
      componentProps: { options: PLATFORM_OPTIONS, placeholder: '请选择平台' },
      rules: 'required',
    },
    {
      fieldName: 'billingYear',
      label: '账期年份',
      component: 'InputNumber',
      componentProps: {
        class: '!w-full',
        min: 2024,
        max: 2050,
        placeholder: '账期年份',
      },
      defaultValue: new Date().getFullYear(),
      rules: 'required',
    },
    {
      fieldName: 'billingPeriodRange',
      label: '账期',
      component: 'RangePicker',
      componentProps: {
        format: 'MM.DD',
        valueFormat: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
      },
      rules: 'required',
    },
    {
      fieldName: 'file',
      label: '订单文件',
      component: 'Input',
      dependencies: { triggerFields: [''], show: () => false },
      rules: 'required',
    },
  ],
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid || !fileRef.value) {
      if (!fileRef.value) message.warning('请先选择订单文件');
      return;
    }
    modalApi.lock();
    const values = await formApi.getValues();
    const [start, end] = values.billingPeriodRange as string[];
    const billingPeriod = `${dayjs(start).format('MM.DD')}-${dayjs(end).format('MM.DD')}`;
    try {
      const taskId = await uploadOrderFile({
        file: fileRef.value,
        platform: values.platform,
        billingYear: values.billingYear,
        billingPeriod,
      });
      await modalApi.close();
      emit('success', taskId, values.platform);
      message.success('订单导入成功，请预览并确认扣减');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      fileRef.value = undefined;
      formApi.resetForm();
    }
  },
});

function beforeUpload(file: File) {
  fileRef.value = file;
  formApi.setFieldValue('file', file.name);
  return false;
}
</script>

<template>
  <Modal class="w-[560px]" title="导入订单数据">
    <Form class="mx-4">
      <template #file>
        <Upload
          :show-upload-list="false"
          accept=".xls,.xlsx,.csv"
          :before-upload="beforeUpload"
        >
          <Button type="primary">选择订单文件</Button>
          <span v-if="fileRef" class="ml-2 text-sm text-gray-500">{{
            fileRef.name
          }}</span>
        </Upload>
      </template>
    </Form>
    <div class="mx-4 mt-2 text-sm text-gray-400">
      支持 .xls / .xlsx / .csv 格式
    </div>
  </Modal>
</template>
