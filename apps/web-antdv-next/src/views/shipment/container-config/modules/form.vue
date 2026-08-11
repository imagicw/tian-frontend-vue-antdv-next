<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { createContainerConfig, updateContainerConfig } from '#/api/shipment';

const emit = defineEmits<{ success: [] }>();

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    formItemClass: 'col-span-2',
    labelWidth: 110,
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
      fieldName: 'freightForwarder',
      label: '货代',
      component: 'Input',
      componentProps: { placeholder: '请输入货代' },
      rules: 'required',
    },
    {
      fieldName: 'productionCountry',
      label: '生产国',
      component: 'Input',
      componentProps: { placeholder: '请输入生产国' },
      rules: 'required',
    },
    {
      fieldName: 'containerType',
      label: '箱型',
      component: 'Input',
      componentProps: { placeholder: '如：40GP、40HQ' },
      rules: 'required',
    },
    {
      fieldName: 'minVolume',
      label: '最小体积(CBM)',
      component: 'InputNumber',
      componentProps: { min: 0, precision: 3 },
      rules: 'required',
    },
    {
      fieldName: 'maxVolume',
      label: '最大体积(CBM)',
      component: 'InputNumber',
      componentProps: { min: 0, precision: 3 },
      rules: 'required',
    },
    {
      fieldName: 'sortOrder',
      label: '排序',
      component: 'InputNumber',
      componentProps: { min: 0 },
    },
    {
      fieldName: 'enabled',
      label: '是否启用',
      component: 'RadioGroup',
      componentProps: {
        options: [
          { label: '启用', value: true },
          { label: '停用', value: false },
        ],
        optionType: 'button',
      },
      defaultValue: true,
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
    const data = (await formApi.getValues()) as ShipmentApi.ContainerConfig;
    try {
      await (data.id
        ? updateContainerConfig(data)
        : createContainerConfig(data));
      await modalApi.close();
      emit('success');
      message.success('操作成功');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = modalApi.getData<ShipmentApi.ContainerConfig>();
    isEdit.value = !!data?.id;
    await formApi.resetForm();
    if (data?.id) await formApi.setValues(data);
  },
});
</script>

<template>
  <Modal :title="isEdit ? '编辑集装箱配置' : '新增集装箱配置'">
    <Form class="mx-4" />
  </Modal>
</template>
