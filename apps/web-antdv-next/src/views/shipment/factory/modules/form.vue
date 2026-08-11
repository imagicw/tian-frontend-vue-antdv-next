<script lang="ts" setup>
import type { ShipmentApi } from '#/api/shipment';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { createFactory, updateFactory } from '#/api/shipment';

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
      fieldName: 'factoryCode',
      label: '工厂简码',
      component: 'Input',
      componentProps: { placeholder: '请输入工厂简码' },
      rules: 'required',
    },
    {
      fieldName: 'factoryNameCn',
      label: '工厂中文名',
      component: 'Input',
      componentProps: { placeholder: '请输入工厂中文名' },
      rules: 'required',
    },
    {
      fieldName: 'factoryNameEn',
      label: '工厂英文名',
      component: 'Input',
      componentProps: { placeholder: '请输入工厂英文名' },
    },
    {
      fieldName: 'factoryAddress',
      label: '工厂地址',
      component: 'Input',
      componentProps: { placeholder: '请输入工厂地址' },
    },
    {
      fieldName: 'country',
      label: '所属国家',
      component: 'Input',
      componentProps: { placeholder: '请输入国家' },
    },
    {
      fieldName: 'region',
      label: '所属区域',
      component: 'Input',
      componentProps: { placeholder: '请输入区域' },
    },
    {
      fieldName: 'location',
      label: '工厂位置',
      component: 'RadioGroup',
      componentProps: {
        options: [
          { label: '国内', value: 'DOMESTIC' },
          { label: '海外', value: 'OVERSEAS' },
        ],
        optionType: 'button',
        buttonStyle: 'solid',
      },
      defaultValue: 'DOMESTIC',
      rules: 'required',
    },
    {
      fieldName: 'isActive',
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
    const data = (await formApi.getValues()) as ShipmentApi.ProductFactory;
    try {
      await (data.id ? updateFactory(data) : createFactory(data));
      await modalApi.close();
      emit('success');
      message.success('操作成功');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = modalApi.getData<ShipmentApi.ProductFactory>();
    isEdit.value = !!data?.id;
    await formApi.resetForm();
    if (data?.id) await formApi.setValues(data);
  },
});
</script>

<template>
  <Modal :title="isEdit ? '编辑工厂' : '新增工厂'">
    <Form class="mx-4" />
  </Modal>
</template>
