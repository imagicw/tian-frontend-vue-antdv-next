<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { createClientProfile, updateClientProfile } from '#/api/shipment';

const emit = defineEmits<{ success: [] }>();

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    formItemClass: 'col-span-2',
    labelWidth: 120,
  },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: { triggerFields: [''], show: () => false },
    },
    {
      fieldName: 'clientCode',
      label: '客户代码',
      component: 'Input',
      componentProps: { placeholder: '请输入客户代码' },
      rules: 'required',
    },
    {
      fieldName: 'clientName',
      label: '客户名称',
      component: 'Input',
      componentProps: { placeholder: '请输入客户名称' },
      rules: 'required',
    },
    {
      fieldName: 'allowedContainerTypes',
      label: '允许箱型',
      component: 'Input',
      componentProps: { placeholder: '如：40GP,40HQ（逗号分隔）' },
    },
    {
      fieldName: 'allowedPorts',
      label: '允许港口',
      component: 'Input',
      componentProps: { placeholder: '港口代码，逗号分隔' },
    },
    {
      fieldName: 'consolidationDeliveryDays',
      label: '拼柜交期跨度',
      component: 'InputNumber',
      componentProps: { min: 0, placeholder: '天数' },
    },
    {
      fieldName: 'leadTimeDomestic',
      label: '国内提前期(天)',
      component: 'InputNumber',
      componentProps: { min: 0 },
    },
    {
      fieldName: 'leadTimeOverseas',
      label: '海外提前期(天)',
      component: 'InputNumber',
      componentProps: { min: 0 },
    },
    {
      fieldName: 'allowMultiLocation',
      label: '两地装货',
      component: 'RadioGroup',
      componentProps: {
        options: [
          { label: '允许', value: true },
          { label: '不允许', value: false },
        ],
        optionType: 'button',
      },
      defaultValue: false,
    },
    {
      fieldName: 'remark',
      label: '备注',
      component: 'Textarea',
      componentProps: { rows: 3 },
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
    const data = (await formApi.getValues()) as ShipmentApi.ClientProfile;
    try {
      await (data.id ? updateClientProfile(data) : createClientProfile(data));
      await modalApi.close();
      emit('success');
      message.success('操作成功');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = modalApi.getData<ShipmentApi.ClientProfile>();
    isEdit.value = !!data?.id;
    await formApi.resetForm();
    if (data?.id) await formApi.setValues(data);
  },
});
</script>

<template>
  <Modal :title="isEdit ? '编辑客户配置' : '新增客户配置'">
    <Form class="mx-4" />
  </Modal>
</template>
