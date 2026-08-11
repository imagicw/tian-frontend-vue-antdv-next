<script lang="ts" setup>
import type { DormApi } from '#/api/dorm';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { createArea, updateArea } from '#/api/dorm';

import { DORM_TIMEZONE_OPTIONS } from '../timezones';

const emit = defineEmits<{ success: [] }>();

const CURRENCY_OPTIONS = [
  { label: 'USD - 美元', value: 'USD' },
  { label: 'CNY - 人民币', value: 'CNY' },
  { label: 'EUR - 欧元', value: 'EUR' },
  { label: 'GBP - 英镑', value: 'GBP' },
  { label: 'JPY - 日元', value: 'JPY' },
  { label: 'SGD - 新加坡元', value: 'SGD' },
];

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    formItemClass: 'col-span-2',
    labelWidth: 96,
  },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: { triggerFields: [''], show: () => false },
    },
    {
      fieldName: 'areaName',
      label: '区域名称',
      component: 'Input',
      componentProps: {
        maxlength: 50,
        placeholder: '例如：上海总部宿舍',
        showCount: true,
      },
      rules: 'required',
    },
    {
      fieldName: 'regionName',
      label: '国家 / 地区',
      component: 'Input',
      componentProps: { placeholder: '例如：中国、美国、新加坡' },
    },
    {
      fieldName: 'timeZone',
      label: '时区',
      component: 'Select',
      componentProps: {
        options: DORM_TIMEZONE_OPTIONS,
        placeholder: '请选择时区',
        allowClear: true,
        optionFilterProp: 'label',
        showSearch: true,
      },
    },
    {
      fieldName: 'settleCurrencyCode',
      label: '结算币种',
      component: 'Select',
      componentProps: {
        options: CURRENCY_OPTIONS,
        placeholder: '请选择结算币种',
        allowClear: true,
      },
    },
    {
      fieldName: 'position',
      label: '详细地址',
      component: 'Input',
      componentProps: { placeholder: '请输入宿舍区域的详细地址' },
      formItemClass: 'col-span-4',
    },
    {
      fieldName: 'images',
      label: '区域照片',
      component: 'ImageUpload',
      componentProps: {
        directory: 'dorm/area',
        maxNumber: 6,
        maxSize: 5,
        multiple: true,
      },
      formItemClass: 'col-span-4',
    },
    {
      fieldName: 'attention',
      label: '区域说明',
      component: 'RichTextarea',
      componentProps: {
        height: 320,
        width: '100%',
      },
      formItemClass: 'col-span-4',
    },
  ],
  showDefaultActions: false,
});

const isEdit = ref(false);

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    const data = (await formApi.getValues()) as DormApi.DormArea;
    try {
      await (data.id ? updateArea(data) : createArea(data));
      await modalApi.close();
      emit('success');
      message.success('操作成功');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = modalApi.getData<DormApi.DormArea>();
    isEdit.value = Boolean(data?.id);
    await formApi.resetForm();
    if (data?.id) {
      await formApi.setValues(data);
    }
  },
});
</script>

<template>
  <Modal :title="isEdit ? '编辑宿舍区域' : '新增宿舍区域'" class="w-[860px]">
    <div class="border-border bg-muted mx-4 mb-5 rounded-lg border px-4 py-3">
      <div class="flex items-start gap-3">
        <div class="text-primary mt-0.5">
          <span class="text-lg">◎</span>
        </div>
        <div>
          <div class="text-foreground text-sm font-medium">区域基础信息</div>
          <div class="text-muted-foreground mt-1 text-xs leading-5">
            区域用于归集同一地点的宿舍楼栋；时区和结算币种将用于后续预订与费用计算。
          </div>
        </div>
      </div>
    </div>
    <Form class="mx-4" />
  </Modal>
</template>
